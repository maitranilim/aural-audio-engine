import { createFileRoute } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useLenis } from "lenis/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Atmosphere } from "@/components/atmosphere";
import { ComparisonView } from "@/components/comparison-view";
import { HistoryRail } from "@/components/history-rail";
import {
  AboutSection,
  AtlasSection,
  HowSection,
  LineageSection,
  ScrollCue,
} from "@/components/page-sections";
import { ResultView } from "@/components/result-view";
import { SavedMenu } from "@/components/saved-menu";
import { SearchDock } from "@/components/search-dock";
import { SiteHeader } from "@/components/site-header";
import { useTrackedSection } from "@/lib/use-scroll-reveal";
import { Onboarding } from "@/components/onboarding";
import { classifyTrack, recognizeClip } from "@/lib/classify";
import { EXAMPLES } from "@/lib/constants";
import { clearHistory, loadHistory, pushHistory } from "@/lib/history";
import { hasOnboarded } from "@/lib/onboarding";
import { scrollToId } from "@/lib/scroll-to";
import { isSaved, loadSaved, removeSaved, toggleSaved } from "@/lib/saved";
import { beginRecording, blobToBase64, toWav, type ActiveRecording } from "@/lib/speech";
import { ensureDistinct } from "@/lib/taxonomy";
import type { CatalogHit, Classification, ClassifyOk, HistoryItem } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

/**
 * The mic meter updates ~20×/s. Routing that through React state would
 * re-render the whole page each tick, which stutters on phones; a CSS custom
 * property repaints only the ring that reads it.
 */
function setMicLevel(level: number) {
  document.documentElement.style.setProperty("--mic-level", level.toFixed(3));
}

type Mode = "idle" | "listening" | "recording" | "transcribing" | "classifying";

/** Long enough for a fingerprint to lock on, short enough to feel instant. */
const LISTEN_MAX_MS = 12_000;
/** A spoken title can end the clip early, but never before this. */
const LISTEN_MIN_MS = 5_000;

type CompareBase = {
  query: string;
  classification: Classification;
};

