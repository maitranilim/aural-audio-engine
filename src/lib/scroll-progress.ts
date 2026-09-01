/**
 * An event-driven rAF loop that turns scroll position into progress numbers.
 *
 * Everything scroll-driven on the page reads from here: the document progress
 * bar, atmosphere parallax, chapter rails, and the active navigation section.
 *
 * Values are written to the DOM as CSS custom properties, so scrolling never
 * touches React state.
 */

const READ_LINE_VH = 0.5; // the line a section is measured against
const ROUNDING_PRECISION = 100; // Round to 1% granularity (0.01)

type Section = {
  id: string;
  el: HTMLElement;
  top: number;
  height: number;
};

export type ScrollState = {
  /** Whole-document progress, 0 at the top, 1 at the very bottom. */
  page: number;
  /** Section currently under the reading line. */
  activeId: string | null;
  /** Per-section progress, 0 before it starts, 1 once it is fully behind. */
  sections: Record<string, number>;
};

type Listener = (state: ScrollState) => void;
type ActiveSectionListener = (activeId: string | null) => void;

const sections = new Map<string, Section>();
const listeners = new Set<Listener>();
const activeSectionListeners = new Set<ActiveSectionListener>();

let frame = 0;
let running = false;
let lastScroll = -1;
let dirty = true;
let remeasureTimeoutId: ReturnType<typeof setTimeout> | undefined;
let state: ScrollState = { page: 0, activeId: null, sections: {} };

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function docTop(el: HTMLElement) {
  return el.getBoundingClientRect().top + window.scrollY;
}

/**
 * Batch DOM reads together to minimize reflows.
 * Collect all read operations first, then apply writes.
 */
function measure() {
  // Phase 1: Batch all DOM reads (triggers one reflow)
  const sectionData = new Map<string, { top: number; height: number }>();

  for (const s of sections.values()) {
    sectionData.set(s.id, {
      top: docTop(s.el),
      height: s.el.offsetHeight,
    });
  }

  // Phase 2: Apply all writes (no reflow needed)
  for (const [id, data] of sectionData) {
    const s = sections.get(id);
    if (s) {
      s.top = data.top;
      s.height = data.height;
    }
  }

  dirty = false;
}

function tick() {
  frame = 0;
  if (!running) return;

  const scroll = window.scrollY;
  if (dirty) measure();
  else if (scroll === lastScroll) return;
  lastScroll = scroll;

  const limit = maxScroll();
  const vh = window.innerHeight;
  const readLine = scroll + vh * READ_LINE_VH;

  const next: Record<string, number> = {};
  let activeId: string | null = null;
  let activeTop = Number.NEGATIVE_INFINITY;
  for (const s of sections.values()) {
    const height = Math.max(1, s.height);
    let p = clamp01((readLine - s.top) / height);
    // A trailing section whose end sits below the last scrollable pixel still
    // has to be able to report 1.
    if (p < 1 && scroll >= limit - 1) p = 1;
    next[s.id] = p;
    // Navigation is deliberately binary: whichever section starts closest
    // above the reading line is fully active. Section progress remains only
    // for chapter rails and is never used as a partial nav fill.
    if (s.top <= readLine && s.top >= activeTop) {
      activeTop = s.top;
      activeId = s.id;
    }
  }

  // Round page progress to reduce listener updates
  const page = limit > 0 ? Math.round(clamp01(scroll / limit) * ROUNDING_PRECISION) / ROUNDING_PRECISION : 0;

  // Round section progress before comparison
  const nextRounded: Record<string, number> = {};
  for (const [key, val] of Object.entries(next)) {
    nextRounded[key] = Math.round(val * ROUNDING_PRECISION) / ROUNDING_PRECISION;
  }

  const changed =
    page !== state.page ||
    activeId !== state.activeId ||
    Object.keys(nextRounded).length !== Object.keys(state.sections).length ||
    Object.keys(nextRounded).some((k) => nextRounded[k] !== state.sections[k]);

  if (changed) {
    const activeChanged = activeId !== state.activeId;
    state = { page, activeId, sections: nextRounded };
    for (const fn of listeners) fn(state);
    if (activeChanged) {
      for (const fn of activeSectionListeners) fn(activeId);
    }
  }
}

function schedule(force: boolean) {
  if (force) dirty = true;
  if (!running) return;
  if (!frame) frame = requestAnimationFrame(tick);
}

function onResize() {
  dirty = true;
  lastScroll = -1;
  schedule(true);
}

/**
 * Debounced remeasure triggered by ResizeObserver to avoid thrashing
 * on rapid layout changes.
 */
function scheduleRemeasure() {
  if (remeasureTimeoutId) clearTimeout(remeasureTimeoutId);
  remeasureTimeoutId = setTimeout(() => {
    dirty = true;
    schedule(false);
    remeasureTimeoutId = undefined;
  }, 100);
}

export function registerSection(id: string, el: HTMLElement) {
  sections.set(id, { id, el, top: docTop(el), height: el.offsetHeight });
  schedule(true);
  return () => {
    sections.delete(id);
    schedule(true);
  };
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

/** Subscribe only to binary active-section changes, not every scroll update. */
export function subscribeActiveSection(fn: ActiveSectionListener) {
  activeSectionListeners.add(fn);
  fn(state.activeId);
  return () => {
    activeSectionListeners.delete(fn);
  };
}

/**
 * Subscribe with automatic throttling to reduce update frequency.
 * Useful for non-critical visual updates.
 */
export function subscribeThrottled(fn: Listener, delayMs: number = 16) {
  let pending = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  const throttledFn = (state: ScrollState) => {
    if (pending) return;
    pending = true;
    fn(state);
    timeoutId = setTimeout(() => {
      pending = false;
    }, delayMs);
  };

  return subscribe(throttledFn);
}

export function getScrollState() {
  return state;
}

/** Ask for a frame — for scroll sources that do not emit a native scroll event. */
export function nudgeScroll() {
  if (dirty || window.scrollY !== lastScroll) schedule(false);
}

/** Re-measure after a layout change the engine cannot see (content swapped in). */
export function refreshScroll() {
  onResize();
}

export function startScrollEngine() {
  if (running) return () => {};
  running = true;

  const onScroll = () => schedule(false);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  const ro = new ResizeObserver(scheduleRemeasure);
  ro.observe(document.documentElement);

  schedule(true);

  return () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (remeasureTimeoutId) clearTimeout(remeasureTimeoutId);
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
  };
}
