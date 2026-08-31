import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect
        x="6"
        y="5"
        width="16"
        height="20"
        rx="4"
        fill="var(--aural-veil)"
        stroke="var(--aural-line)"
        strokeWidth="1.2"
      />
      <rect
        x="10"
        y="8"
        width="16"
        height="20"
        rx="4"
        fill="color-mix(in srgb, var(--aural-accent) 18%, transparent)"
        stroke="var(--aural-accent)"
        strokeWidth="1.2"
      />
      <rect
        x="8"
        y="6.5"
        width="16"
        height="20"
        rx="4"
        fill="color-mix(in srgb, var(--aural-bg-elevated) 70%, transparent)"
        stroke="var(--aural-fg)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Mark />
      <div className="leading-none">
        <div className="font-display text-lg font-semibold tracking-tight">Aural</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
          Sonic taxonomy
        </div>
      </div>
    </div>
  );
}
