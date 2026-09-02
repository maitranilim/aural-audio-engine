import assert from "node:assert/strict";
import test from "node:test";
import { createVoiceActivityState, observeVoice } from "./voice-activity.ts";

test("ignores brief noise and learns a quiet room", () => {
  let state = createVoiceActivityState();
  for (const [index, rms] of [0.006, 0.007, 0.04, 0.006, 0.007].entries()) {
    const observation = observeVoice(state, rms, index * 50);
    state = observation.state;
    assert.equal(observation.event, "none");
  }
  assert.equal(state.heardVoice, false);
});

test("detects sustained speech then ends after silence", () => {
  let state = createVoiceActivityState();
  let event = observeVoice(state, 0.05, 0);
  state = event.state;
  event = observeVoice(state, 0.06, 50);
  state = event.state;
  event = observeVoice(state, 0.055, 100);
  state = event.state;
  assert.equal(event.event, "voice-start");

  event = observeVoice(state, 0.05, 700);
  state = event.state;
  assert.equal(event.event, "none");
  assert.equal(observeVoice(state, 0.004, 1750).event, "none");
  assert.equal(observeVoice(state, 0.004, 1800).event, "speech-end");
});

test("does not end during a natural pause inside a phrase", () => {
  let state = createVoiceActivityState();
  for (const now of [0, 50, 100]) state = observeVoice(state, 0.05, now).state;
  state = observeVoice(state, 0.05, 600).state;
  assert.equal(observeVoice(state, 0.004, 1500).event, "none");
  assert.equal(observeVoice(state, 0.05, 1550).event, "none");
});
