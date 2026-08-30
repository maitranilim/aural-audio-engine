import { useEffect, useRef } from "react";
import { registerReveal, registerSection } from "@/lib/scroll-progress";

/**
 * Registers a section with the scroll engine so the nav can report how far
 * through it the reader is, rather than only which one they are inside.
 */
export function useTrackedSection<T extends HTMLElement = HTMLElement>(id: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerSection(id, el);
  }, [id]);
  return ref;
}

/**
 * Registers every direct child of a container as its own reveal, staggered in
 * document order. Lets a whole scene scrub in without wrapping each line.
 */
export function useRevealChildren<T extends HTMLElement = HTMLElement>(from = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const stops = kids.map((kid, i) => {
      kid.classList.add("reveal");
      return registerReveal(kid, { stagger: from + i });
    });
    return () => {
      stops.forEach((stop) => stop());
      kids.forEach((kid) => kid.classList.remove("reveal"));
    };
  }, [from]);
  return ref;
}
