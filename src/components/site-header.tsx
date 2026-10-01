import { Search, Square } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { scrollToId } from "@/lib/scroll-to";
import { useActiveSection, useScrolled } from "@/lib/use-scroll";
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
  savedMenu,
  listening = false,
  onStopListening,
}: {
  docked: boolean;
  listening?: boolean;
  onStopListening?: () => void;
  compactSearch?: ReactNode;
  savedMenu?: ReactNode;
}) {
  const [active, setActive] = useActiveSection(
    LINKS.map((l) => l.id),
    "tool",
  );
  const scrolled = useScrolled();

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    scrollToId(id);
  };

  const focusToolSearch = () => {
    scrollToId("tool");
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
        docked || scrolled ? "border-line/60 bg-bg/95" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        {savedMenu}
        <a href="#tool" onClick={go("tool")} className="min-h-11 shrink-0">
          <Wordmark />
        </a>
        <div
          className={cn(
            "min-w-0 transition-[opacity,flex-grow] duration-300",
            docked || listening
              ? "flex-1 opacity-100"
              : "pointer-events-none w-0 flex-none opacity-0",
          )}
          aria-hidden={!docked && !listening}
          inert={!docked && !listening ? true : undefined}
        >
          <div className="mx-auto w-full max-w-xl px-2">
            <div className="hidden py-1 sm:block">{compactSearch}</div>
            {listening ? (
              <button
                type="button"
                onClick={onStopListening}
                aria-label="Stop listening and identify"
                className="mic-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-3 text-sm font-medium text-accent-fg sm:hidden"
              >
                <Square className="size-3.5" fill="currentColor" aria-hidden="true" />
                Stop
              </button>
            ) : null}
            <button
              type="button"
              onClick={focusToolSearch}
              aria-label="Focus song search"
              className={cn(
                "glass-thin fx min-h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-muted sm:hidden",
                listening ? "hidden" : "flex",
              )}
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden min-[430px]:inline">Search</span>
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
                  "fx rounded-full px-3 py-2",
                  active === l.id ? "bg-fg text-bg" : null,
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
