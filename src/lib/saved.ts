import type { Classification, HistoryItem } from "./types.ts";
import { parseHistory, parseHistoryItem } from "./history.ts";

const KEY = "aural:saved:v1";
const MAX = 16;

function sameTrack(a: Classification, b: Classification) {
  return (
    a.title.trim().toLocaleLowerCase() === b.title.trim().toLocaleLowerCase() &&
    a.artist.trim().toLocaleLowerCase() === b.artist.trim().toLocaleLowerCase()
  );
}

function persist(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage may be unavailable; the in-memory result remains useful */
  }
}

export function loadSaved(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseHistory(JSON.parse(raw) as unknown).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function isSaved(items: HistoryItem[], classification: Classification) {
  return items.some((item) => sameTrack(item.classification, classification));
}

export function toggleSaved(item: HistoryItem): HistoryItem[] {
  const current = loadSaved();
  const parsed = parseHistoryItem(item);
  if (!parsed) return current;

  const exists = current.some((entry) => sameTrack(entry.classification, parsed.classification));
  const next = exists
    ? current.filter((entry) => !sameTrack(entry.classification, parsed.classification))
    : [parsed, ...current].slice(0, MAX);
  persist(next);
  return next;
}

export function removeSaved(item: HistoryItem): HistoryItem[] {
  const next = loadSaved().filter(
    (entry) => !sameTrack(entry.classification, item.classification),
  );
  persist(next);
  return next;
}
