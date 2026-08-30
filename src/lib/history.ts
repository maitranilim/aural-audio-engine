import type { HistoryItem } from "@/lib/types";

const KEY = "aural:history:v1";
const MAX = 16;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  const next = [
    item,
    ...loadHistory().filter(
      (h) =>
        h.classification.title.toLowerCase() !== item.classification.title.toLowerCase() ||
        h.classification.artist.toLowerCase() !== item.classification.artist.toLowerCase(),
    ),
  ].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearHistory(): HistoryItem[] {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}
