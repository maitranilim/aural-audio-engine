import { Search } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { scrollToId } from "@/lib/scroll-to";
import { subscribeActiveSection } from "@/lib/scroll-progress";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "tool", label: "Tool" },
  { id: "how", label: "How" },
  { id: "lineage", label: "Lineage" },
  { id: "atlas", label: "Atlas" },
] as const;

export function SiteHeader({
  docked,
  compactSearch,
}: {
  docked: boolean;
  compactSearch?: ReactNode;
}) {
  const lenis = useLenis();
  const [active, setActive] = useState("tool");

  // The nav updates only when the reading line enters a different section.
  // Continuous section progress is reserved for the chapter rails.
  useEffect(
    () =>
      subscribeActiveSection((activeId) => {
        if (activeId) setActive((prev) => (prev === activeId ? prev : activeId));
      }),
    [],
  );

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    scrollToId(id, lenis, -72, 1.15);
  };

  const focusToolSearch = () => {
    scrollToId("tool", lenis, -72, 0.75);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>('#tool input[name="query"]')
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        docked ? "border-line/60 bg-bg/95" : "border-transparent bg-transparent",
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
          <div className="mx-auto w-full max-w-xl px-2">
            <div className="hidden sm:block">{compactSearch}</div>
            <button
              type="button"
              onClick={focusToolSearch}
              aria-label="Focus song search"
              className="glass-thin flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-muted transition-[color,background-color] duration-150 hover:bg-fg/10 hover:text-fg sm:hidden"
            >
              <Search className="size-4" aria-hidden="true" />
              Search
            </button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <nav className="hidden items-center gap-1 text-xs font-medium text-muted sm:flex">
            {LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={go(l.id)}
                aria-current={active === l.id ? "location" : undefined}
                className={cn(
                  "rounded-full px-3 py-2 transition-[background-color,color] duration-200",
                  active === l.id ? "bg-fg text-bg" : "hover:bg-fg/10 hover:text-fg",
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
