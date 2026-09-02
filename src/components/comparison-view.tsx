import { X } from "lucide-react";
import type { Classification } from "@/lib/types";
import { ensureDistinct } from "@/lib/taxonomy";

type ComparedTrack = {
  classification: Classification;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function sameTrack(a: Classification, b: Classification) {
  return normalize(a.title) === normalize(b.title) && normalize(a.artist) === normalize(b.artist);
}

function TrackColumn({ label, track }: { label: string; track: Classification }) {
  const lineage = ensureDistinct(track);
  const confidence = Math.round(Math.min(1, Math.max(0, lineage.confidence)) * 100);

  return (
    <div className="min-w-0 rounded-[24px] border border-line bg-fg/[0.025] p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{label}</p>
      <h3 className="mt-2 truncate font-display text-xl font-semibold tracking-tight">
        {lineage.title}
      </h3>
      <p className="mt-1 truncate text-sm text-muted">{lineage.artist || "Unknown artist"}</p>
      <dl className="mt-6 space-y-4">
        {[
          ["Genre", lineage.genre],
          ["Subgenre", lineage.subgenre],
          ["Microgenre", lineage.microgenre],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-subtle">{term}</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-subtle">{confidence}% estimated confidence</p>
    </div>
  );
}

export function ComparisonView({ base, current, onClear }: {
  base: ComparedTrack;
  current: Classification;
  onClear: () => void;
}) {
  if (sameTrack(base.classification, current)) return null;

  const left = ensureDistinct(base.classification);
  const right = ensureDistinct(current);
  const shared = [
    normalize(left.genre) === normalize(right.genre) ? left.genre : null,
    normalize(left.subgenre) === normalize(right.subgenre) ? left.subgenre : null,
    normalize(left.microgenre) === normalize(right.microgenre) ? left.microgenre : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section
      className="glass glass-sheen mx-auto w-full max-w-5xl rounded-[32px] p-5 sm:p-7"
      aria-labelledby="comparison-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">A/B lineage</p>
          <h2 id="comparison-title" className="mt-2 font-display text-2xl font-semibold tracking-tight">
            Compare the ladders
          </h2>
          <p className="mt-2 text-sm text-muted">
            {shared.length > 0
              ? `Shared territory: ${shared.join(" · ")}`
              : "These tracks split at the top-level genre."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Close comparison"
          className="glass-thin flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-[scale,color] duration-150 hover:text-fg active:scale-[0.96]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <TrackColumn label="Pinned" track={left} />
        <TrackColumn label="Current" track={right} />
      </div>
    </section>
  );
}
