import assert from "node:assert/strict";
import test from "node:test";
import { parseAuddResponse, usefulGenres } from "./recognize.ts";

test("parses an AudD match with Apple Music metadata", () => {
  const result = parseAuddResponse({
    status: "success",
    result: {
      artist: "deadmau5",
      title: "Strobe",
      album: "For Lack of a Better Name",
      release_date: "2009-09-22",
      timecode: "01:12",
      apple_music: {
        genreNames: ["Dance", "Music", "Electronic", "House"],
        previews: [{ url: "https://audio.example/strobe.m4a" }],
        artwork: { url: "https://art.example/{w}x{h}bb.jpg" },
      },
    },
  });
  assert.equal(result.status, "match");
  if (result.status !== "match") return;
  assert.equal(result.hit.title, "Strobe");
  assert.equal(result.hit.artist, "deadmau5");
  assert.equal(result.hit.year, 2009);
  assert.equal(result.hit.previewUrl, "https://audio.example/strobe.m4a");
  assert.equal(result.hit.artworkUrl, "https://art.example/600x600bb.jpg");
  assert.deepEqual(result.genres, ["Dance", "Electronic", "House"]);
  assert.equal(result.hit.catalogGenre, "Dance");
  assert.equal(result.timecode, "01:12");
});

test("falls back to Deezer preview and artwork", () => {
  const result = parseAuddResponse({
    status: "success",
    result: {
      artist: "M83",
      title: "Midnight City",
      deezer: {
        preview: "https://cdn.example/preview.mp3",
        album: { cover_xl: "https://cdn.example/cover.jpg" },
      },
    },
  });
  assert.equal(result.status, "match");
  if (result.status !== "match") return;
  assert.equal(result.hit.source, "deezer");
  assert.equal(result.hit.previewUrl, "https://cdn.example/preview.mp3");
  assert.equal(result.hit.artworkUrl, "https://cdn.example/cover.jpg");
  assert.deepEqual(result.genres, []);
});

test("reports no match when AudD hears nothing it knows", () => {
  assert.deepEqual(parseAuddResponse({ status: "success", result: null }), { status: "none" });
});

test("reports API errors with their code", () => {
  const result = parseAuddResponse({
    status: "error",
    error: { error_code: 901, error_message: "Recognition failed: no api_token" },
  });
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.code, 901);
});

test("rejects unsafe URLs and malformed bodies", () => {
  const result = parseAuddResponse({
    status: "success",
    result: {
      artist: "A",
      title: "B",
      apple_music: { previews: [{ url: "javascript:alert(1)" }] },
    },
  });
  assert.equal(result.status, "match");
  if (result.status === "match") assert.equal(result.hit.previewUrl, null);
  assert.equal(parseAuddResponse("nope").status, "error");
});

test("drops Apple's generic Music tag and duplicates", () => {
  assert.deepEqual(usefulGenres(["Music", "Pop", "pop", " ", "K-Pop"]), ["Pop", "K-Pop"]);
});
