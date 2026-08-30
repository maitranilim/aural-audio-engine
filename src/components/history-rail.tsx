import { X } from "lucide-react";
import type { HistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HistoryRail({
  items,
  onPick,
  onClear,
}: {
  items: HistoryItem[];
  onPick: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          Recent
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="flex h-8 items-center gap-1 rounded-full px-2 text-xs text-subtle transition-[color] duration-150 hover:text-fg"
        >
          <X className="size-3.5" />
          Clear
        </button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            className={cn(
              "glass-thin flex min-w-[168px] max-w-[200px] shrink-0 items-center gap-3 rounded-2xl p-2 pr-3 text-left",
              "transition-[scale,background-color] duration-150 ease-out",
              "active:scale-[0.96] hover:bg-fg/10",
            )}
          >
            {item.catalog?.artworkUrl ? (
              <img
                src={item.catalog.artworkUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="size-10 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-white/10"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-lg bg-fg/10 font-display text-sm">
                {(item.classification.title[0] ?? "?").toUpperCase()}
              </div>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {item.classification.title || item.query}
              </span>
              <span className="block truncate text-xs text-muted">
                {item.classification.microgenre}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
