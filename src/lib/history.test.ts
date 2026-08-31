import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Classification, HistoryItem } from "./types.ts";
import {
  clearHistory,
  loadHistory,
  parseHistory,
  parseHistoryItem,
  pushHistory,
} from "./history.ts";

function makeClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    found: true,
    title: "Lean On",
    artist: "Major Lazer",
    album: "Peace Is the Mission",
    year: 2015,
    genre: "EDM",
    subgenre: "Tropical House",
    microgenre: "Moombahton",
    confidence: 0.98,
    rationale: "deterministic test mapping",
    era: "2010s",
    bpmRange: "98–100",
    energy: 0.78,
    traits: ["sunlit", "syncopated"],
    neighbors: ["Dancehall Pop"],
    similar: [{ title: "Get Lucky", artist: "Daft Punk" }],
    ...overrides,
  };
}

function makeHistory(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "history-1",
    savedAt: 1_700_000_000_000,
    query: "Lean On Major Lazer",
    classification: makeClassification(),
    catalog: null,
    ...overrides,
  };
}

function withStorage<T>(value: unknown, run: () => T): T {
  let stored = JSON.stringify(value);
  const storage = {
    getItem: () => stored,
    setItem: (_key: string, next: string) => {
      stored = next;
    },
    removeItem: () => {
      stored = "null";
    },
  };
  const globals = globalThis as { window?: unknown };
  const previous = globals.window;
  globals.window = { localStorage: storage };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globals.window;
    else globals.window = previous;
  }
}

describe("parseHistory", () => {
  it("filters malformed nested records while retaining later valid entries", () => {
    const valid = makeHistory();
    const malformed = {
      ...valid,
      id: "bad",
      classification: { ...valid.classification, confidence: 4 },
    };
    const parsed = parseHistory([malformed, valid, null, { id: "not-history" }]);
    assert.deepEqual(parsed, [valid]);
    assert.equal(parseHistoryItem(malformed), null);
  });

  it("rejects unsafe catalog URLs instead of persisting renderable garbage", () => {
    const invalid = makeHistory({
      catalog: {
        title: "Lean On",
        artist: "Major Lazer",
        album: "Peace Is the Mission",
        artworkUrl: "javascript:alert(1)",
        previewUrl: null,
        year: 2015,
        catalogGenre: "Dance",
        source: "itunes",
      },
    });
    assert.equal(parseHistoryItem(invalid), null);
  });
});

describe("history storage", () => {
  it("loads only valid records from localStorage", () => {
    const valid = makeHistory();
    const result = withStorage(
      [{ ...valid, classification: { ...valid.classification, title: 42 } }, valid],
      () => loadHistory(),
    );
    assert.deepEqual(result, [valid]);
  });

  it("deduplicates tracks and ignores an invalid push without throwing", () => {
    const first = makeHistory();
    const newer = makeHistory({ id: "history-2", savedAt: first.savedAt + 1 });
    const result = withStorage([first], () => {
      const afterNewer = pushHistory(newer);
      const afterInvalid = pushHistory({
        ...newer,
        classification: { ...newer.classification, title: "" },
      });
      assert.deepEqual(afterInvalid, afterNewer);
      return afterInvalid;
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "history-2");
  });

  it("is safe to call during SSR", () => {
    assert.deepEqual(loadHistory(), []);
    assert.deepEqual(clearHistory(), []);
    assert.deepEqual(pushHistory(makeHistory()), [makeHistory()]);
  });
});
