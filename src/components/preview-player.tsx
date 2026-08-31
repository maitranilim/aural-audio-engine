import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PREVIEW_LOAD_TIMEOUT_MS = 12_000;

function clearPreviewTimer(timerRef: { current: number | null }) {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function PreviewPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const loadTimerRef = useRef<number | null>(null);
  const statusId = useId();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    requestRef.current += 1;
    setPlaying(false);
    setLoading(false);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
    clearPreviewTimer(loadTimerRef);

    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    return () => {
      requestRef.current += 1;
      clearPreviewTimer(loadTimerRef);
    };
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      const nextCurrentTime = Number.isFinite(el.currentTime) ? Math.max(0, el.currentTime) : 0;
      const nextDuration = Number.isFinite(el.duration) ? Math.max(0, el.duration) : 0;
      setCurrentTime(nextCurrentTime);
      setDuration(nextDuration);
      setProgress(nextDuration > 0 ? Math.min(1, Math.max(0, nextCurrentTime / nextDuration)) : 0);
    };
    const onLoadedMetadata = () => {
      clearPreviewTimer(loadTimerRef);
      const nextDuration = Number.isFinite(el.duration) ? Math.max(0, el.duration) : 0;
      setDuration(nextDuration);
      setLoading(false);
    };
    const onCanPlay = () => {
      clearPreviewTimer(loadTimerRef);
      setLoading(false);
    };
    const onPlaying = () => {
      clearPreviewTimer(loadTimerRef);
      setLoading(false);
      setPlaying(true);
      setError(null);
    };
    const onPause = () => {
      clearPreviewTimer(loadTimerRef);
      setPlaying(false);
    };
    const onWaiting = () => {
      setLoading(true);
      clearPreviewTimer(loadTimerRef);
      const requestId = requestRef.current;
      loadTimerRef.current = window.setTimeout(() => {
        if (requestRef.current !== requestId) return;
        el.pause();
        setPlaying(false);
        setLoading(false);
        setError("This preview took too long to load. Try again.");
      }, PREVIEW_LOAD_TIMEOUT_MS);
    };
    const onEnded = () => {
      clearPreviewTimer(loadTimerRef);
      setPlaying(false);
      setLoading(false);
      setCurrentTime(Number.isFinite(el.duration) ? Math.max(0, el.duration) : 0);
      setProgress(1);
    };
    const onError = () => {
      clearPreviewTimer(loadTimerRef);
      setPlaying(false);
      setLoading(false);
      setError("This preview could not be loaded. Try again.");
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      clearPreviewTimer(loadTimerRef);
    };
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (playing || !el.paused) {
      requestRef.current += 1;
      clearPreviewTimer(loadTimerRef);
      el.pause();
      setPlaying(false);
      setLoading(false);
      return;
    }

    if (loading) {
      requestRef.current += 1;
      clearPreviewTimer(loadTimerRef);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setError(null);
    setLoading(true);
    loadTimerRef.current = window.setTimeout(() => {
      if (requestRef.current !== requestId) return;
      el.pause();
      setPlaying(false);
      setLoading(false);
      setError("This preview took too long to load. Try again.");
    }, PREVIEW_LOAD_TIMEOUT_MS);

    try {
      if (el.error) el.load();
      await el.play();
      if (requestRef.current === requestId) {
        clearPreviewTimer(loadTimerRef);
        setLoading(false);
        setPlaying(true);
      }
    } catch (reason) {
      if (requestRef.current !== requestId) return;
      clearPreviewTimer(loadTimerRef);
      setPlaying(false);
      setLoading(false);
      setError(
        reason instanceof DOMException && reason.name === "NotAllowedError"
          ? "Playback was blocked. Press play again to retry."
          : "This preview could not be loaded. Try again.",
      );
    }
  };

  const formatTime = (value: number) => {
    const seconds = Math.max(0, Math.floor(value));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const percentage = Math.round(progress * 100);
  const timeLabel = `${formatTime(currentTime)} of ${duration > 0 ? formatTime(duration) : "unknown duration"}`;
  const status = loading ? "Loading preview" : playing ? "Playing preview" : "Preview ready";
  const buttonLabel = error
    ? `Retry preview of ${title}`
    : loading
      ? `Loading preview of ${title}`
      : playing
        ? `Pause preview of ${title}`
        : `Play preview of ${title}`;

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="none" aria-label={`Audio preview of ${title}`} />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-busy={loading}
        aria-pressed={playing}
        aria-describedby={statusId}
        aria-label={buttonLabel}
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center rounded-full",
          "glass-strong text-fg transition-[scale,background-color] duration-150 ease-out",
          "active:scale-[0.96] disabled:cursor-wait disabled:opacity-70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        {loading ? (
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : error ? (
          <RotateCcw className="size-4" aria-hidden="true" />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">Preview</span>
          <span className="text-xs tabular-nums text-subtle" aria-label={timeLabel}>
            {formatTime(currentTime)}
            {duration > 0 ? ` / ${formatTime(duration)}` : ""}
          </span>
          <span
            className="eq text-accent"
            data-active={playing ? "true" : "false"}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-fg/10"
          role="progressbar"
          aria-label={`Preview progress for ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          aria-valuetext={timeLabel}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {error ? (
          <p id={statusId} className="mt-1 text-xs text-accent" role="alert">
            {error}
          </p>
        ) : (
          <span
            id={statusId}
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
