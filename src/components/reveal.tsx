import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { registerReveal } from "@/lib/scroll-progress";
import { cn } from "@/lib/utils";

/**
 * Content that draws itself in proportion to how far you have scrolled.
 *
 * Deliberately not a translate: nothing slides up from underneath. The element
 * holds its final position from the first frame and a gradient mask sweeps
 * across it, so scrolling reads as the section being generated rather than
 * something sliding into view. Scrub back up and it un-draws.
 */
export function Reveal<T extends ElementType = "div">({
  as,
  stagger = 0,
  className,
  children,
  ...rest
}: {
  as?: T;
  stagger?: number;
  className?: string;
  children?: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerReveal(el, { stagger });
  }, [stagger]);

  return (
    <Tag ref={ref} className={cn("reveal", className)} {...rest}>
      {children}
    </Tag>
  );
}
