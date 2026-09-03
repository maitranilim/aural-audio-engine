import { ChevronDown, Keyboard, Mic, Pointer } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EXAMPLES } from "@/lib/constants";
import { scrollToId } from "@/lib/scroll-to";
import { subscribe } from "@/lib/scroll-progress";
import { useTrackedSection } from "@/lib/use-scroll-reveal";
import { cn } from "@/lib/utils";

const HOW_BEATS = [
  { n: "01", title: "Name", hint: "One field is enough" },
  { n: "02", title: "Match", hint: "Find the recording" },
  { n: "03", title: "Split", hint: "Three distinct rungs" },
] as const;

const HOUSE_CORNERS = [
  {
    name: "Tech House",
    branch: "Minimal Tech House",
    recording: "Losing It · FISHER",
    detail: "Punchy drums, clipped bass, and sparse vocal hooks keep the groove in front.",
  },
  {
    name: "Deep House",
    branch: "Soulful Deep House",
    recording: "Can You Feel It · Mr. Fingers",
    detail:
      "Warm chords, restrained drums, and soul-rooted feeling pull house toward its deeper side.",
  },
  {
    name: "Tropical House",
    branch: "Moombahton",
    recording: "Lean On · Major Lazer",
    detail:
      "A bright house palette meets a dembow-leaning swing. The last step names the tighter scene.",
  },
  {
    name: "French House",
    branch: "Filter House",
    recording: "Music Sounds Better with You · Stardust",
    detail: "Disco samples, pumping compression, and sweeping filters define the French-touch branch.",
  },
  {
    name: "Progressive House",
    branch: "Melodic Progressive House",
    recording: "Strobe · deadmau5",
    detail: "Long builds, evolving harmony, and patient release make melody the scene marker.",
  },
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

const WORKED_GROUPS = ["EDM", "Hip-Hop", "Jazz", "Pop"].map((genre) => ({
  genre,
  rows: WORKED.filter((row) => row.genre === genre),
}));

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

function Scene({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="scene">
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
  sectionId,
}: {
  kicker: string;
  title: string;
  beats: readonly { n: string; title: string; hint: string }[];
  step: number;
  railRef: React.RefObject<HTMLDivElement | null>;
  sectionId: string;
}) {
  const lenis = useLenis();
  const [openBeat, setOpenBeat] = useState<number | null>(null);

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
            <li key={b.n} className="min-w-0">
              <button
                type="button"
                aria-expanded={openBeat === i}
                aria-controls={`${sectionId}-beat-note-${i + 1}`}
                onClick={() => {
                  setOpenBeat((current) => (current === i ? null : i));
                  scrollToId(`${sectionId}-beat-${i + 1}`, lenis, -96, 0.85);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-full px-3 py-2 text-left md:rounded-2xl",
                  "transition-[transform,background-color,color,opacity] duration-200 hover:translate-x-1 hover:bg-fg/10 hover:text-fg active:scale-[0.98]",
                  i === step ? "bg-fg/10 text-fg" : "text-muted opacity-70",
                )}
              >
                <span className="text-[10px] font-medium tabular-nums text-accent">{b.n}</span>
                <span className="text-sm font-medium">{b.title}</span>
                <span className="hidden text-xs text-subtle md:inline">{b.hint}</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-3.5 shrink-0 transition-transform md:hidden",
                    openBeat === i && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {openBeat === i ? (
                <p
                  id={`${sectionId}-beat-note-${i + 1}`}
                  className="mx-2 mt-1 rounded-xl bg-fg/5 px-3 py-2 text-xs leading-relaxed text-muted md:hidden"
                >
                  {b.hint}
                </p>
              ) : null}
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
          sectionId="how"
        />
        <div className="min-w-0 px-4 sm:px-6">
          <Scene id="how-beat-1">
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
                detail="Say the song and artist. Aural stops when you finish and maps it."
              />
              <Door
                icon={Pointer}
                label="Tap"
                detail="The atlas chips below are real recordings, already mapped."
              />
            </div>
          </Scene>

          <Scene id="how-beat-2">
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
            <div className="mt-8 grid grid-cols-[6rem_1fr] gap-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <div className="glass flex min-h-32 items-end rounded-[28px] p-4 text-accent sm:aspect-square">
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
                <div className="mt-5 border-t border-line pt-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
                    Aural refines it
                  </div>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-fg">
                    EDM → Tropical House → Moombahton
                  </p>
                </div>
              </article>
            </div>
          </Scene>

          <Scene id="how-beat-3">
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
  const [selectedCorner, setSelectedCorner] = useState<(typeof HOUSE_CORNERS)[number]>(
    HOUSE_CORNERS[2],
  );
  const [expandedGenre, setExpandedGenre] = useState("EDM");
  return (
    <section id="lineage" ref={ref} className="chapter scroll-mt-24">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[minmax(0,280px)_1fr]">
        <Rail
          kicker="The ladder"
          title="Subgenre is not microgenre."
          beats={LINEAGE_BEATS}
          step={step}
          railRef={railRef}
          sectionId="lineage"
        />
        <div className="min-w-0 px-4 sm:px-6">
          <Scene id="lineage-beat-1">
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

          <Scene id="lineage-beat-2">
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
              <div
                className="mt-4 flex flex-wrap gap-2"
                aria-label="Explore corners of house music"
              >
                {HOUSE_CORNERS.map((corner) => {
                  const on = corner.name === selectedCorner.name;
                  return (
                    <button
                      type="button"
                      key={corner.name}
                      aria-pressed={on}
                      onClick={() => setSelectedCorner(corner)}
                      className={cn(
                        "min-h-11 rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                        on ? "bg-fg text-bg" : "glass-thin text-fg hover:bg-fg/10",
                      )}
                    >
                      {corner.name}
                    </button>
                  );
                })}
              </div>
              <div
                className="mt-6 glass rounded-[28px] p-6"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  Example recording
                </div>
                <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
                  {selectedCorner.name} → {selectedCorner.branch}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-accent">
                  {selectedCorner.recording}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {selectedCorner.detail}
                </p>
              </div>
            </div>
          </Scene>

          <Scene id="lineage-beat-3">
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
            <div className="mt-8 space-y-2" aria-label="Mapped recordings by genre">
              {WORKED_GROUPS.map((group) => {
                const expanded = expandedGenre === group.genre;
                const panelId = `worked-${group.genre.toLowerCase()}`;
                return (
                  <div key={group.genre} className="glass overflow-hidden rounded-[24px]">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedGenre(expanded ? "" : group.genre)}
                      className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-fg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className="font-display text-lg font-semibold">{group.genre}</span>
                      <span className="rounded-full bg-fg/10 px-2 py-1 text-[10px] text-muted">
                        {group.rows.length} {group.rows.length === 1 ? "track" : "tracks"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "ml-auto size-4 text-muted transition-transform",
                          expanded && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {expanded ? (
                      <div id={panelId} className="border-t border-line">
                        {group.rows.map((row) => (
                          <article
                            key={row.title}
                            className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1.1fr_1fr_1fr] sm:items-center"
                          >
                            <div>
                              <div className="font-display text-lg font-semibold tracking-tight">
                                {row.title}
                              </div>
                              <div className="text-xs text-subtle">{row.artist}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">
                                Subgenre
                              </div>
                              <div className="mt-1 text-sm">{row.sub}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-subtle">
                                Microgenre
                              </div>
                              <div className="mt-1 text-sm text-accent">{row.micro}</div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        Atlas
      </p>
      <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
        Try a known recording
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
        Each plate maps a real track. Results land under the tool, then you can keep scrolling.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.q}
            type="button"
            onClick={() => {
              onPick(ex.q);
            }}
            disabled={disabled}
            className={cn(
              "glass group min-h-36 rounded-[32px] p-7 text-left",
              "border border-transparent transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out",
              "hover:-translate-y-1 hover:border-accent/40 hover:bg-fg/10 hover:shadow-glass-hover active:translate-y-0 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-6 font-display text-2xl font-semibold tracking-tight">
              {ex.label}
            </div>
            <div className="mt-2 text-sm text-muted">Map this lineage</div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AboutSection({ onReplayIntro }: { onReplayIntro: () => void }) {
  return (
    <section
      id="about"
      className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        About
      </p>
      <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
        Built as a listening instrument
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
        Turn any song into a clear sonic address: genre, subgenre, then microgenre. Save discoveries
        on this device, compare neighboring sounds, and return whenever curiosity strikes.
      </p>
      <button
        type="button"
        onClick={onReplayIntro}
        className="glass-thin mt-7 min-h-11 w-fit rounded-full px-5 text-sm font-medium text-fg transition-[scale,background-color] hover:bg-fg/10 active:scale-[0.97]"
      >
        Replay quick intro
      </button>
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
