import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nudgeScroll, refreshScroll, startScrollEngine, subscribeThrottled } from "@/lib/scroll-progress";

const ATMOSPHERE_PARALLAX_OFFSETS = [18, -14, 10] as const;

/**
 * The glow's inner element owns the CSS drift transform. This outer layer is
 * the only transform owner for scroll parallax, so the two effects cannot
 * overwrite one another.
 *
 * Optimized to cache glows and round scroll values to avoid repeated queries
 * and imperceptible CSS updates.
 */
function AtmosphereParallax({ disabled }: { disabled: boolean }) {
  const glowsRef = useRef<HTMLElement[]>([]);
  const lastPageRef = useRef(-1);

  useEffect(() => {
    // Cache glows once instead of querying every render
    glowsRef.current = Array.from(
      document.querySelectorAll<HTMLElement>("[data-atmosphere-parallax]")
    );

    const reset = () => {
      for (const glow of glowsRef.current) {
        glow.style.setProperty("--atmosphere-shift-y", "0%");
      }
    };

    if (disabled || glowsRef.current.length === 0) {
      reset();
      return;
    }

    // Use throttled subscription to reduce update frequency for parallax
    const unsubscribe = subscribeThrottled(({ page }) => {
      // Round to 1% granularity to avoid micro-updates
      const rounded = Math.round(page * 100) / 100;
      if (rounded === lastPageRef.current) return;
      lastPageRef.current = rounded;

      for (let i = 0; i < glowsRef.current.length; i++) {
        const glow = glowsRef.current[i];
        const offset = ATMOSPHERE_PARALLAX_OFFSETS[i] ?? 0;
        glow.style.setProperty("--atmosphere-shift-y", `${rounded * offset}%`);
      }
    }, 16);

    return () => {
      unsubscribe();
      reset();
    };
  }, [disabled]);

  return null;
}

/** Drives the whole scroll system and keeps it in step with Lenis. */
function ScrollEngine() {
  const lenis = useLenis();

  useEffect(() => startScrollEngine(), []);

  // Lenis drives scroll from its own rAF loop, so ask the engine for a frame
  // from its callback. Never by dispatching a synthetic scroll event — Lenis
  // listens for those, which loops straight back into here.
  useLenis(() => {
    // Lenis can advance without dispatching a native scroll event. nudgeScroll
    // is intentionally a no-op while the position is unchanged, so this
    // callback does not create a second idle animation loop.
    nudgeScroll();
  });

  useEffect(() => {
    if (lenis) refreshScroll();
  }, [lenis]);

  return null;
}

function ProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      subscribeThrottled((s) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${s.page})`;
      }, 16),
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

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(motionQuery.matches);
    update();
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", update);
    } else {
      motionQuery.addListener(update);
    }
    return () => {
      if (typeof motionQuery.removeEventListener === "function") {
        motionQuery.removeEventListener("change", update);
      } else {
        motionQuery.removeListener(update);
      }
    };
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: reduce ? 1 : 0.085,
        smoothWheel: !reduce,
        syncTouch: false,
        respectReducedMotion: true,
      }}
    >
      <AtmosphereParallax disabled={reduce} />
      <ScrollEngine />
      <ProgressBar />
      {children}
    </ReactLenis>
  );
}
