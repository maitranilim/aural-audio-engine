import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { PreviewPlayer } from "@/components/preview-player";
import type { CatalogHit, Classification } from "@/lib/types";
import { ensureDistinct } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-xs font-medium text-muted">{pct}%</span>
    </div>
  );
}

function LineageRow({
  kicker,
  value,
  size,
}: {
  kicker: string;
  value: string;
  size: "sm" | "md" | "lg";
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        {kicker}
      </div>
      <div
        className={cn(
          "mt-1 font-display font-semibold tracking-tight text-balance",
          size === "lg" && "text-3xl text-fg sm:text-4xl",
          size === "md" && "text-2xl text-fg",
          size === "sm" && "text-xl text-fg/90",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ResultView({
  classification,
  catalog,
  onSimilar,
}: {
  classification: Classification;
  catalog: CatalogHit | null;
  onSimilar: (query: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const lineage = ensureDistinct(classification);
  const art = !artFailed && catalog?.artworkUrl ? catalog.artworkUrl : null;
  const preview = catalog?.previewUrl;
  const title = lineage.title || "Unknown title";
  const artist = lineage.artist || "Unknown artist";
  const path = `${lineage.genre} → ${lineage.subgenre} → ${lineage.microgenre}`;

  const copy = async () => {
    const line = `${title} — ${artist}: ${path}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="stagger-in mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <section className="glass glass-sheen overflow-hidden rounded-[32px] p-3">
        <div className="overflow-hidden rounded-[20px] bg-bg-elevated">
          {art ? (
            <img
              src={art}
              alt=""
              onError={() => setArtFailed(true)}
              className="aspect-square w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-fg/5">
              <div className="text-center">
                <div className="font-display text-4xl text-fg/30">
                  {(title[0] ?? "?").toUpperCase()}
                </div>
                <div className="mt-2 text-xs text-subtle">No artwork</div>
              </div>
            </div>
          )}
        </div>
        <div className="px-3 pb-3 pt-4">
          <h2 className="font-display text-xl font-semibold leading-snug tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">{artist}</p>
          <p className="mt-1 text-xs text-subtle">
            {[classification.album || catalog?.album, classification.year || catalog?.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {preview ? (
            <div className="mt-4">
              <PreviewPlayer src={preview} title={title} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass glass-sheen rounded-[32px] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
            Lineage
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted",
              "glass-thin transition-[scale,color] duration-150 ease-out hover:text-fg",
              "active:scale-[0.96]",
            )}
          >
            {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-6 flex gap-5">
          <div className="lineage-line hidden sm:block" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <LineageRow kicker="Genre" value={lineage.genre} size="sm" />
            <LineageRow kicker="Subgenre" value={lineage.subgenre} size="md" />
            <LineageRow kicker="Microgenre" value={lineage.microgenre} size="lg" />
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Confidence</span>
            <span className="tabular-nums">
              {classification.era}
              {classification.era && classification.bpmRange ? " · " : ""}
              {classification.bpmRange ? `${classification.bpmRange} BPM` : ""}
            </span>
          </div>
          <Confidence value={classification.confidence} />
        </div>

        {classification.rationale ? (
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted">
            {classification.rationale}
          </p>
        ) : null}

        {classification.traits.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {classification.traits.map((t) => (
              <span
                key={t}
                className="glass-thin rounded-full px-3 py-1.5 text-xs font-medium text-fg"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {classification.neighbors.length > 0 ? (
          <div className="mt-8">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Neighbor microgenres
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {classification.neighbors.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {classification.similar.length > 0 ? (
          <div className="mt-8">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Nearby tracks
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {classification.similar.map((s) => (
                <li key={`${s.title}-${s.artist}`}>
                  <button
                    type="button"
                    onClick={() => onSimilar(`${s.title} ${s.artist}`)}
                    className={cn(
                      "glass-thin flex h-full w-full flex-col items-start rounded-2xl px-3 py-3 text-left",
                      "transition-[scale,background-color] duration-150 ease-out",
                      "active:scale-[0.96] hover:bg-fg/10",
                    )}
                  >
                    <span className="text-sm font-medium leading-snug">{s.title}</span>
                    <span className="mt-1 text-xs text-muted">{s.artist}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!classification.found ? (
          <p className="mt-6 text-sm text-danger">
            Couldn’t lock a specific recording — taxonomy is a best-effort read of the query.
          </p>
        ) : null}
      </section>
    </div>
  );
}
