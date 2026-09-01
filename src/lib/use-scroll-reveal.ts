import { useEffect, useRef } from "react";
import { registerSection } from "@/lib/scroll-progress";

/** Registers a section for binary navigation state and chapter progress. */
export function useTrackedSection<T extends HTMLElement = HTMLElement>(id: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerSection(id, el);
  }, [id]);
  return ref;
}
