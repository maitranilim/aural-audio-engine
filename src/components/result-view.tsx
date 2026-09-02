import { Check, Copy, GitCompareArrows, Share2 } from "lucide-react";
import { useState } from "react";
import { PreviewPlayer } from "@/components/preview-player";
import type { CatalogHit, Classification } from "@/lib/types";
import { ensureDistinct } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function Confidence({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-label="Estimated confidence"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
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
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{kicker}</div>
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
  query,
  onSimilar,
  onCompare,
  isCompareBase = false,
}: {
  classification: Classification;
  catalog: CatalogHit | null;
  query: string;
  onSimilar: (query: string) => void;
  onCompare: () => void;
  isCompareBase?: boolean;
}) {
  const [feedback, setFeedback] = useState<"copied" | "shared" | "error" | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const lineage = ensureDistinct(classification);
  const art = classification.found && !artFailed && catalog?.artworkUrl ? catalog.artworkUrl : null;
  const preview = classification.found ? catalog?.previewUrl : null;
  const title = lineage.title || "Unknown title";
  const artist = lineage.artist || "Unknown artist";
  const path = `${lineage.genre} → ${lineage.subgenre} → ${lineage.microgenre}`;
  const isCurated = classification.rationale.startsWith("Curated Aural example:");
  const provenance = isCurated
    ? "Curated offline example"
    : classification.found
      ? "Classifier + catalog match"
      : "Taxonomy estimate · recording unconfirmed";

  const markFeedback = (next: "copied" | "shared" | "error") => {
    setFeedback(next);
    window.setTimeout(() => setFeedback(null), 1800);
  };

  const writeClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("Clipboard unavailable");
  };

  const copy = async () => {
    const line = `${title} — ${artist}: ${path}`;
    try {
      await writeClipboard(line);
      markFeedback("copied");
    } catch {
      markFeedback("error");
    }
  };

  const share = async () => {
    const shareQuery = query || `${title} ${artist}`;
    const url = new URL(window.location.href);
    url.searchParams.set("q", shareQuery);
    const line = `${title} — ${artist}: ${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} · Aural`, text: line, url: url.toString() });
      } else {
        await writeClipboard(`${line}\n${url.toString()}`);
      }
      markFeedback("shared");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      markFeedback("error");
    }
  };

  return (
    <div className="stagger-in mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <section className="glass glass-sheen overflow-hidden rounded-[32px] p-3">
        <div className="overflow-hidden rounded-[20px] bg-bg-elevated">
          {art ? (
            <img
              src={art}
              alt={`${title} album artwork`}
              onError={() => setArtFailed(true)}
              loading="lazy"
              decoding="async"
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
          <h2
            id="result-title"
            tabIndex={-1}
            className="font-display text-xl font-semibold leading-snug tracking-tight outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
          >
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Lineage</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCompare}
              aria-pressed={isCompareBase}
              aria-label={
                isCompareBase
                  ? "This mapping is pinned for comparison"
                  : "Pin this mapping and compare another track"
              }
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                "glass-thin transition-[scale,color,background-color] duration-150 ease-out",
                "active:scale-[0.96]",
                isCompareBase ? "bg-accent/15 text-accent" : "text-muted hover:text-fg",
              )}
            >
              <GitCompareArrows className="size-3.5" aria-hidden="true" />
              {isCompareBase ? "Pinned" : "Compare"}
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy lineage summary"
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted",
                "glass-thin transition-[scale,color] duration-150 ease-out hover:text-fg",
                "active:scale-[0.96]",
              )}
            >
              {feedback === "copied" ? (
                <Check className="size-3.5 text-accent" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {feedback === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Share this mapping"
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted",
                "glass-thin transition-[scale,color] duration-150 ease-out hover:text-fg",
                "active:scale-[0.96]",
              )}
            >
              <Share2 className="size-3.5" />
              {feedback === "shared" ? "Shared" : "Share"}
            </button>
          </div>
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
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
            <span>Estimated confidence</span>
            <span className="tabular-nums">
              {classification.era}
              {classification.era && classification.bpmRange ? " · " : ""}
              {classification.bpmRange ? `${classification.bpmRange} BPM` : ""}
            </span>
          </div>
          <Confidence value={classification.confidence} />
          <p className="mt-2 text-xs text-subtle">{provenance}</p>
        </div>

        {feedback === "error" ? (
          <p className="mt-4 text-xs text-danger" role="status">
            Couldn’t copy the mapping. Your browser may block clipboard access.
          </p>
        ) : null}

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
