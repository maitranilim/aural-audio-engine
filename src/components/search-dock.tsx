import { ArrowUp, Loader2, Mic, Search, Square } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

type Mode = "idle" | "listening" | "recording" | "transcribing" | "classifying";
const QUERY_MAX_LENGTH = 200;

export function SearchDock({
  value,
  onChange,
  onSubmit,
  onMic,
  mode,
  hint,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMic: () => void;
  mode: Mode;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const busy = mode === "classifying" || mode === "transcribing";
  const live = mode === "recording" || mode === "listening";
  const canSubmit = !busy && !live && value.trim().length > 0;
  const micLabel = live ? "Stop recording" : "Record a song name";
  const statusText =
    hint ??
    (live
      ? "Listening for a song and artist"
      : mode === "transcribing"
        ? "Turning speech into a title"
        : mode === "classifying"
          ? "Mapping genre, subgenre, and microgenre"
          : "");

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) {
          onSubmit();
        } else if (!busy && !live) {
          inputRef.current?.focus();
        }
      }}
      aria-busy={busy || live}
      aria-label={compact ? "Quick map search" : "Map a song by title or artist"}
      className="w-full"
    >
      <label htmlFor={inputId} className="sr-only">
        Song title or artist
      </label>
      <div
        className={cn(
          "glass-strong glass-sheen flex min-w-0 items-center gap-2 pl-4",
          compact ? "gap-1.5 rounded-full p-1.5 pl-2" : "rounded-[28px] p-2",
          live && "ring-1 ring-accent/40",
          "focus-within:ring-2 focus-within:ring-accent/70 focus-within:ring-offset-2 focus-within:ring-offset-bg",
        )}
      >
        <Search
          className={cn("size-5 shrink-0 text-muted", compact && "hidden sm:block")}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          name="query"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, QUERY_MAX_LENGTH))}
          placeholder={live ? "Listening… say a song and artist" : "Song or artist"}
          disabled={busy}
          required
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          inputMode="search"
          enterKeyHint="search"
          spellCheck={false}
          aria-describedby={statusText ? statusId : undefined}
          aria-controls="result"
          aria-keyshortcuts="/"
          suppressHydrationWarning
          className={cn(
            "min-w-0 flex-1 bg-transparent text-fg caret-fg outline-none",
            compact ? "h-11 text-sm" : "h-11 text-base",
            "placeholder:text-subtle disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          )}
        />
        <button
          type="button"
          onClick={onMic}
          disabled={busy}
          aria-label={micLabel}
          aria-pressed={live}
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center rounded-full",
            "transition-[scale,background-color,color] duration-150 ease-out",
            "active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            compact && "hidden sm:flex",
            live ? "mic-ring bg-accent text-accent-fg" : "glass-thin text-fg hover:bg-fg/10",
          )}
        >
          {live ? <Square className="size-3.5" fill="currentColor" /> : <Mic className="size-5" />}
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Map genre"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center gap-2 rounded-full",
            "bg-fg text-bg font-medium sm:h-11 sm:w-auto sm:px-5",
            "transition-[scale,opacity] duration-150 ease-out",
            "active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            compact && live && "hidden sm:flex",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4 sm:hidden" />
          )}
          <span className="hidden sm:inline">
            {mode === "classifying" ? "Mapping" : mode === "transcribing" ? "Hearing" : "Map"}
          </span>
        </button>
      </div>
      {statusText && (compact || !hint) ? (
        <span id={statusId} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusText}
        </span>
      ) : null}
      {hint && !compact ? (
        <p
          id={statusId}
          className="mt-3 text-center text-sm text-muted"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {hint}
        </p>
      ) : null}
    </form>
  );
}
