import { createFileRoute } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useLenis } from "lenis/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Atmosphere } from "@/components/atmosphere";
import { HistoryRail } from "@/components/history-rail";
import {
  AboutSection,
  AtlasSection,
  HowSection,
  LineageSection,
  ScrollCue,
} from "@/components/page-sections";
import { ResultView } from "@/components/result-view";
import { SearchDock } from "@/components/search-dock";
import { SiteHeader } from "@/components/site-header";
import { useTrackedSection } from "@/lib/use-scroll-reveal";
import { Onboarding } from "@/components/onboarding";
import { classifyTrack, transcribeClip } from "@/lib/classify";
import { EXAMPLES } from "@/lib/constants";
import { clearHistory, loadHistory, pushHistory } from "@/lib/history";
import { hasOnboarded } from "@/lib/onboarding";
import { scrollToId } from "@/lib/scroll-to";
import { beginRecording, blobToBase64, toWav, type ActiveRecording } from "@/lib/speech";
import { ensureDistinct } from "@/lib/taxonomy";
import type { CatalogHit, Classification, HistoryItem } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

type Mode = "idle" | "listening" | "recording" | "transcribing" | "classifying";

function Home() {
  const lenis = useLenis();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [seconds, setSeconds] = useState(0);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [catalog, setCatalog] = useState<CatalogHit | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryQuery, setRetryQuery] = useState("");
  const [tour, setTour] = useState(false);
  const [docked, setDocked] = useState(false);
  const recRef = useRef<ActiveRecording | null>(null);
  const stoppingRef = useRef(false);
  const requestIdRef = useRef(0);
  const sharedQueryRef = useRef(false);
  // `mode` only flips to "recording" after getUserMedia resolves, so it cannot
  // gate the mic button while the permission prompt is open. This can.
  const startingRef = useRef(false);
  const toolRef = useTrackedSection<HTMLElement>("tool");

  useEffect(() => {
    setHistory(
      loadHistory().map((item) => ({
        ...item,
        classification: ensureDistinct(item.classification),
      })),
    );
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

  useEffect(() => {
    if (mode !== "recording") {
      setSeconds(0);
      return;
    }
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const goResult = useCallback(() => {
    window.requestAnimationFrame(() => {
      scrollToId("result", lenis, -96, 1.15);
      window.requestAnimationFrame(() => {
        document.getElementById("result-title")?.focus({ preventScroll: true });
      });
    });
  }, [lenis]);

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
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setErrorMessage(err instanceof Error ? err.message : "Classification failed");
        }
      } finally {
        if (requestId === requestIdRef.current) setMode("idle");
      }
    },
    [goResult],
  );

  useEffect(() => {
    if (sharedQueryRef.current) return;
    sharedQueryRef.current = true;
    const shared = new URLSearchParams(window.location.search).get("q")?.trim();
    if (shared) void runClassify(shared);
  }, [runClassify]);

  const finishRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    const rec = recRef.current;
    if (!rec) return;
    stoppingRef.current = true;
    recRef.current = null;
    setMode("transcribing");
    try {
      const captured = await rec.stop();
      if (captured.blob.size < 200) {
        toast.error("Didn't catch any audio. Tap the mic, speak, then tap again.");
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
      if (durationSec > 0 && durationSec < 0.35) {
        toast.error("That was too short. Hold the mic open while you say the song.");
        setMode("idle");
        return;
      }
      // Only digital silence is worth refusing to send. A quiet-but-audible
      // clip still transcribes, and the mic is provably granted by this point,
      // so the old "check permission" advice pointed at the wrong thing.
      if (peak < 0.005) {
        toast.error("No sound came through. Check your input device and try again.");
        setMode("idle");
        return;
      }
      const audioBase64 = await blobToBase64(payload.blob);
      const transcribed = await transcribeClip({
        data: { audioBase64, mimeType: payload.mimeType },
      });
      if (transcribed.ok && transcribed.text) {
        setQuery(transcribed.text);
        await runClassify(transcribed.text);
        return;
      }
      toast.error(transcribed.ok ? "Didn't catch any words." : transcribed.error);
      setMode("idle");
    } catch {
      toast.error("Recording failed. Type the song instead.");
      setMode("idle");
    } finally {
      stoppingRef.current = false;
    }
  }, [runClassify]);

  const onMic = useCallback(() => {
    if (mode === "recording") {
      void finishRecording();
      return;
    }
    if (mode !== "idle" || startingRef.current) return;
    startingRef.current = true;
    void (async () => {
      try {
        // The recorder owns the 12s cap and tells us when it fires, so the UI
        // can never disagree with it about whether the mic is still open.
        const rec = await beginRecording({
          maxMs: 12000,
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
            : "Microphone isn't available. Type the song instead.",
        );
        setMode("idle");
      } finally {
        startingRef.current = false;
      }
    })();
  }, [finishRecording, mode]);

  const hint =
    mode === "recording"
      ? `Recording ${seconds}s — tap the square when you finish`
      : mode === "transcribing"
        ? "Turning speech into a title"
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
      seconds={seconds}
    />
  );

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <Atmosphere genre={classification?.genre} />
      <div className="relative z-10">
        <SiteHeader
          docked={docked}
          compactSearch={
            <SearchDock
              value={query}
              onChange={setQuery}
              onSubmit={() => void runClassify(query)}
              onMic={onMic}
              mode={mode}
              seconds={seconds}
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
              Type a title, tap a chip, or use the mic. Then scroll the method.
            </p>
            <div className="mt-7">{search}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 4).map((ex) => (
                <button
                  key={ex.q}
                  type="button"
                  onClick={() => void runClassify(ex.q)}
                  disabled={mode !== "idle"}
                  className="glass-thin h-11 rounded-full px-4 text-sm text-fg disabled:opacity-50"
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
                  {mode === "transcribing" ? "Listening for the title" : "Reading the shelf"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {mode === "transcribing"
                    ? "Turning the recording into a searchable song name."
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
              />
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
        <AboutSection />

        <footer className="pb-16 text-center text-xs text-subtle">Made by Nilim</footer>
      </div>
      {tour ? <Onboarding onDone={() => setTour(false)} /> : null}
    </main>
  );
}
