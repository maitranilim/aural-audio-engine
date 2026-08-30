import { useLenis } from "lenis/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "tool", label: "Tool" },
  { id: "how", label: "How" },
  { id: "lineage", label: "Lineage" },
  { id: "atlas", label: "Atlas" },
] as const;

const SECTION_IDS = LINKS.map((l) => l.id);

function sectionAtSpy(): string {
  const line = Math.round(window.innerHeight * 0.4);
  let current = SECTION_IDS[0];
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= line) current = id;
  }
  return current;
}

export function SiteHeader({
  docked,
  compactSearch,
}: {
  docked: boolean;
  compactSearch?: ReactNode;
}) {
  const lenis = useLenis();
  const [active, setActive] = useState("tool");

  const sync = useCallback(() => {
    const next = sectionAtSpy();
    setActive((prev) => (prev === next ? prev : next));
  }, []);

  useLenis(() => {
    sync();
  });

  useEffect(() => {
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    if (lenis) lenis.scrollTo(`#${id}`, { offset: -72, duration: 1.15 });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        docked
          ? "border-line/60 bg-bg/70 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <a href="#tool" onClick={go("tool")} className="min-h-11 shrink-0">
          <Wordmark />
        </a>
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[opacity,flex-grow] duration-300",
            docked ? "flex-1 opacity-100" : "pointer-events-none w-0 flex-none opacity-0",
          )}
          aria-hidden={!docked}
          inert={!docked ? true : undefined}
        >
          <div className="mx-auto w-full max-w-xl px-2">{compactSearch}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <nav className="hidden items-center gap-1 text-xs font-medium text-muted sm:flex">
            {LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={go(l.id)}
                aria-current={active === l.id ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-2 transition-[color,background-color] duration-150",
                  active === l.id ? "bg-fg/10 text-fg" : "hover:text-fg",
                )}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
