export type VoiceActivityState = {
  noiseFloor: number;
  loudFrames: number;
  heardVoice: boolean;
  voiceStartedAt: number;
  lastVoiceAt: number;
};

export type VoiceActivityEvent = "none" | "voice-start" | "speech-end";

export const VOICE_SAMPLE_MS = 50;

const START_FRAMES = 3;
const MIN_VOICE_MS = 450;
const END_SILENCE_MS = 1100;
const MIN_THRESHOLD = 0.018;
const NOISE_MULTIPLIER = 2.8;

export function createVoiceActivityState(): VoiceActivityState {
  return {
    noiseFloor: 0.008,
    loudFrames: 0,
    heardVoice: false,
    voiceStartedAt: 0,
    lastVoiceAt: 0,
  };
}

export function observeVoice(
  previous: VoiceActivityState,
  rms: number,
  now: number,
): { state: VoiceActivityState; event: VoiceActivityEvent } {
  const state = { ...previous };
  const threshold = Math.max(MIN_THRESHOLD, state.noiseFloor * NOISE_MULTIPLIER);
  const loud = rms >= threshold;

  if (!state.heardVoice) {
    if (loud) {
      state.loudFrames += 1;
    } else {
      state.loudFrames = 0;
      state.noiseFloor = state.noiseFloor * 0.92 + rms * 0.08;
    }

    if (state.loudFrames >= START_FRAMES) {
      state.heardVoice = true;
      state.voiceStartedAt = now;
      state.lastVoiceAt = now;
      return { state, event: "voice-start" };
    }
    return { state, event: "none" };
  }

  if (loud) state.lastVoiceAt = now;
  const completePhrase = now - state.voiceStartedAt >= MIN_VOICE_MS;
  if (completePhrase && now - state.lastVoiceAt >= END_SILENCE_MS) {
    return { state, event: "speech-end" };
  }

  return { state, event: "none" };
}
