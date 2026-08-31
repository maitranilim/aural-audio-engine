import { Search } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { scrollToId } from "@/lib/scroll-to";
import { subscribe } from "@/lib/scroll-progress";
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
  const fills = useRef(new Map<string, HTMLElement>());

  // Progress writes straight to the DOM; only the active id — which changes a
  // handful of times per page — is allowed to re-render React.
  useEffect(
    () =>
      subscribe((state) => {
        for (const [id, el] of fills.current) {
          el.style.setProperty("--track", String(state.sections[id] ?? 0));
        }
        if (state.activeId) setActive((prev) => (prev === state.activeId ? prev : state.activeId!));
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
        "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        docked ? "border-line/60 bg-bg/70 backdrop-blur-xl" : "border-transparent bg-transparent",
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
                aria-current={active === l.id ? "page" : undefined}
                ref={(node) => {
                  if (node) fills.current.set(l.id, node);
                  else fills.current.delete(l.id);
                }}
                className={cn(
                  "nav-track rounded-full px-3 py-2 transition-[color] duration-200",
                  active === l.id ? "text-fg" : "hover:text-fg",
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
