import { X } from "lucide-react";
import { useId, useState } from "react";
import type { CatalogHit, Classification, HistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSimilarTrack(value: unknown): boolean {
  return isRecord(value) && typeof value.title === "string" && typeof value.artist === "string";
}

function isClassification(value: unknown): value is Classification {
  if (!isRecord(value)) return false;
  return (
    typeof value.found === "boolean" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    isNullableFiniteNumber(value.year) &&
    typeof value.genre === "string" &&
    typeof value.subgenre === "string" &&
    typeof value.microgenre === "string" &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    typeof value.rationale === "string" &&
    typeof value.era === "string" &&
    typeof value.bpmRange === "string" &&
    typeof value.energy === "number" &&
    Number.isFinite(value.energy) &&
    isStringArray(value.traits) &&
    isStringArray(value.neighbors) &&
    Array.isArray(value.similar) &&
    value.similar.every(isSimilarTrack)
  );
}

function isCatalogHit(value: unknown): value is CatalogHit {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    isNullableString(value.artworkUrl) &&
    isNullableString(value.previewUrl) &&
    isNullableFiniteNumber(value.year) &&
    isNullableString(value.catalogGenre) &&
    (value.source === "itunes" || value.source === "deezer")
  );
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt) &&
    typeof value.query === "string" &&
    value.query.trim().length > 0 &&
    isClassification(value.classification) &&
    (value.catalog === null || isCatalogHit(value.catalog))
  );
}

function artworkUrlFor(item: HistoryItem) {
  const artworkUrl = item.catalog?.artworkUrl;
  return typeof artworkUrl === "string" && /^https?:\/\//i.test(artworkUrl) ? artworkUrl : null;
}

export function HistoryRail({
  items,
  onPick,
  onClear,
}: {
  items: HistoryItem[];
  onPick: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  const headingId = useId();
  const [failedArtwork, setFailedArtwork] = useState<Set<string>>(() => new Set());
  const visibleItems = (Array.isArray(items) ? items : []).filter(isHistoryItem).slice(0, 16);

  if (visibleItems.length === 0) return null;

  return (
    <section className="w-full" aria-labelledby={headingId}>
      <div className="mb-3 flex items-center justify-between">
        <h2
          id={headingId}
          className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
        >
          Recent
        </h2>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear recent mappings"
          className={cn(
            "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs text-subtle",
            "transition-[color,background-color] duration-150 hover:bg-fg/5 hover:text-fg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          )}
        >
          <X className="size-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
      <ul aria-label="Recent mappings" className="-mx-1 flex gap-2 overflow-x-auto pb-2">
        {visibleItems.map((item, index) => {
          const title = item.classification.title.trim() || item.query.trim() || "Unknown track";
          const artist = item.classification.artist.trim();
          const microgenre = item.classification.microgenre.trim() || "Unclassified";
          const artworkUrl = artworkUrlFor(item);
          const artworkKey = `${item.id}-${index}`;
          const showArtwork = artworkUrl !== null && !failedArtwork.has(artworkKey);

          return (
            <li key={artworkKey} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(item)}
                aria-label={
                  artist
                    ? `Use recent mapping ${title} by ${artist}`
                    : `Use recent mapping ${title}`
                }
                className={cn(
                  "glass-thin flex min-h-14 min-w-[168px] max-w-[200px] items-center gap-3 rounded-2xl p-2 pr-3 text-left",
                  "transition-[scale,background-color] duration-150 ease-out",
                  "active:scale-[0.96] hover:bg-fg/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                )}
              >
                {showArtwork ? (
                  <img
                    src={artworkUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() =>
                      setFailedArtwork((previous) => {
                        if (previous.has(artworkKey)) return previous;
                        const next = new Set(previous);
                        next.add(artworkKey);
                        return next;
                      })
                    }
                    className="size-10 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-white/10"
                  />
                ) : (
                  <div
                    className="flex size-10 items-center justify-center rounded-lg bg-fg/10 font-display text-sm"
                    aria-hidden="true"
                  >
                    {(title[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="block truncate text-xs text-muted">{microgenre}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
