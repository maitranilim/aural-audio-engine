import { createFileRoute } from "@tanstack/react-router";
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
import { hasOnboarded, Onboarding } from "@/components/onboarding";
import { classifyTrack, transcribeClip } from "@/lib/classify";
import { EXAMPLES } from "@/lib/constants";
import { clearHistory, loadHistory, pushHistory } from "@/lib/history";
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
  const [tour, setTour] = useState(false);
  const [docked, setDocked] = useState(false);
  const recRef = useRef<ActiveRecording | null>(null);
  const stoppingRef = useRef(false);
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
      if (lenis) lenis.scrollTo("#result", { offset: -96, duration: 1.15 });
      else
        document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [lenis]);

  const runClassify = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      setQuery(q);
      setMode("classifying");
      try {
        const result = await classifyTrack({ data: { query: q } });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const mapped = ensureDistinct(result.classification);
        setClassification(mapped);
        setCatalog(result.catalog);
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
        toast.error(err instanceof Error ? err.message : "Classification failed");
      } finally {
        setMode("idle");
      }
    },
    [goResult],
  );

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

        {classification ? (
          <section
            id="result"
            className="mx-auto flex min-h-dvh max-w-6xl scroll-mt-28 flex-col justify-center px-4 py-24 sm:px-6"
          >
            <div className="flex flex-col gap-8">
              <ResultView
                key={`${classification.title}-${classification.artist}`}
                classification={classification}
                catalog={catalog}
                onSimilar={(q) => void runClassify(q)}
              />
              <HistoryRail
                items={history}
                onPick={(item) => {
                  setQuery(item.query);
                  setClassification(ensureDistinct(item.classification));
                  setCatalog(item.catalog);
                  goResult();
                }}
                onClear={() => setHistory(clearHistory())}
              />
            </div>
          </section>
        ) : (
          <div id="result" className="sr-only" />
        )}

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
