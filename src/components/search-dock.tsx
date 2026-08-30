import { ArrowUp, Loader2, Mic, Search, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Mode = "idle" | "listening" | "recording" | "transcribing" | "classifying";

export function SearchDock({
  value,
  onChange,
  onSubmit,
  onMic,
  mode,
  hint,
  seconds = 0,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMic: () => void;
  mode: Mode;
  hint?: string;
  seconds?: number;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = mode === "classifying" || mode === "transcribing";
  const live = mode === "recording" || mode === "listening";

  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  const clock = `0:${String(Math.min(seconds, 59)).padStart(2, "0")}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !live) onSubmit();
      }}
      className="w-full"
    >
      <div
        className={cn(
          "glass-strong glass-sheen flex items-center gap-2 pl-4",
          compact ? "rounded-full p-1.5 pl-3" : "rounded-[28px] p-2",
          live && "ring-1 ring-accent/40",
        )}
      >
        <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={live ? "Listening… say a song and artist" : "Song or artist"}
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Song query"
          suppressHydrationWarning
          className={cn(
            "min-w-0 flex-1 bg-transparent text-fg caret-fg outline-none",
            compact ? "h-10 text-sm" : "h-11 text-base",
            "placeholder:text-subtle disabled:opacity-60",
          )}
        />
        {live ? (
          <span className="hidden tabular-nums text-xs font-medium text-accent sm:inline">
            {clock}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onMic}
          disabled={busy}
          aria-label={live ? "Stop recording" : "Record a song name"}
          aria-pressed={live}
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center rounded-full",
            "transition-[scale,background-color,color] duration-150 ease-out",
            "active:scale-[0.96] disabled:opacity-50",
            live
              ? "mic-ring bg-accent text-accent-fg"
              : "glass-thin text-fg hover:bg-fg/10",
          )}
        >
          {live ? <Square className="size-3.5" fill="currentColor" /> : <Mic className="size-5" />}
        </button>
        <button
          type="submit"
          disabled={busy || live || value.trim().length === 0}
          aria-label="Map genre"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center gap-2 rounded-full",
            "bg-fg text-bg font-medium sm:h-11 sm:w-auto sm:px-5",
            "transition-[scale,opacity] duration-150 ease-out",
            "active:scale-[0.96] disabled:opacity-40",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4 sm:hidden" />
          )}
          <span className="hidden sm:inline">
            {mode === "classifying"
              ? "Mapping"
              : mode === "transcribing"
                ? "Hearing"
                : "Map"}
          </span>
        </button>
      </div>
      {hint && !compact ? (
        <p className="mt-3 text-center text-sm text-muted" aria-live="polite">
          {hint}
        </p>
      ) : null}
    </form>
  );
}
