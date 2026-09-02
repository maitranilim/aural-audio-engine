import { BookmarkCheck, X } from "lucide-react";
import type { HistoryItem } from "@/lib/types";

export function SavedRail({
  items,
  onPick,
  onRemove,
}: {
  items: HistoryItem[];
  onPick: (item: HistoryItem) => void;
  onRemove: (item: HistoryItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="w-full" aria-labelledby="saved-mappings-title">
      <div className="mb-3 flex items-center gap-2">
        <BookmarkCheck className="size-4 text-accent" aria-hidden="true" />
        <h2
          id="saved-mappings-title"
          className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
        >
          Saved mappings
        </h2>
        <span className="text-xs tabular-nums text-subtle">{items.length}</span>
      </div>
      <ul aria-label="Saved mappings" className="-mx-1 flex gap-2 overflow-x-auto pb-2">
        {items.map((item) => {
          const title = item.classification.title.trim() || item.query;
          const artist = item.classification.artist.trim();
          return (
            <li
              key={`${item.classification.title}-${item.classification.artist}`}
              className="glass-thin flex min-w-[210px] max-w-[240px] shrink-0 items-center rounded-2xl p-1"
            >
              <button
                type="button"
                onClick={() => onPick(item)}
                className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition-colors hover:bg-fg/5"
                aria-label={
                  artist
                    ? `Open saved mapping ${title} by ${artist}`
                    : `Open saved mapping ${title}`
                }
              >
                <span className="block truncate text-sm font-medium">{title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {item.classification.microgenre}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-fg/5 hover:text-fg"
                aria-label={`Remove ${title} from saved mappings`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-subtle">Saved on this device for your next visit.</p>
    </section>
  );
}
