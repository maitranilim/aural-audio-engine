import { useEffect, useRef, useState } from "react";

export function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function onScrollFrame(fn: () => void) {
  let frame = 0;
  const run = () => {
    frame = 0;
    fn();
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(run);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onScrollFrame(() => setScrolled(window.scrollY > threshold)), [threshold]);
  return scrolled;
}

export function useActiveSection(ids: readonly string[], initial: string) {
  const [active, setActive] = useState(initial);
  const key = ids.join("|");
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = ids.find((id) => visible.has(id));
        if (current) setActive(current);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [active, setActive] as const;
}

export function useChapterBeat<T extends HTMLElement = HTMLElement>(length: number) {
  const ref = useRef<T>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(
    () =>
      onScrollFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const p = clamp01((window.innerHeight * 0.5 - rect.top) / Math.max(1, rect.height));
        railRef.current?.style.setProperty("--track", p.toFixed(3));
        const next = Math.min(length - 1, Math.floor(p * length));
        setStep((prev) => (prev === next ? prev : next));
      }),
    [length],
  );

  return { ref, railRef, step };
}
