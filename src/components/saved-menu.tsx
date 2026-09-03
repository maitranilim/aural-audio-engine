import * as Popover from "@radix-ui/react-popover";
import { BookmarkCheck, Menu, X } from "lucide-react";
import { useState } from "react";
import type { HistoryItem } from "@/lib/types";

export function SavedMenu({
  items,
  onPick,
  onRemove,
}: {
  items: HistoryItem[];
  onPick: (item: HistoryItem) => void;
  onRemove: (item: HistoryItem) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open saved mappings"
          className="glass-thin relative flex size-11 shrink-0 items-center justify-center rounded-full text-fg transition-[scale,background-color] duration-150 hover:bg-fg/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Menu className="size-5" aria-hidden="true" />
          {items.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-accent-fg">
              {Math.min(items.length, 99)}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={10}
          collisionPadding={16}
          aria-label="Saved mappings menu"
          className="glass-strong z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[28px] border border-line/80 !bg-bg p-3 shadow-2xl outline-none"
        >
          <div className="flex items-center gap-2 px-2 pb-3 pt-1">
            <BookmarkCheck className="size-4 text-accent" aria-hidden="true" />
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Saved mappings
            </h2>
            <span className="ml-auto text-xs tabular-nums text-subtle">{items.length}</span>
          </div>

          {items.length === 0 ? (
            <p className="rounded-2xl bg-fg/5 px-4 py-5 text-sm leading-relaxed text-muted">
              Save a result and it will stay here for your next visit.
            </p>
          ) : (
            <ul
              aria-label="Saved mappings"
              className="max-h-[min(24rem,60vh)] space-y-1 overflow-y-auto"
            >
              {items.map((item) => {
                const title = item.classification.title.trim() || item.query;
                const artist = item.classification.artist.trim();
                return (
                  <li
                    key={`${item.classification.title}-${item.classification.artist}`}
                    className="flex items-center rounded-2xl bg-fg/[0.04] p-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onPick(item);
                      }}
                      className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition-colors hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={
                        artist
                          ? `Open saved mapping ${title} by ${artist}`
                          : `Open saved mapping ${title}`
                      }
                    >
                      <span className="block truncate text-sm font-medium text-fg">{title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {artist ? `${artist} · ` : ""}
                        {item.classification.microgenre}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Remove ${title} from saved mappings`}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Popover.Arrow className="fill-line/60" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
