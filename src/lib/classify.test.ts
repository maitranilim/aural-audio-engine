import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RequestTimeoutError,
  curatedExampleFor,
  fallbackFromCatalog,
  validateClassifyInput,
  validateTranscriptionInput,
  withRequestTimeout,
} from "./classify.ts";
import type { CatalogHit } from "./types.ts";

describe("classify input validation", () => {
  it("trims a valid query and rejects malformed or control-filled input", () => {
    assert.deepEqual(validateClassifyInput({ query: "  Lean   On  " }), { query: "Lean   On" });
    assert.throws(() => validateClassifyInput(null), /Invalid song query|Enter a song/);
    assert.throws(() => validateClassifyInput({ query: "" }), /Enter a song or artist/);
    assert.throws(() => validateClassifyInput({ query: `safe\u0000query` }), /unsupported/);
    assert.throws(() => validateClassifyInput({ query: "ok", extra: true }), /Unrecognized key/);
    assert.throws(() => validateClassifyInput({ query: "x".repeat(201) }), /too long/);
  });

  it("accepts recorder base64 and a default webm MIME, but rejects unsafe values", () => {
    assert.deepEqual(validateTranscriptionInput({ audioBase64: "AQID" }), {
      audioBase64: "AQID",
      mimeType: "audio/webm",
    });
    assert.deepEqual(
      validateTranscriptionInput({ audioBase64: "AQID", mimeType: "audio/webm;codecs=opus" }),
      { audioBase64: "AQID", mimeType: "audio/webm;codecs=opus" },
    );
    assert.throws(() => validateTranscriptionInput({ audioBase64: "not base64" }), /invalid/i);
    assert.throws(
      () => validateTranscriptionInput({ audioBase64: "AQID", mimeType: "text/plain" }),
      /not supported/i,
    );
    assert.throws(
      () =>
        validateTranscriptionInput({
          audioBase64: "AQID",
          mimeType: "audio/webm;codecs=opus\r\nbad",
        }),
      /not supported|invalid/i,
    );
  });
});

describe("curated examples", () => {
  it("keeps all six built-in demos available without a live model", () => {
    const queries = [
      "Lean On Major Lazer",
      "Strobe deadmau5",
      "HUMBLE. Kendrick Lamar",
      "Midnight City M83",
      "Take Five Dave Brubeck",
      "Around the World Daft Punk",
    ];

    for (const query of queries) {
      const result = curatedExampleFor(query);
      assert.ok(result, query);
      assert.equal(result.found, true);
      assert.notEqual(result.genre, result.subgenre, query);
      assert.notEqual(result.subgenre, result.microgenre, query);
      assert.ok(result.rationale.includes("deterministic"), query);
    }
    assert.deepEqual(curatedExampleFor("  strobe   DEADMAU5  ")?.title, "Strobe");
  });

  it("marks catalog-only lineage as unconfirmed and ignores unrelated first hits", () => {
    const hit = (title: string, artist: string): CatalogHit => ({
      title,
      artist,
      album: "Album",
      artworkUrl: null,
      previewUrl: null,
      year: 2020,
      catalogGenre: "Dance",
      source: "itunes",
    });
    const classification = fallbackFromCatalog(
      "Target Song Target Artist",
      [hit("Unrelated Song", "Someone Else"), hit("Target Song", "Target Artist")],
      "missing-key",
    );
    assert.equal(classification.found, false);
    assert.equal(classification.title, "Target Song");
    assert.equal(classification.artist, "Target Artist");
    assert.match(classification.rationale, /Catalog-only/);
  });
});

describe("bounded upstream requests", () => {
  it("rejects at the deadline even when the operation ignores AbortSignal", async () => {
    await assert.rejects(
      withRequestTimeout(async () => new Promise<never>(() => {}), 5),
      (error: unknown) => error instanceof RequestTimeoutError,
    );
  });

  it("passes an abort signal to the operation", async () => {
    let aborted = false;
    await assert.rejects(
      withRequestTimeout(
        async (signal) =>
          new Promise<never>((_, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          }),
        5,
      ),
      (error: unknown) => error instanceof RequestTimeoutError,
    );
    assert.equal(aborted, true);
  });

  it("propagates caller cancellation even when the operation ignores the signal", async () => {
    const parent = new AbortController();
    const pending = withRequestTimeout(
      async () => new Promise<never>(() => {}),
      100,
      parent.signal,
    );
    parent.abort();
    await assert.rejects(pending, (error: unknown) => {
      return error instanceof Error && error.name === "AbortError";
    });
  });
});
