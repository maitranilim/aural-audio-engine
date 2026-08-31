import { ChevronDown, Keyboard, Mic, Pointer } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { EXAMPLES } from "@/lib/constants";
import { scrollToId } from "@/lib/scroll-to";
import { subscribe } from "@/lib/scroll-progress";
import { useRevealChildren, useTrackedSection } from "@/lib/use-scroll-reveal";
import { cn } from "@/lib/utils";

const HOW_BEATS = [
  { n: "01", title: "Name", hint: "One field is enough" },
  { n: "02", title: "Match", hint: "Find the recording" },
  { n: "03", title: "Split", hint: "Three distinct rungs" },
] as const;

const HOUSE_CORNERS = [
  "Tech House",
  "Deep House",
  "Tropical House",
  "French House",
  "Progressive House",
] as const;

const WORKED = [
  {
    title: "Lean On",
    artist: "Major Lazer",
    genre: "EDM",
    sub: "Tropical House",
    micro: "Moombahton",
  },
  {
    title: "Strobe",
    artist: "deadmau5",
    genre: "EDM",
    sub: "Progressive House",
    micro: "Melodic House",
  },
  {
    title: "HUMBLE.",
    artist: "Kendrick Lamar",
    genre: "Hip-Hop",
    sub: "West Coast Hip-Hop",
    micro: "West Coast Trap",
  },
  {
    title: "Take Five",
    artist: "Dave Brubeck",
    genre: "Jazz",
    sub: "Cool Jazz",
    micro: "West Coast Jazz",
  },
  { title: "Midnight City", artist: "M83", genre: "Pop", sub: "Synthpop", micro: "Synthwave" },
  {
    title: "Around the World",
    artist: "Daft Punk",
    genre: "EDM",
    sub: "House",
    micro: "French House",
  },
] as const;

/**
 * Ties a chapter's rail to how far through it the reader actually is.
 *
 * `step` is state because it changes three times per chapter; the continuous
 * value goes straight onto a DOM node as `--track`, because re-rendering React
 * on every scroll frame is what makes a page feel heavy.
 */
function useChapterBeat(id: string, length: number) {
  const ref = useTrackedSection<HTMLElement>(id);
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(
    () =>
      subscribe((state) => {
        const p = state.sections[id] ?? 0;
        railRef.current?.style.setProperty("--track", String(p));
        const next = Math.min(length - 1, Math.floor(p * length));
        setStep((prev) => (prev === next ? prev : next));
      }),
    [id, length],
  );

  return { ref, railRef, step };
}

function Scene({ children }: { children: ReactNode }) {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <div ref={ref} className="scene">
      {children}
    </div>
  );
}

