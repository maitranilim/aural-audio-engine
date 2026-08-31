/**
 * An event-driven rAF loop that turns scroll position into progress numbers.
 *
 * Everything scroll-driven on the page reads from here: reveals, the chapter
 * rails, the nav. Two reasons it is a single shared engine rather than a
 * trigger per element:
 *
 * - Progress is *scrubbed*, not fired. Scroll half a section and the thing is
 *   half revealed; scroll back and it un-reveals. A trigger that flips a class
 *   at a threshold cannot do that.
 * - Every window is clamped so it can actually finish. That is the bug that
 *   made the closing section sit blurred forever: a reveal whose completion
 *   point sits past the bottom of the document never reaches it, because the
 *   page runs out of scroll first. `windowFor` folds the window back inside
 *   the scrollable range instead.
 *
 * Values are written to the DOM as CSS custom properties, so scrolling never
 * touches React state.
 */

const REVEAL_START_VH = 0.9; // element top enters here -> progress 0
const REVEAL_END_VH = 0.44; // element top reaches here -> progress 1
const STAGGER_VH = 0.06; // per-index offset inside a group
const READ_LINE_VH = 0.5; // the line a section is measured against
const ROUNDING_PRECISION = 100; // Round to 1% granularity (0.01)

export type RevealOptions = { stagger?: number };

type Reveal = {
  el: HTMLElement;
  stagger: number;
  top: number;
  written: number;
};

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

const reveals = new Set<Reveal>();
const sections = new Map<string, Section>();
const listeners = new Set<Listener>();

let frame = 0;
let running = false;
let reduced = false;
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
 * Scroll window over which `top` reveals, always inside the scrollable range.
 *
 * The span is kept whole when the window has to move: an element near the end
 * of the document still reveals over the same scroll distance, it just lands
 * exactly at the bottom of the page instead of somewhere unreachable past it.
 */
function windowFor(top: number, offsetVh: number) {
  const vh = window.innerHeight;
  const span = Math.max(1, vh * (REVEAL_START_VH - REVEAL_END_VH));
  const limit = maxScroll();
  let end = top - vh * REVEAL_END_VH + vh * offsetVh;
  if (end > limit) end = limit;
  return { start: Math.max(0, end - span), end };
}

function progressAt(scroll: number, top: number, offsetVh: number) {
  const { start, end } = windowFor(top, offsetVh);
  if (end <= start) return 1;
  return clamp01((scroll - start) / (end - start));
}

/**
 * Batch DOM reads together to minimize reflows.
 * Collect all read operations first, then apply writes.
 */
function measure() {
  // Phase 1: Batch all DOM reads (triggers one reflow)
  const revealData = new Map<Reveal, number>();
  const sectionData = new Map<string, { top: number; height: number }>();

  for (const r of reveals) {
    revealData.set(r, docTop(r.el));
  }
  for (const s of sections.values()) {
    sectionData.set(s.id, {
      top: docTop(s.el),
      height: s.el.offsetHeight,
    });
  }

  // Phase 2: Apply all writes (no reflow needed)
  for (const [r, top] of revealData) {
    r.top = top;
  }
  for (const [id, data] of sectionData) {
    const s = sections.get(id);
    if (s) {
      s.top = data.top;
      s.height = data.height;
    }
  }

  dirty = false;
}

function paintReveal(r: Reveal, p: number) {
  // Round to 1% granularity to avoid imperceptible CSS recalculations
  const q = Math.round(p * ROUNDING_PRECISION) / ROUNDING_PRECISION;
  if (q === r.written) return;
  r.written = q;
  r.el.style.setProperty("--p", String(q));
  // Dropping the mask once an element is done keeps the number of live masks
  // to the handful actually on screen, and guarantees the finished state is
  // plain opaque text rather than a mask that stopped just short.
  const done = q >= 1;
  if (done !== (r.el.dataset.reveal === "done")) {
    r.el.dataset.reveal = done ? "done" : "live";
  }
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

  for (const r of reveals) {
    paintReveal(r, reduced ? 1 : progressAt(scroll, r.top, r.stagger * STAGGER_VH));
  }

  const next: Record<string, number> = {};
  let activeId: string | null = null;
  for (const s of sections.values()) {
    const height = Math.max(1, s.height);
    let p = clamp01((readLine - s.top) / height);
    // Same clamp as the reveals: a trailing section whose end sits below the
    // last scrollable pixel still has to be able to report 1.
    if (p < 1 && scroll >= limit - 1) p = 1;
    next[s.id] = p;
    if (p > 0 && p < 1) activeId = s.id;
    else if (p >= 1) activeId = s.id;
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
    Object.keys(nextRounded).some((k) => nextRounded[k] !== state.sections[k]);

  if (changed) {
    state = { page, activeId, sections: nextRounded };
    for (const fn of listeners) fn(state);
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

export function registerReveal(el: HTMLElement, opts: RevealOptions = {}) {
  const entry: Reveal = { el, stagger: opts.stagger ?? 0, top: docTop(el), written: -1 };
  reveals.add(entry);
  paintReveal(
    entry,
    reduced ? 1 : progressAt(window.scrollY, entry.top, entry.stagger * STAGGER_VH),
  );
  schedule(true);
  return () => {
    reveals.delete(entry);
    el.style.removeProperty("--p");
    delete el.dataset.reveal;
  };
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
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced = motionQuery.matches;
  document.documentElement.classList.add("scroll-js");

  const onScroll = () => schedule(false);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  const onMotionChange = () => {
    reduced = motionQuery.matches;
    dirty = true;
    lastScroll = -1;
    schedule(true);
  };
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", onMotionChange);
  } else {
    motionQuery.addListener(onMotionChange);
  }

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
    if (typeof motionQuery.removeEventListener === "function") {
      motionQuery.removeEventListener("change", onMotionChange);
    } else {
      motionQuery.removeListener(onMotionChange);
    }
    document.documentElement.classList.remove("scroll-js");
  };
}
