import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-provider";

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      toastOptions={{
        className: "glass-strong !bg-bg-elevated/80 !text-fg !border-0 !shadow-glass",
      }}
    />
  );
}
