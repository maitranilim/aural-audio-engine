import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="9"
        fill="color-mix(in srgb, var(--aural-accent) 8%, transparent)"
        stroke="var(--aural-line)"
        strokeWidth="1"
      />
      <path
        d="M4 16h2l1.7-4.5 2.3 9 2.4-13 2.4 17 1.9-8.5H20"
        fill="none"
        stroke="var(--aural-fg)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 16h3.5M23.5 8.5v15M23.5 8.5H27M23.5 16H27M23.5 23.5H27"
        fill="none"
        stroke="var(--aural-fg)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="28" cy="8.5" r="1.5" fill="var(--aural-accent)" />
      <circle cx="28" cy="16" r="1.5" fill="var(--aural-accent)" />
      <circle cx="28" cy="23.5" r="1.5" fill="var(--aural-accent)" />
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
