type ScrollController = {
  scrollTo: (target: string, options?: { offset?: number; duration?: number }) => void;
};

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scrollToId(
  id: string,
  controller?: ScrollController | null,
  offset = -72,
  duration = 1.1,
) {
  const immediate = prefersReducedMotion();
  if (controller) {
    controller.scrollTo(`#${id}`, { offset, duration: immediate ? 0 : duration });
    return;
  }

  document.getElementById(id)?.scrollIntoView({
    behavior: immediate ? "auto" : "smooth",
    block: "start",
  });
}
