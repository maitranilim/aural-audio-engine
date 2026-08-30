import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nudgeScroll, refreshScroll, startScrollEngine, subscribe } from "@/lib/scroll-progress";

gsap.registerPlugin(ScrollTrigger);

function prefersReduced() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function GsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const onRefresh = () => lenis.resize();
    ScrollTrigger.addEventListener("refresh", onRefresh);
    ScrollTrigger.refresh();
    return () => {
      lenis.off("scroll", onScroll);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
    };
  }, [lenis]);

  useEffect(() => {
    const glows = gsap.utils.toArray<HTMLElement>(".atmosphere-glow");
    if (!glows.length) return;
    const tweens = glows.map((el, i) =>
      gsap.to(el, {
        yPercent: i === 0 ? 18 : i === 1 ? -14 : 10,
        ease: "none",
        scrollTrigger: {
          trigger: document.documentElement,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
      }),
    );
    return () => tweens.forEach((t) => t.kill());
  }, []);

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
      subscribe((s) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${s.page})`;
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

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    setReduce(prefersReduced());
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: reduce ? 1 : 0.085,
        smoothWheel: !reduce,
        syncTouch: false,
      }}
    >
      {reduce ? null : <GsapBridge />}
      <ScrollEngine />
      <ProgressBar />
      {children}
    </ReactLenis>
  );
}