function Rail({
  kicker,
  title,
  beats,
  step,
  railRef,
}: {
  kicker: string;
  title: string;
  beats: readonly { n: string; title: string; hint: string }[];
  step: number;
  railRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <aside className="chapter-rail">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <div className="relative mt-6 md:mt-10">
        <div
          className="absolute bottom-0 left-0 top-0 hidden w-0.5 rounded bg-fg/10 md:block"
          aria-hidden="true"
        >
          <div ref={railRef} className="chapter-progress absolute inset-0" />
        </div>
        <ol className="flex gap-2 md:flex-col md:gap-1 md:pl-5">
          {beats.map((b, i) => (
            <li key={b.n}>
              <div
                className={cn(
                  "flex items-baseline gap-3 rounded-full px-3 py-2 md:rounded-2xl",
                  "transition-[background-color,color,opacity] duration-300",
                  i === step ? "bg-fg/10 text-fg" : "text-muted opacity-70",
                )}
              >
                <span className="text-[10px] font-medium tabular-nums text-accent">{b.n}</span>
                <span className="text-sm font-medium">{b.title}</span>
                <span className="hidden text-xs text-subtle md:inline">{b.hint}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

function Door({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Keyboard;
  label: string;
  detail: string;
}) {
  return (
    <article className="glass flex min-h-36 flex-col rounded-[28px] p-6">
      <Icon className="size-5 text-accent" aria-hidden="true" />
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
    </article>
  );
}

export function HowSection() {
  const { ref, railRef, step } = useChapterBeat("how", HOW_BEATS.length);
  return (
    <section id="how" ref={ref} className="chapter scroll-mt-24">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[minmax(0,280px)_1fr]">
        <Rail
          kicker="How it works"
          title="Name. Match. Split."
          beats={HOW_BEATS}
          step={step}
          railRef={railRef}
        />
        <div className="min-w-0 px-4 sm:px-6">
          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 01
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Say the record.
              <br />
              Don’t describe the vibe.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Aural needs a title, not “that tropical song from 2015.” Type it, speak it, or tap a
              known chip. Lean On is enough.
            </p>
            <div className="glass-strong mt-8 flex items-center gap-3 rounded-full p-2 pl-5">
              <span className="font-mono text-sm text-fg">Lean On Major Lazer</span>
              <span className="caret-blink h-4 w-px bg-accent" aria-hidden="true" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Door
                icon={Keyboard}
                label="Type"
                detail="Title and artist in one field. Slash focuses the box."
              />
              <Door
                icon={Mic}
                label="Speak"
                detail="Tap the mic, say the song, tap again. It becomes text."
              />
              <Door
                icon={Pointer}
                label="Tap"
                detail="The atlas chips below are real recordings, already mapped."
              />
            </div>
          </Scene>

          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 02
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Match the recording,
              <br />
              not a mood board.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Public catalogs return artwork, year, and a store tag. That tag is a shelf label —
              useful for shops, too wide to be a lineage.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-[9rem_1fr]">
              <div className="glass flex aspect-square items-end rounded-[28px] p-4 text-accent">
                <div className="eq h-10" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <article className="glass rounded-[28px] p-6">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Catalog hit
                </div>
                <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
                  Lean On
                </div>
                <p className="mt-1 text-sm text-muted">Major Lazer, DJ Snake, MØ · 2015</p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-fg/10 px-3 py-1 text-xs">Store tag: Dance</span>
                  <span className="text-xs text-subtle">too broad to keep</span>
                </div>
              </article>
            </div>
          </Scene>

          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 03
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Split the shelf label
              <br />
              into three rungs.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Genre is the family. Subgenre is the room. Microgenre is the night. None of them may
              repeat — that was the Lean On bug, and it is banned.
            </p>
            <ol className="mt-8 grid gap-3">
              <li className="glass grid gap-2 rounded-[28px] p-5 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Genre
                </span>
                <span className="font-display text-2xl font-semibold">EDM</span>
                <span className="text-sm text-muted">the festival family</span>
              </li>
              <li className="glass grid gap-2 rounded-[28px] p-5 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Subgenre
                </span>
                <span className="font-display text-2xl font-semibold">Tropical House</span>
                <span className="text-sm text-muted">the room inside EDM</span>
              </li>
              <li className="glass grid gap-2 rounded-[28px] p-5 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Microgenre
                </span>
                <span className="font-display text-2xl font-semibold">Moombahton</span>
                <span className="text-sm text-muted">the scene, not a repeat</span>
              </li>
            </ol>
          </Scene>
        </div>
      </div>
    </section>
  );
}

const LINEAGE_BEATS = [
  { n: "01", title: "Collapse", hint: "Same word three times" },
  { n: "02", title: "Rooms", hint: "House has corners" },
  { n: "03", title: "Proof", hint: "Six mapped records" },
] as const;

export function LineageSection() {
  const { ref, railRef, step } = useChapterBeat("lineage", LINEAGE_BEATS.length);
  return (
    <section id="lineage" ref={ref} className="chapter scroll-mt-24">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[minmax(0,280px)_1fr]">
        <Rail
          kicker="The ladder"
          title="Subgenre is not microgenre."
          beats={LINEAGE_BEATS}
          step={step}
          railRef={railRef}
        />
        <div className="min-w-0 px-4 sm:px-6">
          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 01
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Dance / Dance / Dance
              <br />
              is not a map.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Catalogs collapse Lean On into one bucket. Aural has to refuse that and lift the track
              into a real ladder. Same label on two rungs is treated as a defect.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="glass rounded-[28px] p-6 opacity-60">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-subtle">
                  Rejected
                </div>
                <ul className="mt-4 space-y-3 font-display text-2xl font-semibold tracking-tight line-through">
                  <li>Dance</li>
                  <li>Dance</li>
                  <li>Dance</li>
                </ul>
              </article>
              <article className="glass-strong rounded-[28px] p-6">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
                  Kept
                </div>
                <ul className="mt-4 space-y-3 font-display text-2xl font-semibold tracking-tight">
                  <li>EDM</li>
                  <li>Tropical House</li>
                  <li>Moombahton</li>
                </ul>
              </article>
            </div>
          </Scene>

          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 02
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              House is a room.
              <br />
              The corners are the scene.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Tech house, deep house, tropical house — same family, different nights. Lean On sits
              in tropical house, then moombahton. That last step is the microgenre.
            </p>
            <div className="mt-8">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                EDM → House
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {HOUSE_CORNERS.map((name) => {
                  const on = name === "Tropical House";
                  return (
                    <span
                      key={name}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm",
                        on ? "bg-fg text-bg" : "glass-thin text-fg",
                      )}
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
              <div className="mt-6 glass rounded-[28px] p-6">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Lean On lands here
                </div>
                <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
                  Tropical House → Moombahton
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Moombahton is house at a dembow clip. It is not “house” again, and it is not “EDM”
                  again.
                </p>
              </div>
            </div>
          </Scene>

          <Scene>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Beat 03
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              The rule, six times.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Every row is three different words. Read down a column and you get family, room,
              scene.
            </p>
            <div className="mt-8 overflow-hidden rounded-[28px] glass">
              <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_1fr] gap-3 border-b border-line px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted sm:grid">
                <span>Track</span>
                <span>Genre</span>
                <span>Subgenre</span>
                <span>Microgenre</span>
              </div>
              {WORKED.map((row) => (
                <div
                  key={row.title}
                  className="grid gap-1 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1.2fr_0.8fr_1fr_1fr] sm:items-baseline"
                >
                  <div>
                    <div className="font-display text-lg font-semibold tracking-tight">
                      {row.title}
                    </div>
                    <div className="text-xs text-subtle">{row.artist}</div>
                  </div>
                  <div className="text-sm">{row.genre}</div>
                  <div className="text-sm">{row.sub}</div>
                  <div className="text-sm text-accent">{row.micro}</div>
                </div>
              ))}
            </div>
          </Scene>
        </div>
      </div>
    </section>
  );
}

export function AtlasSection({
  onPick,
  disabled,
}: {
  onPick: (query: string) => void;
  disabled: boolean;
}) {
  const ref = useTrackedSection<HTMLElement>("atlas");
  return (
    <section
      id="atlas"
      ref={ref}
      className="mx-auto min-h-dvh max-w-6xl scroll-mt-24 px-4 py-32 sm:px-6"
    >
      <Reveal as="p" className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        Atlas
      </Reveal>
      <Reveal
        as="h2"
        stagger={1}
        className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl"
      >
        Try a known recording
      </Reveal>
      <Reveal as="p" stagger={2} className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
        Each plate maps a real track. Results land under the tool, then you can keep scrolling.
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex, i) => (
          <Reveal
            as="button"
            key={ex.q}
            stagger={3 + i}
            type="button"
            onClick={() => {
              onPick(ex.q);
            }}
            disabled={disabled}
            className={cn(
              "glass group min-h-36 rounded-[32px] p-7 text-left",
              "transition-[scale,background-color] duration-150 ease-out",
              "hover:bg-fg/5 active:scale-[0.96] disabled:opacity-50",
            )}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-6 font-display text-2xl font-semibold tracking-tight">
              {ex.label}
            </div>
            <div className="mt-2 text-sm text-muted">Map this lineage</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section
      id="about"
      className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6"
    >
      <Reveal as="p" className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        About
      </Reveal>
      <Reveal
        as="h2"
        stagger={1}
        className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl"
      >
        Built as a listening instrument
      </Reveal>
      <Reveal as="p" stagger={2} className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
        Aural is a single-page taxonomy tool: name a song, read the lineage, keep scrolling. No
        accounts. Recent maps stay on this device.
      </Reveal>
    </section>
  );
}

export function ScrollCue({ target = "how" }: { target?: string }) {
  const lenis = useLenis();
  return (
    <button
      type="button"
      onClick={() => {
        scrollToId(target, lenis, -40, 1.2);
      }}
      className="mx-auto flex min-h-11 flex-col items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
    >
      Scroll
      <ChevronDown className="scroll-cue size-4" />
    </button>
  );
}
