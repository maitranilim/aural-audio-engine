import { Layers, Mic, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Mark } from "@/components/logo";
import { markOnboarded } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Layers,
    kicker: "What this is",
    title: "Aural maps a song to its lineage.",
    body: "Every track sits on three rungs: genre, subgenre, then the microgenre scene. Those three labels are never the same word twice.",
  },
  {
    icon: Search,
    kicker: "How to use it",
    title: "Name it. Speak it. Or tap a chip.",
    body: "The mapper stays at the top of the page. Type a title, tap the mic and say the song, or pick a known recording from the atlas.",
  },
  {
    icon: Mic,
    kicker: "The three rungs",
    title: "Broad, then family, then scene.",
    body: "Lean On is EDM, then tropical house, then moombahton — not Dance / Dance / Dance. That split is the whole point.",
  },
] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const Icon = current.icon;

  const finish = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    markOnboarded();
    onDone();
    window.requestAnimationFrame(() => {
      const opener = openerRef.current;
      if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
        return;
      }
      document
        .querySelector<HTMLInputElement>('#tool input[name="query"]')
        ?.focus({ preventScroll: true });
    });
  }, [onDone]);

  useEffect(() => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  const trapFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
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
      onClick={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="glass-strong glass-sheen w-full max-w-lg rounded-[32px] p-6 sm:p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <Mark className="size-9" />
          <button
            type="button"
            onClick={finish}
            className="h-11 rounded-full px-4 text-sm text-muted transition-[color] duration-150 hover:text-fg"
          >
            Skip
          </button>
        </div>

        <div className="mt-8 flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Icon className="size-5" />
        </div>

        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
          {current.kicker}
        </p>
        <h2 id={titleId} className="mt-3 font-display text-3xl font-semibold tracking-tight">
          {current.title}
        </h2>
        <p id={bodyId} className="mt-3 text-base leading-relaxed text-muted">
          {current.body}
        </p>

        {step === 2 ? (
          <div className="mt-6 flex flex-col gap-2">
            <Line preview="Genre" value="EDM" />
            <Line preview="Subgenre" value="Tropical house" />
            <Line preview="Microgenre" value="Moombahton" />
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200",
                  i === step ? "w-6 bg-accent" : "w-1.5 bg-fg/20",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="glass-thin h-11 rounded-full px-5 text-sm text-fg transition-[scale] duration-150 active:scale-[0.96]"
              >
                Back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              onClick={() => {
                if (last) finish();
                else setStep((s) => s + 1);
              }}
              className="h-11 rounded-full bg-fg px-5 text-sm font-medium text-bg transition-[scale] duration-150 active:scale-[0.96]"
            >
              {last ? "Start mapping" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ preview, value }: { preview: string; value: string }) {
  return (
    <div className="glass-thin flex items-baseline justify-between rounded-2xl px-4 py-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        {preview}
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">{value}</span>
    </div>
  );
}
