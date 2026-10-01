import { useRef, useEffect } from "react";
import { clamp01, onScrollFrame } from "@/lib/use-scroll";

export function ProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onScrollFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? clamp01(window.scrollY / max) : 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(3)})`;
      }),
    [],
  );
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-fg/10"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full origin-left bg-accent"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
