import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const toLight = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toLight ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={!toLight}
      className="glass-thin flex size-11 shrink-0 items-center justify-center rounded-full text-fg transition-[scale,background-color] duration-150 ease-out hover:bg-fg/10 active:scale-[0.96]"
    >
      {toLight ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
