import { z } from "zod";
import type { Classification, HistoryItem } from "./types.ts";

const KEY = "aural:history:v1";
const MAX = 16;
const MAX_TEXT = 500;
const MAX_URL = 2048;

const text = (max = MAX_TEXT) => z.string().trim().max(max);
const requiredText = (max = MAX_TEXT) => text(max).min(1);

function isSafeRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const remoteUrl = z.string().trim().max(MAX_URL).refine(isSafeRemoteUrl, "Expected an http(s) URL");

const catalogHitSchema = z.object({
  title: requiredText(),
  artist: requiredText(),
  album: text(),
  artworkUrl: z.union([remoteUrl, z.null()]),
  previewUrl: z.union([remoteUrl, z.null()]),
  year: z.number().finite().int().min(0).max(3000).nullable(),
  catalogGenre: z.union([text(120), z.null()]),
  source: z.enum(["itunes", "deezer"]),
});

const similarSchema = z.object({
  title: requiredText(),
  artist: requiredText(),
});

const classificationSchema = z.object({
  found: z.boolean(),
  title: requiredText(240),
  artist: text(),
  album: text(),
  year: z.number().finite().int().min(0).max(3000).nullable(),
  genre: requiredText(120),
  subgenre: requiredText(120),
  microgenre: requiredText(120),
  confidence: z.number().finite().min(0).max(1),
  rationale: text(2000),
  era: text(80),
  bpmRange: text(80),
  energy: z.number().finite().min(0).max(1),
  traits: z.array(requiredText(120)).max(6),
  neighbors: z.array(requiredText(120)).max(4),
  similar: z.array(similarSchema).max(3),
});

const historyItemSchema = z.object({
  id: requiredText(200),
  savedAt: z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  query: requiredText(200),
  classification: classificationSchema,
  catalog: z.union([catalogHitSchema, z.null()]),
});

/** Parse one untrusted storage value without exposing malformed nested data. */
export function parseHistoryItem(value: unknown): HistoryItem | null {
  const parsed = historyItemSchema.safeParse(value);
  return parsed.success ? (parsed.data as HistoryItem) : null;
}

/** Keep valid records when a corrupt record is mixed into the stored array. */
export function parseHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];

  const valid: HistoryItem[] = [];
  for (const entry of value) {
    const parsed = parseHistoryItem(entry);
    if (!parsed) continue;
    valid.push(parsed);
    if (valid.length >= MAX) break;
  }
  return valid;
}

function sameTrack(a: Classification, b: Classification) {
  return (
    a.title.toLowerCase() === b.title.toLowerCase() &&
    a.artist.toLowerCase() === b.artist.toLowerCase()
  );
}

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return parseHistory(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  const current = loadHistory();
  const parsed = parseHistoryItem(item);
  if (!parsed) return current;

  const next = [
    parsed,
    ...current.filter((entry) => !sameTrack(entry.classification, parsed.classification)),
  ].slice(0, MAX);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota or a storage policy; the in-memory result is still useful */
    }
  }
  return next;
}

export function clearHistory(): HistoryItem[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore storage policy failures */
    }
  }
  return [];
}
