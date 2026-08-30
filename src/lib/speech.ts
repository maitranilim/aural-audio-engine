export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read recording"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

const TARGET_RATE = 16000;

/**
 * Container/codec pairs a MediaRecorder can actually produce, best first.
 *
 * Order matters. Chrome reports `audio/mp4` as supported but muxes **Opus**
 * into it, and an `audio/mp4` upload is read as AAC by the far end — so mp4 is
 * the last resort, taken only by Safari, the one browser where it means AAC.
 * MP3 and WAV are deliberately absent: no browser's MediaRecorder encodes
 * either, so listing them only ever wasted a lookup.
 */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function mixMono(buffer: AudioBuffer): Float32Array {
  const chs = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < chs; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i] / chs;
  }
  return out;
}

/**
 * Average each source window instead of point-sampling it. Dropping samples
 * outright folds everything above the new Nyquist back into the speech band —
 * sibilants become buzz, which is exactly what a transcriber trips over. A box
 * filter is crude but it is a low-pass, and it costs one pass.
 */
function decimate(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / (end - start);
  }
  return out;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, n * 2, true);
  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

type OfflineCtor = typeof OfflineAudioContext;

/**
 * Downmix and resample to `rate` through OfflineAudioContexts.
 *
 * Two passes, and the order is the whole point: an AudioBufferSourceNode
 * resamples by plain interpolation as it plays, so a rate change alone folds
 * everything above the new Nyquist straight back into the speech band — a
 * 14 kHz tone lands on 2 kHz at nearly full amplitude. So band-limit first, at
 * the source rate, and only then change rate.
 *
 * Returns null when the browser will not build a context at `rate` (older
 * Safari rejects rates under 44.1 kHz) so the caller can fall back.
 */
async function renderMonoAt(buffer: AudioBuffer, rate: number): Promise<Float32Array | null> {
  const Offline: OfflineCtor | undefined =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : (window as Window & { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;
  if (!Offline) return null;

  try {
    // Pass 1 — band-limit (and downmix, via the 1-channel destination).
    let source = buffer;
    if (buffer.sampleRate > rate) {
      const guard = new Offline(1, Math.max(1, buffer.length), buffer.sampleRate);
      const node = guard.createBufferSource();
      node.buffer = buffer;
      let tail: AudioNode = node;
      // Three cascaded 12 dB/oct sections ~= 36 dB/oct, enough to bury anything
      // an octave above the cutoff.
      for (let i = 0; i < 3; i++) {
        const lp = guard.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = rate * 0.45;
        lp.Q.value = Math.SQRT1_2;
        tail.connect(lp);
        tail = lp;
      }
      tail.connect(guard.destination);
      node.start();
      source = await guard.startRendering();
    }

    // Pass 2 — the rate change, now that there is nothing left to alias.
    const frames = Math.max(1, Math.ceil(source.duration * rate));
    const offline = new Offline(1, frames, rate);
    const node = offline.createBufferSource();
    node.buffer = source;
    node.connect(offline.destination);
    node.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } catch {
    return null;
  }
}

export type WavClip = { blob: Blob; mimeType: string; peak: number; durationSec: number };

export async function toWav(blob: Blob): Promise<WavClip> {
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    return { blob, mimeType: blob.type || "audio/webm", peak: 1, durationSec: 0 };
  }
  const ctx = new Ctx();
  let audio: AudioBuffer;
  try {
    const raw = await blob.arrayBuffer();
    audio = await ctx.decodeAudioData(raw.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }

  const rate = Math.min(audio.sampleRate, TARGET_RATE);
  const samples =
    (await renderMonoAt(audio, rate)) ?? decimate(mixMono(audio), audio.sampleRate, rate);

  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));

  // The anti-alias cascade can overshoot on an already-hot input. Scaling back
  // to full scale beats letting the encoder hard-clip it into distortion.
  const normalized = peak > 1 ? samples.map((v) => v / peak) : samples;

  return {
    blob: encodeWavMono16(normalized, rate),
    mimeType: "audio/wav",
    peak,
    durationSec: audio.duration,
  };
}

export type ActiveRecording = {
  stop: () => Promise<{ blob: Blob; mimeType: string }>;
};

/**
 * How long to wait for `onstop` after asking the recorder to stop. A recorder
 * whose track already ended can leave that event unfired; without a bound the
 * caller's `await stop()` never returns and the UI wedges mid-transcribe with
 * no error to show. Past this we keep whatever chunks arrived.
 */
const STOP_GRACE_MS = 4000;

export async function beginRecording(
  opts: { maxMs?: number; onAutoStop?: () => void } = {},
): Promise<ActiveRecording> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("NO_MIC");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") throw err;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  const mimeType = pickMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    // A browser can advertise a type through isTypeSupported and still refuse
    // it here. Let it choose its own rather than losing the recording.
    recorder = new MediaRecorder(stream);
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    stream.getTracks().forEach((t) => t.stop());
  };

  const settledType = () => recorder.mimeType || mimeType || "audio/webm";
  const collected = () => ({
    blob: new Blob(chunks, { type: settledType() }),
    mimeType: settledType(),
  });

  const finished = new Promise<{ blob: Blob; mimeType: string }>((resolve, reject) => {
    recorder.onerror = () => {
      release();
      // Chunks already banked are still worth transcribing; only a recording
      // that produced nothing at all is a real failure.
      if (chunks.length > 0) resolve(collected());
      else reject(new Error("Recording failed"));
    };
    recorder.onstop = () => {
      release();
      resolve(collected());
    };
  });

  try {
    recorder.start(250);
  } catch {
    recorder.start();
  }

  let stopOnce: Promise<{ blob: Blob; mimeType: string }> | null = null;
  const stop = () => {
    if (!stopOnce) {
      stopOnce = (async () => {
        if (recorder.state === "inactive") {
          // Already finished (auto-stop, or the track ended under us). Read the
          // chunks directly rather than awaiting `finished`, which has nothing
          // left to fire it.
          release();
          return collected();
        }
        if (recorder.state === "paused") {
          // A paused recorder never fires `stop` on its own; resume first so
          // the flush actually happens.
          try {
            recorder.resume();
          } catch {
            /* already gone */
          }
        }
        try {
          recorder.requestData();
        } catch {
          /* Safari */
        }
        try {
          recorder.stop();
        } catch {
          release();
          return collected();
        }
        // Never let a missing `onstop` strand the caller.
        return Promise.race([
          finished,
          new Promise<{ blob: Blob; mimeType: string }>((resolve) => {
            window.setTimeout(() => {
              release();
              resolve(collected());
            }, STOP_GRACE_MS);
          }),
        ]);
      })();
    }
    return stopOnce;
  };

  // Hard cap on how long the mic stays open, and tell the caller so its UI
  // follows the recorder instead of racing a timer of its own.
  window.setTimeout(() => {
    if (recorder.state === "inactive") return;
    void stop();
    opts.onAutoStop?.();
  }, opts.maxMs ?? 12000);

  return { stop };
}
