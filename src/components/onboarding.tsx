import { ArrowRight, Layers, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { Mark } from "@/components/logo";
import { markOnboarded } from "@/lib/onboarding";

export function Onboarding({
  onDone,
  onTryExample,
}: {
  onDone: () => void;
  onTryExample: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  const finish = useCallback(
    (next?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      markOnboarded();
      onDone();
      window.requestAnimationFrame(() => {
        if (next) {
          next();
          return;
        }
        document
          .querySelector<HTMLInputElement>('#tool input[name="query"]')
          ?.focus({ preventScroll: true });
      });
    },
    [onDone],
  );

  useEffect(() => {
    primaryRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 backdrop-blur-xl sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={trapFocus}
    >
      <div
        ref={dialogRef}
        className="glass-strong glass-sheen w-full max-w-lg rounded-[32px] p-6 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <Mark className="size-9" />
          <button
            type="button"
            onClick={() => finish()}
            aria-label="Close introduction and search"
            className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-7 flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Layers className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
          Hear the hierarchy
        </p>
        <h2 id={titleId} className="mt-3 font-display text-3xl font-semibold tracking-tight">
          One song. Three useful levels.
        </h2>
        <p id={bodyId} className="mt-3 text-base leading-relaxed text-muted">
          Aural turns a title into genre, subgenre, and microgenre—then lets you save and compare
          the result. See the idea with one proven track or start with your own.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Line label="Genre" value="EDM" />
          <Line label="Subgenre" value="Tropical house" />
          <Line label="Microgenre" value="Moombahton" accent />
        </div>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={() => finish(onTryExample)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-fg px-5 text-sm font-medium text-bg transition-transform active:scale-[0.97]"
          >
            Try Lean On
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => finish()}
            className="glass-thin flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-fg transition-transform active:scale-[0.97]"
          >
            <Search className="size-4" aria-hidden="true" />
            Use my song
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-thin flex items-baseline justify-between rounded-2xl px-4 py-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span
        className={`font-display text-lg font-semibold tracking-tight ${accent ? "text-accent" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