function Home() {
  const lenis = useLenis();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [heardSpeech, setHeardSpeech] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LISTEN_MAX_MS / 1000);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [catalog, setCatalog] = useState<CatalogHit | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryQuery, setRetryQuery] = useState("");
  const [tour, setTour] = useState(false);
  const [docked, setDocked] = useState(false);
  const [compareBase, setCompareBase] = useState<CompareBase | null>(null);
  const [saved, setSaved] = useState<HistoryItem[]>([]);
  const recRef = useRef<ActiveRecording | null>(null);
  const stoppingRef = useRef(false);
  const requestIdRef = useRef(0);
  const sharedQueryRef = useRef(false);
  // `mode` only flips to "recording" after getUserMedia resolves, so it cannot
  // gate the mic button while the permission prompt is open. This can.
  const startingRef = useRef(false);
  const listenStartRef = useRef(0);
  const toolRef = useTrackedSection<HTMLElement>("tool");

  useEffect(() => {
    setHistory(
      loadHistory().map((item) => ({
        ...item,
        classification: ensureDistinct(item.classification),
      })),
    );
  }, []);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  useLayoutEffect(() => {
    setTour(!hasOnboarded());
  }, []);

  useEffect(() => {
    const hero = document.getElementById("tool");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting), {
      threshold: 0.28,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!lenis) return;
    if (tour) lenis.stop();
    else lenis.start();
  }, [lenis, tour]);

  const goResult = useCallback(() => {
    window.requestAnimationFrame(() => {
      scrollToId("result", lenis, -96, 1.15);
      window.requestAnimationFrame(() => {
        document.getElementById("result-title")?.focus({ preventScroll: true });
      });
    });
  }, [lenis]);

  const showResult = useCallback(
    (q: string, result: ClassifyOk) => {
      const mapped = ensureDistinct(result.classification);
      setClassification(mapped);
      setCatalog(result.catalog);
      const url = new URL(window.location.href);
      url.searchParams.set("q", q);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      const item: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: Date.now(),
        query: q,
        classification: mapped,
        catalog: result.catalog,
      };
      setHistory(pushHistory(item));
      goResult();
    },
    [goResult],
  );

  const runClassify = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      const requestId = ++requestIdRef.current;
      setQuery(q);
      setMode("classifying");
      setErrorMessage(null);
      setRetryQuery(q);
      setClassification(null);
      setCatalog(null);
      try {
        const result = await classifyTrack({ data: { query: q } });
        if (requestId !== requestIdRef.current) return;
        if (!result.ok) {
          setErrorMessage(result.error);
          return;
        }
        showResult(q, result);
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setErrorMessage(err instanceof Error ? err.message : "Classification failed");
        }
      } finally {
        if (requestId === requestIdRef.current) setMode("idle");
      }
    },
    [showResult],
  );

  useEffect(() => {
    if (sharedQueryRef.current) return;
    sharedQueryRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("q")?.trim();
    const compare = params.get("compare")?.trim();
    if (compare && compare !== shared) {
      void classifyTrack({ data: { query: compare } }).then((result) => {
        if (result.ok) {
          setCompareBase({
            query: compare,
            classification: ensureDistinct(result.classification),
          });
        }
      });
    }
    if (shared) void runClassify(shared);
  }, [runClassify]);

  const finishRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    const rec = recRef.current;
    if (!rec) return;
    stoppingRef.current = true;
    recRef.current = null;
    const requestId = ++requestIdRef.current;
    setMode("transcribing");
    setMicLevel(0);
    try {
      const captured = await rec.stop();
      if (captured.blob.size < 200) {
        toast.error("Didn't catch any audio. Tap the mic while the song plays.");
        setMode("idle");
        return;
      }
      let payload = captured;
      let peak = 1;
      let durationSec = 0;
      try {
        const wav = await toWav(captured.blob);
        payload = { blob: wav.blob, mimeType: wav.mimeType };
        peak = wav.peak;
        durationSec = wav.durationSec;
      } catch {
        /* send the original clip */
      }
      if (durationSec > 0 && durationSec < 1) {
        toast.error("That was too short. Let it listen for a few seconds.");
        setMode("idle");
        return;
      }
      // Only digital silence is worth refusing to send. A quiet-but-audible
      // clip still has a fingerprint, and the mic is provably granted by now.
      if (peak < 0.005) {
        toast.error("No sound came through. Check your input device and try again.");
        setMode("idle");
        return;
      }
      const audioBase64 = await blobToBase64(payload.blob);
      const recognized = await recognizeClip({
        data: { audioBase64, mimeType: payload.mimeType },
      });
      if (requestId !== requestIdRef.current) return;
      if (!recognized.ok) {
        toast.error(recognized.error);
        setMode("idle");
        return;
      }
      setQuery(recognized.heard);
      setErrorMessage(null);
      setRetryQuery(recognized.heard);
      showResult(recognized.heard, recognized);
      toast.success(
        recognized.via === "fingerprint"
          ? `Recognized “${recognized.classification.title}” by ${recognized.classification.artist}`
          : `Heard “${recognized.heard}”`,
      );
      setMode("idle");
    } catch {
      if (requestId === requestIdRef.current) {
        toast.error("Couldn't identify that clip. Type the song instead.");
        setMode("idle");
      }
    } finally {
      stoppingRef.current = false;
    }
  }, [showResult]);

  const onMic = useCallback(() => {
    if (mode === "recording") {
      void finishRecording();
      return;
    }
    if (mode !== "idle" || startingRef.current) return;
    startingRef.current = true;
    void (async () => {
      try {
        // The recorder owns voice-end detection and the 20s cap, so the UI can
        // never disagree with it about whether the mic is still open.
        setHeardSpeech(false);
        setSecondsLeft(LISTEN_MAX_MS / 1000);
        setMicLevel(0);
        setClassification(null);
        setCatalog(null);
        setErrorMessage(null);
        listenStartRef.current = Date.now();
        const rec = await beginRecording({
          maxMs: LISTEN_MAX_MS,
          minMs: LISTEN_MIN_MS,
          onVoiceStart: () => setHeardSpeech(true),
          onLevel: setMicLevel,
          onAutoStop: () => {
            if (recRef.current === rec) void finishRecording();
          },
        });
        recRef.current = rec;
        setMode("recording");
      } catch (err) {
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        toast.error(
          denied
            ? "Microphone permission was denied. Allow it, or type the title."
            : window.isSecureContext
              ? "Microphone isn't available. Type the song instead."
              : "The mic needs a secure (https) connection. Type the song instead.",
        );
        setMode("idle");
      } finally {
        startingRef.current = false;
      }
    })();
  }, [finishRecording, mode]);

  useEffect(() => {
    if (mode !== "recording") return;
    const tick = () =>
      setSecondsLeft(
        Math.max(0, Math.ceil((LISTEN_MAX_MS - (Date.now() - listenStartRef.current)) / 1000)),
      );
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [mode]);

  const hint =
    mode === "recording"
      ? heardSpeech
        ? `Hearing it — tap stop anytime · ${secondsLeft}s`
        : `Listening — play the song or say its name · ${secondsLeft}s`
      : mode === "transcribing"
        ? "Identifying the track"
        : mode === "classifying"
          ? "Mapping genre, subgenre, and microgenre"
          : undefined;

  const search = (
    <SearchDock
      value={query}
      onChange={setQuery}
      onSubmit={() => void runClassify(query)}
      onMic={onMic}
      mode={mode}
      hint={hint}
      listenMs={LISTEN_MAX_MS}
    />
  );

  const pinForComparison = useCallback(() => {
    if (!classification) return;
    const compareQuery = query || `${classification.title} ${classification.artist}`;
    setCompareBase({ query: compareQuery, classification });
    const url = new URL(window.location.href);
    url.searchParams.set("compare", compareQuery);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    toast.success("Pinned. Search another track to compare its lineage.");
    scrollToId("tool", lenis, -24, 0.85);
    window.setTimeout(
      () => document.querySelector<HTMLInputElement>('input[name="query"]')?.focus(),
      500,
    );
  }, [classification, lenis, query]);

  const isCompareBase = Boolean(
    compareBase &&
    classification &&
    compareBase.classification.title.toLocaleLowerCase() ===
      classification.title.toLocaleLowerCase() &&
    compareBase.classification.artist.toLocaleLowerCase() ===
      classification.artist.toLocaleLowerCase(),
  );

  const currentIsSaved = Boolean(classification && isSaved(saved, classification));

  const toggleCurrentSaved = useCallback(() => {
    if (!classification) return;
    const item: HistoryItem = {
      id: `saved-${Date.now()}`,
      savedAt: Date.now(),
      query: query || `${classification.title} ${classification.artist}`,
      classification,
      catalog,
    };
    const wasSaved = isSaved(saved, classification);
    setSaved(toggleSaved(item));
    toast.success(wasSaved ? "Removed from saved mappings." : "Saved for your next visit.");
  }, [catalog, classification, query, saved]);

  const openStoredMapping = useCallback(
    (item: HistoryItem) => {
      setQuery(item.query);
      setClassification(ensureDistinct(item.classification));
      setCatalog(item.catalog);
      setErrorMessage(null);
      goResult();
    },
    [goResult],
  );

  const removeStoredMapping = useCallback((item: HistoryItem) => {
    setSaved(removeSaved(item));
    toast.success("Removed from saved mappings.");
  }, []);

  const clearComparison = useCallback(() => {
    setCompareBase(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("compare");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <Atmosphere genre={classification?.genre} />
      <div className="relative z-10">
        <SiteHeader
          docked={docked}
          savedMenu={
            <SavedMenu items={saved} onPick={openStoredMapping} onRemove={removeStoredMapping} />
          }
          compactSearch={
            <SearchDock
              value={query}
              onChange={setQuery}
              onSubmit={() => void runClassify(query)}
              onMic={onMic}
              mode={mode}
              compact
            />
          }
        />

        <section id="tool" ref={toolRef} className="hero-cluster flex min-h-dvh flex-col">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Genre · Subgenre · Microgenre
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Name a song.
              <br />
              See its lineage.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
              Type a title, tap a chip, or tap the mic while a song plays. Then scroll the method.
            </p>
            <div className="mt-7">{search}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 4).map((ex) => (
                <button
                  key={ex.q}
                  type="button"
                  onClick={() => void runClassify(ex.q)}
                  disabled={mode !== "idle"}
                  className="glass-thin h-11 rounded-full px-4 text-sm text-fg will-change-transform transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-fg/10 hover:shadow-glass-hover active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto pb-8">
            <ScrollCue target={classification ? "result" : "how"} />
          </div>
        </section>

        <section
          id="result"
          aria-live="polite"
          aria-busy={mode === "classifying" || mode === "transcribing"}
          className={
            classification || errorMessage || mode === "classifying" || mode === "transcribing"
              ? "mx-auto flex min-h-dvh w-full max-w-6xl scroll-mt-28 flex-col justify-center px-4 py-24 sm:px-6"
              : "mx-auto h-0 w-full max-w-6xl scroll-mt-28 overflow-hidden px-4 sm:px-6"
          }
        >
          <p className="sr-only" role="status">
            {classification
              ? `Mapping ready for ${classification.title} by ${classification.artist}`
              : mode === "classifying" || mode === "transcribing"
                ? mode === "transcribing"
                  ? "Listening in progress"
                  : "Mapping in progress"
                : errorMessage
                  ? "Mapping failed"
                  : ""}
          </p>
          {mode === "classifying" || mode === "transcribing" ? (
            <div className="glass mx-auto flex w-full max-w-2xl items-center gap-4 rounded-[32px] p-6 sm:p-8">
              <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden="true" />
              <div>
                <p className="font-display text-xl font-semibold tracking-tight">
                  {mode === "transcribing" ? "Identifying the track" : "Reading the shelf"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {mode === "transcribing"
                    ? "Matching the audio fingerprint, then separating genre, subgenre, and microgenre."
                    : "Matching the recording, then separating its three rungs."}
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div role="alert" className="glass mx-auto w-full max-w-2xl rounded-[32px] p-6 sm:p-8">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-danger">
                Mapping paused
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                The shelf did not answer.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void runClassify(retryQuery)}
                disabled={!retryQuery || mode !== "idle"}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-fg px-5 text-sm font-medium text-bg transition-[scale,opacity] duration-150 active:scale-[0.96] disabled:opacity-50"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : classification ? (
            <div className="flex flex-col gap-8">
              <ResultView
                key={`${classification.title}-${classification.artist}`}
                classification={classification}
                catalog={catalog}
                query={query}
                onSimilar={(q) => void runClassify(q)}
                onCompare={pinForComparison}
                isCompareBase={isCompareBase}
                onToggleSaved={toggleCurrentSaved}
                isSaved={currentIsSaved}
              />
              {compareBase ? (
                <ComparisonView
                  base={compareBase}
                  current={classification}
                  currentQuery={query}
                  onClear={clearComparison}
                />
              ) : null}
              <HistoryRail
                items={history}
                onPick={(item) => {
                  setQuery(item.query);
                  setClassification(ensureDistinct(item.classification));
                  setCatalog(item.catalog);
                  setErrorMessage(null);
                  goResult();
                }}
                onClear={() => setHistory(clearHistory())}
              />
            </div>
          ) : null}
        </section>

        <HowSection />
        <LineageSection />
        <AtlasSection onPick={(q) => void runClassify(q)} disabled={mode !== "idle"} />
        <AboutSection onReplayIntro={() => setTour(true)} />

        <footer className="pb-16 text-center text-xs text-subtle">
          Made by{" "}
          <a
            href="https://x.com/confid_sh"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-fg"
            aria-label="confid on X (opens in a new tab)"
          >
            confid
          </a>
        </footer>
      </div>
      {tour ? (
        <Onboarding
          onDone={() => setTour(false)}
          onTryExample={() => void runClassify(EXAMPLES[0].q)}
        />
      ) : null}
    </main>
  );
}
