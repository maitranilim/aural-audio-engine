import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureDistinct, isCollapsed } from "./taxonomy.ts";
import type { CatalogHit, Classification, ClassifyResponse } from "./types.ts";

const QUERY_MAX = 200;
const AUDIO_B64_MAX = 1_800_000;
const MIN_AUDIO_BYTES = 200;
const CATALOG_TIMEOUT_MS = 5_000;
const MODEL_TIMEOUT_MS = 15_000;
const TRANSCRIPTION_TIMEOUT_MS = 15_000;
const MAX_REMOTE_URL_LENGTH = 2_048;
const MAX_MODEL_TEXT = 100_000;
const MAX_TRANSCRIPTION_TEXT = QUERY_MAX;
const CACHE_MAX = 40;

const cache = new Map<string, ClassifyResponse>();
const inFlight = new Map<string, Promise<ClassifyResponse>>();

export class RequestTimeoutError extends Error {
  constructor() {
    super("Upstream request timed out");
    this.name = "RequestTimeoutError";
  }
}

class UpstreamResponseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Upstream API error ${status}`);
    this.name = "UpstreamResponseError";
    this.status = status;
  }
}

/**
 * Run the complete fetch-and-body-read operation under one deadline. Keeping
 * the timer alive until the body has been consumed matters: a server can
 * return headers promptly and then stall while streaming JSON or audio.
 */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectParentAbort: ((reason?: unknown) => void) | undefined;
  const parentAbortPromise = parentSignal
    ? new Promise<never>((_, reject) => {
        rejectParentAbort = reject;
      })
    : null;

  let onParentAbort: (() => void) | undefined;
  if (parentSignal) {
    onParentAbort = () => {
      const reason = parentSignal.reason ?? new Error("Request aborted");
      controller.abort(reason);
      rejectParentAbort?.(reason);
    };
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const operationPromise = Promise.resolve().then(() => operation(controller.signal));
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new RequestTimeoutError());
      reject(new RequestTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race(
      parentAbortPromise
        ? [operationPromise, timeoutPromise, parentAbortPromise]
        : [operationPromise, timeoutPromise],
    );
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (onParentAbort) parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

function normalize(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function remember(key: string, value: ClassifyResponse) {
  // Refresh an existing entry so this small map behaves like an LRU cache.
  cache.delete(key);
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

function cacheKey(query: string) {
  return `${normalize(query)}:${process.env.XAI_API_KEY?.trim() ? "ai" : "catalog"}`;
}

function safeRemoteUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REMOTE_URL_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseCatalogYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = new Date(value).getUTCFullYear();
  return Number.isInteger(year) && year >= 1800 && year <= 2100 ? year : null;
}

function artworkSize(url: string, size: number) {
  return url.replace(/\/\d+x\d+bb/g, `/${size}x${size}bb`).replace(/100x100/, `${size}x${size}`);
}

type ItunesSong = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
};

const itunesSongSchema = z
  .object({
    trackName: z.string().max(240).optional(),
    artistName: z.string().max(240).optional(),
    collectionName: z.string().max(240).optional(),
    artworkUrl100: z.string().max(MAX_REMOTE_URL_LENGTH).optional(),
    previewUrl: z.string().max(MAX_REMOTE_URL_LENGTH).optional(),
    releaseDate: z.string().max(64).optional(),
    primaryGenreName: z.string().max(120).optional(),
  })
  .passthrough();

function parseItunesSongs(body: unknown): ItunesSong[] {
  const envelope = z.object({ results: z.array(z.unknown()).optional() }).safeParse(body);
  if (!envelope.success) return [];

  return (envelope.data.results ?? []).flatMap((raw) => {
    const parsed = itunesSongSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

async function searchItunes(term: string, parentSignal?: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
  return withRequestTimeout(
    async (signal) => {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
      if (!res.ok) return [];
      const body = await res.json();
      return parseItunesSongs(body).flatMap((song) => {
        const title = song.trackName?.trim();
        const artist = song.artistName?.trim();
        if (!title || !artist) return [];

        const rawArtwork = safeRemoteUrl(song.artworkUrl100);
        return [
          {
            title,
            artist,
            album: song.collectionName?.trim() ?? "",
            artworkUrl: rawArtwork ? artworkSize(rawArtwork, 600) : null,
            previewUrl: safeRemoteUrl(song.previewUrl),
            year: parseCatalogYear(song.releaseDate),
            catalogGenre: song.primaryGenreName?.trim() || null,
            source: "itunes" as const,
          },
        ];
      });
    },
    CATALOG_TIMEOUT_MS,
    parentSignal,
  );
}

type DeezerTrack = {
  title?: string;
  preview?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_medium?: string };
};

const deezerTrackSchema = z
  .object({
    title: z.string().max(240).optional(),
    preview: z.string().max(MAX_REMOTE_URL_LENGTH).optional(),
    artist: z.object({ name: z.string().max(240).optional() }).optional(),
    album: z
      .object({
        title: z.string().max(240).optional(),
        cover_xl: z.string().max(MAX_REMOTE_URL_LENGTH).optional(),
        cover_medium: z.string().max(MAX_REMOTE_URL_LENGTH).optional(),
      })
      .optional(),
  })
  .passthrough();

function parseDeezerTracks(body: unknown): DeezerTrack[] {
  const envelope = z.object({ data: z.array(z.unknown()).optional() }).safeParse(body);
  if (!envelope.success) return [];

  return (envelope.data.data ?? []).flatMap((raw) => {
    const parsed = deezerTrackSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

async function searchDeezer(term: string, parentSignal?: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=5`;
  return withRequestTimeout(
    async (signal) => {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
      if (!res.ok) return [];
      const body = await res.json();
      return parseDeezerTracks(body).flatMap((track) => {
        const title = track.title?.trim();
        const artist = track.artist?.name?.trim();
        if (!title || !artist) return [];

        const artworkUrl = safeRemoteUrl(track.album?.cover_xl ?? track.album?.cover_medium);
        return [
          {
            title,
            artist,
            album: track.album?.title?.trim() ?? "",
            artworkUrl,
            previewUrl: safeRemoteUrl(track.preview),
            year: null,
            catalogGenre: null,
            source: "deezer" as const,
          },
        ];
      });
    },
    CATALOG_TIMEOUT_MS,
    parentSignal,
  );
}

async function searchCatalog(term: string): Promise<CatalogHit[]> {
  const [itunes, deezer] = await Promise.allSettled([searchItunes(term), searchDeezer(term)]);
  if (itunes.status === "fulfilled" && itunes.value.length > 0) return itunes.value;
  if (deezer.status === "fulfilled") return deezer.value;
  return [];
}

function scoreHit(hit: CatalogHit, title: string, artist: string) {
  const t = hit.title.toLowerCase();
  const a = hit.artist.toLowerCase();
  const titleQ = title.toLowerCase();
  const artistQ = artist.toLowerCase();
  let s = 0;
  if (titleQ && t === titleQ) s += 4;
  else if (titleQ && (t.includes(titleQ) || titleQ.includes(t))) s += 2;
  if (artistQ && a === artistQ) s += 4;
  else if (artistQ && (a.includes(artistQ) || artistQ.includes(a))) s += 2;
  return s;
}

function queryTokens(value: string) {
  return normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((token) => token.length > 1);
}

function scoreQueryHit(hit: CatalogHit, query: string) {
  const normalizedQuery = normalize(query);
  const title = normalize(hit.title);
  const artist = normalize(hit.artist);
  if (!normalizedQuery) return 0;

  let score = 0;
  if (normalizedQuery === title || normalizedQuery === artist) score += 8;
  if (title && (normalizedQuery.includes(title) || title.includes(normalizedQuery))) score += 5;
  if (artist && (normalizedQuery.includes(artist) || artist.includes(normalizedQuery))) score += 4;

  const querySet = new Set(queryTokens(query));
  score += queryTokens(hit.title).filter((token) => querySet.has(token)).length * 2;
  score += queryTokens(hit.artist).filter((token) => querySet.has(token)).length * 2;
  return score;
}

function pickCatalogForQuery(hits: CatalogHit[], query: string): CatalogHit | null {
  const ranked = hits
    .map((hit) => ({ hit, score: scoreQueryHit(hit, query) }))
    .sort((a, b) => b.score - a.score);
  // A search API's first result is not evidence that it matches the query.
  return ranked[0] && ranked[0].score >= 3 ? ranked[0].hit : null;
}

function pickCatalog(hits: CatalogHit[], title: string, artist: string): CatalogHit | null {
  if (hits.length === 0) return null;
  const ranked = hits.map((h) => ({ h, s: scoreHit(h, title, artist) })).sort((a, b) => b.s - a.s);
  return ranked[0] && ranked[0].s >= 2 ? ranked[0].h : null;
}

function extractJson(text: string): unknown {
  if (text.length > MAX_MODEL_TEXT) throw new Error("Model output is too large");
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

const classificationSchema = z.object({
  found: z.boolean(),
  title: z.string().max(240),
  artist: z.string().max(240),
  album: z.string().max(240).optional().default(""),
  year: z.number().int().nullable().optional().default(null),
  genre: z.string().max(120),
  subgenre: z.string().max(120),
  microgenre: z.string().max(160),
  confidence: z.number().finite(),
  rationale: z.string().max(1_500),
  era: z.string().max(80).optional().default(""),
  bpm_range: z.string().max(80).optional().default(""),
  energy: z.number().finite().optional().default(0.5),
  traits: z.array(z.string().max(120)).max(24).optional().default([]),
  neighbors: z.array(z.string().max(120)).max(24).optional().default([]),
  similar: z
    .array(
      z.object({
        title: z.string().max(240),
        artist: z.string().max(240),
      }),
    )
    .max(12)
    .optional()
    .default([]),
});

function toClassification(raw: z.infer<typeof classificationSchema>): Classification {
  return ensureDistinct({
    found: raw.found,
    title: raw.title.trim(),
    artist: raw.artist.trim(),
    album: raw.album.trim(),
    year: raw.year,
    genre: raw.genre.trim(),
    subgenre: raw.subgenre.trim(),
    microgenre: raw.microgenre.trim(),
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    rationale: raw.rationale.trim(),
    era: raw.era.trim(),
    bpmRange: raw.bpm_range.trim(),
    energy: Math.min(1, Math.max(0, raw.energy)),
    traits: raw.traits
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6),
    neighbors: raw.neighbors
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4),
    similar: raw.similar
      .map((s) => ({ title: s.title.trim(), artist: s.artist.trim() }))
      .filter((s) => s.title && s.artist)
      .slice(0, 3),
  });
}

async function askModel(
  messages: { role: string; content: string }[],
  parentSignal?: AbortSignal,
): Promise<Classification> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("UNAVAILABLE");

  const body = await withRequestTimeout(
    async (signal) => {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages,
        }),
        signal,
      });
      if (!res.ok) throw new UpstreamResponseError(res.status);
      return await res.json();
    },
    MODEL_TIMEOUT_MS,
    parentSignal,
  );

  const parsed = z
    .object({
      choices: z
        .array(
          z.object({
            message: z.object({ content: z.string().max(MAX_MODEL_TEXT).optional() }).optional(),
          }),
        )
        .optional(),
    })
    .safeParse(body);
  if (!parsed.success) throw new Error("Invalid model response");
  const text = parsed.data.choices?.[0]?.message?.content ?? "";
  return toClassification(classificationSchema.parse(extractJson(text)));
}

async function classifySong(
  query: string,
  candidates: CatalogHit[],
  parentSignal?: AbortSignal,
): Promise<Classification> {
  const candidateBlock =
    candidates.length === 0
      ? "No catalog hits."
      : candidates
          .map(
            (c, i) =>
              `${i + 1}. "${c.title}" — ${c.artist}` +
              (c.album ? ` [${c.album}]` : "") +
              (c.year ? ` (${c.year})` : "") +
              (c.catalogGenre ? ` catalog-genre=${c.catalogGenre}` : ""),
          )
          .join("\n");

  const system =
    "You classify recorded music into three DISTINCT levels: genre, subgenre, microgenre. Reply with a single JSON object. No markdown.";

  const user = `Identify the song and return a three-level taxonomy. The three labels MUST be different strings.

Rules:
- genre: top-level listener label. Prefer: EDM, Hip-Hop, Pop, Rock, R&B, Jazz, Metal, Folk, Country, Classical, Latin, Ambient, Soundtrack, World, Soul.
- subgenre: the family inside that genre. NEVER copy genre. EDM → House / Techno / Drum & Bass / Trance / Dubstep / etc.
- microgenre: the scene/tag inside that family. NEVER copy subgenre or genre.
- Catalog "Dance" or "Electronic" is too broad — split it.
- confidence is 0–1.
- traits: 3–6 short sonic descriptors.
- neighbors: 3 nearby microgenres, each different from microgenre.
- similar: 3 comparable tracks.

Worked examples (do not collapse these):
- Lean On — Major Lazer & DJ Snake ft. MØ → genre: EDM, subgenre: Tropical House, microgenre: Moombahton
- Strobe — deadmau5 → genre: EDM, subgenre: Progressive House, microgenre: Melodic Progressive House
- HUMBLE. — Kendrick Lamar → genre: Hip-Hop, subgenre: West Coast Hip-Hop, microgenre: Trap Rap
- Around the World — Daft Punk → genre: EDM, subgenre: House, microgenre: French House

User query: ${query}

Catalog candidates:
${candidateBlock}

Return ONLY JSON with keys:
found, title, artist, album, year (number or null), genre, subgenre, microgenre, confidence, rationale, era, bpm_range, energy (0-1), traits (string[]), neighbors (string[]), similar ({title, artist}[]).`;

  const first = await askModel(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    parentSignal,
  );
  if (!isCollapsed(first)) return first;

  const second = await askModel(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Your previous taxonomy collapsed two levels into the same label. Split them.

Song: ${first.title} — ${first.artist}
You returned: genre="${first.genre}", subgenre="${first.subgenre}", microgenre="${first.microgenre}"

Return JSON again. All three MUST differ. For dance/EDM tracks like Lean On, use EDM / Tropical House / Moombahton (or the true scene), not Dance / Dance / Dance.`,
      },
    ],
    parentSignal,
  );
  return second;
}

const CURATED_RATIONALE =
  "Curated Aural example: this deterministic lineage works without live AI classification.";

const CURATED_EXAMPLES: Array<{
  matches: (query: string) => boolean;
  classification: Classification;
}> = [
  {
    matches: (query) =>
      query.includes("lean on") && (query.includes("major lazer") || query.includes("dj snake")),
    classification: {
      found: true,
      title: "Lean On",
      artist: "Major Lazer & DJ Snake ft. MØ",
      album: "Peace Is the Mission",
      year: 2015,
      genre: "EDM",
      subgenre: "Tropical House",
      microgenre: "Moombahton",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "2010s",
      bpmRange: "98–100",
      energy: 0.78,
      traits: ["sunlit synths", "dancehall swing", "global pop hook"],
      neighbors: ["Future Bass", "Dancehall Pop", "Global Bass"],
      similar: [
        { title: "Light It Up (Remix)", artist: "Major Lazer" },
        { title: "Get Free", artist: "Major Lazer" },
        { title: "You Know You Like It", artist: "DJ Snake" },
      ],
    },
  },
  {
    matches: (query) => query.includes("strobe") && query.includes("deadmau5"),
    classification: {
      found: true,
      title: "Strobe",
      artist: "deadmau5",
      album: "For Lack of a Better Name",
      year: 2009,
      genre: "EDM",
      subgenre: "Progressive House",
      microgenre: "Melodic Progressive House",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "2000s",
      bpmRange: "128",
      energy: 0.66,
      traits: ["patient build", "arpeggiated synths", "wide release"],
      neighbors: ["Melodic Techno", "Progressive Trance", "Ambient House"],
      similar: [
        { title: "I Remember", artist: "deadmau5 & Kaskade" },
        { title: "Ghosts 'n' Stuff", artist: "deadmau5" },
        { title: "Opus", artist: "Eric Prydz" },
      ],
    },
  },
  {
    matches: (query) => query.includes("humble") && query.includes("kendrick"),
    classification: {
      found: true,
      title: "HUMBLE.",
      artist: "Kendrick Lamar",
      album: "DAMN.",
      year: 2017,
      genre: "Hip-Hop",
      subgenre: "West Coast Hip-Hop",
      microgenre: "Trap Rap",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "2010s",
      bpmRange: "150",
      energy: 0.88,
      traits: ["minimal piano", "sub-heavy drums", "commanding cadence"],
      neighbors: ["West Coast Trap", "Conscious Rap", "Rage Rap"],
      similar: [
        { title: "DNA.", artist: "Kendrick Lamar" },
        { title: "m.A.A.d city", artist: "Kendrick Lamar" },
        { title: "Black Skinhead", artist: "Kanye West" },
      ],
    },
  },
  {
    matches: (query) => query.includes("midnight city") && query.includes("m83"),
    classification: {
      found: true,
      title: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      year: 2011,
      genre: "Pop",
      subgenre: "Synthpop",
      microgenre: "French Synthpop",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "2010s",
      bpmRange: "105",
      energy: 0.74,
      traits: ["neon arpeggios", "anthemic chorus", "saxophone lift"],
      neighbors: ["Dream Pop", "Indietronica", "Synthwave"],
      similar: [
        { title: "Reunion", artist: "M83" },
        { title: "Young Blood", artist: "The Naked and Famous" },
        { title: "Sweet Disposition", artist: "The Temper Trap" },
      ],
    },
  },
  {
    matches: (query) => query.includes("take five") && query.includes("brubeck"),
    classification: {
      found: true,
      title: "Take Five",
      artist: "The Dave Brubeck Quartet",
      album: "Time Out",
      year: 1959,
      genre: "Jazz",
      subgenre: "Cool Jazz",
      microgenre: "West Coast Jazz",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "1950s",
      bpmRange: "170",
      energy: 0.58,
      traits: ["odd-meter groove", "alto sax lead", "cool piano voicings"],
      neighbors: ["Hard Bop", "Modal Jazz", "Third Stream"],
      similar: [
        { title: "Blue Rondo à la Turk", artist: "The Dave Brubeck Quartet" },
        { title: "So What", artist: "Miles Davis" },
        { title: "Stolen Moments", artist: "Oliver Nelson" },
      ],
    },
  },
  {
    matches: (query) => query.includes("around the world") && query.includes("daft punk"),
    classification: {
      found: true,
      title: "Around the World",
      artist: "Daft Punk",
      album: "Homework",
      year: 1997,
      genre: "EDM",
      subgenre: "House",
      microgenre: "French House",
      confidence: 1,
      rationale: CURATED_RATIONALE,
      era: "1990s",
      bpmRange: "121",
      energy: 0.82,
      traits: ["looped vocal", "filter movement", "four-on-the-floor"],
      neighbors: ["Disco House", "Tech House", "French Touch"],
      similar: [
        { title: "Music Sounds Better with You", artist: "Stardust" },
        { title: "Digital Love", artist: "Daft Punk" },
        { title: "Lady (Hear Me Tonight)", artist: "Modjo" },
      ],
    },
  },
];

export function curatedExampleFor(query: string): Classification | null {
  const normalized = normalize(query);
  const entry = CURATED_EXAMPLES.find((example) => example.matches(normalized));
  if (!entry) return null;
  return ensureDistinct({
    ...entry.classification,
    confidence: 0.98,
    traits: [...entry.classification.traits],
    neighbors: [...entry.classification.neighbors],
    similar: entry.classification.similar.map((track) => ({ ...track })),
  });
}

export function fallbackFromCatalog(
  query: string,
  hits: CatalogHit[],
  reason: "missing-key" | "upstream-error",
): Classification {
  const hit = pickCatalogForQuery(hits, query);
  const catalogGenre = hit?.catalogGenre?.trim() || "Pop";
  const rationale = hit
    ? "Catalog-only result: the recording came from a public catalog; lineage detail is a best-effort split of its broad catalog tag because live AI classification is unavailable."
    : reason === "missing-key"
      ? "AI classification is not configured in this environment, and no catalog match was found. This is a best-effort taxonomy of the query."
      : "AI classification could not be reached, and no catalog match was found. This is a best-effort taxonomy of the query.";

  return ensureDistinct({
    // `found: false` is intentional: the catalog may identify a recording, but
    // this path has not confirmed it with the classifier.
    found: false,
    title: hit?.title ?? query,
    artist: hit?.artist ?? "",
    album: hit?.album ?? "",
    year: hit?.year ?? null,
    genre: catalogGenre,
    subgenre: catalogGenre,
    microgenre: catalogGenre,
    confidence: hit ? 0.3 : 0.1,
    rationale,
    era: hit?.year ? String(hit.year) : "",
    bpmRange: "",
    energy: 0.5,
    traits: [],
    neighbors: [],
    similar: [],
  });
}

async function classifyQuery(query: string): Promise<ClassifyResponse> {
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }

  const apiKey = process.env.XAI_API_KEY?.trim();
  const curated = curatedExampleFor(query);

  // The built-in atlas is the offline demo contract. Do not make a known
  // example wait on a public catalog or a model that may be unavailable.
  if (!apiKey && curated) {
    const result: ClassifyResponse = {
      ok: true,
      classification: curated,
      catalog: null,
      query,
    };
    remember(key, result);
    return result;
  }

  const candidates = await searchCatalog(query);

  let classification: Classification;
  let catalogOnly = false;
  let cacheable = true;

  if (!apiKey) {
    classification = fallbackFromCatalog(query, candidates, "missing-key");
    catalogOnly = true;
    cacheable = false;
  } else {
    try {
      classification = await classifySong(query, candidates);
    } catch {
      // The UI can still show a catalog-backed best-effort result when xAI is
      // unavailable, times out, or returns malformed JSON. Do not cache this
      // degraded path so a later user retry can recover.
      if (curated) {
        classification = curated;
      } else {
        classification = fallbackFromCatalog(query, candidates, "upstream-error");
        catalogOnly = true;
      }
      cacheable = false;
    }
  }

  classification = ensureDistinct(classification);

  let catalog: CatalogHit | null = null;
  if (catalogOnly) {
    // This fallback deliberately keeps the matching catalog record so the
    // existing UI can label it as unconfirmed while still showing metadata.
    catalog = pickCatalogForQuery(candidates, query);
  } else if (classification.found) {
    catalog = pickCatalog(candidates, classification.title, classification.artist);
    if (classification.title && classification.artist) {
      const resolved = `${classification.title} ${classification.artist}`;
      if (!catalog || scoreHit(catalog, classification.title, classification.artist) < 4) {
        const extra = await searchCatalog(resolved);
        const better = pickCatalog(extra, classification.title, classification.artist);
        if (better) catalog = better;
      }
    }
  }

  const result: ClassifyResponse = {
    ok: true,
    classification,
    catalog,
    query,
  };
  if (cacheable) remember(key, result);
  return result;
}

const classifyInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "Enter a song or artist")
      .max(QUERY_MAX, "Query is too long")
      .refine((value) => !hasControlCharacters(value), "Query contains unsupported characters"),
  })
  .strict();

const SUPPORTED_AUDIO_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
]);

function isStrictBase64(value: string) {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isSupportedAudioMime(value: string) {
  const base = value.split(";", 1)[0]?.trim().toLowerCase();
  return Boolean(
    base &&
    SUPPORTED_AUDIO_MIME.has(base) &&
    /^audio\/[a-z0-9.+-]+(?:\s*;[^\r\n]{1,80})?$/i.test(value),
  );
}

const transcribeInputSchema = z
  .object({
    audioBase64: z
      .string()
      .trim()
      .min(4, "Recording is empty")
      .max(AUDIO_B64_MAX, "Recording is too long")
      .refine(isStrictBase64, "Recording data is invalid"),
    mimeType: z
      .string()
      .trim()
      .min(1, "Recording format is missing")
      .max(120, "Recording format is invalid")
      .refine(isSupportedAudioMime, "Recording format is not supported")
      .optional()
      .default("audio/webm"),
  })
  .strict();

export function validateClassifyInput(input: unknown): { query: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Enter a song or artist");
  }
  const raw = (input as { query?: unknown }).query;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Enter a song or artist");
  }
  if (raw.trim().length > QUERY_MAX) throw new Error("Query is too long");

  const parsed = classifyInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid song query");
  }
  return parsed.data;
}

export function validateTranscriptionInput(input: unknown): {
  audioBase64: string;
  mimeType: string;
} {
  const parsed = transcribeInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid recording");
  }
  return parsed.data;
}

export const classifyTrack = createServerFn({ method: "POST" })
  .validator((input: unknown) => validateClassifyInput(input))
  .handler(async ({ data }): Promise<ClassifyResponse> => {
    const key = cacheKey(data.query);
    const existing = inFlight.get(key);
    if (existing) return existing;

    const pending = classifyQuery(data.query);
    inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    }
  });

export const transcribeClip = createServerFn({ method: "POST" })
  .validator((input: unknown) => validateTranscriptionInput(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Voice input is unavailable right now." };
    }

    const mime = data.mimeType.split(";", 1)[0]?.trim().toLowerCase() || "audio/webm";
    const ext =
      mime.includes("wav") || mime === "audio/wave" || mime === "audio/x-wav"
        ? "wav"
        : mime.includes("webm")
          ? "webm"
          : mime.includes("ogg")
            ? "ogg"
            : mime.includes("mpeg") || mime.includes("mp3")
              ? "mp3"
              : mime === "audio/aac"
                ? "aac"
                : "m4a";

    const bin = Buffer.from(data.audioBase64, "base64");
    if (bin.length < MIN_AUDIO_BYTES) {
      return { ok: false, error: "That recording was empty. Try speaking for a little longer." };
    }

    const form = new FormData();
    form.append("language", "en");
    form.append("format", "true");
    form.append("keyterm", "song title");
    form.append("keyterm", "artist");
    form.append("keyterm", "album");
    form.append("file", new Blob([new Uint8Array(bin)], { type: mime }), `clip.${ext}`);

    try {
      const body = await withRequestTimeout(async (signal) => {
        const res = await fetch("https://api.x.ai/v1/stt", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal,
        });

        if (!res.ok) {
          // Consume the body while the deadline is active, but never copy an
          // upstream response into logs: it can contain request identifiers or
          // other data that is not useful to the client.
          await res.text();
          throw new UpstreamResponseError(res.status);
        }
        return await res.json();
      }, TRANSCRIPTION_TIMEOUT_MS);

      const parsed = z.object({ text: z.string().max(MAX_TRANSCRIPTION_TEXT) }).safeParse(body);
      if (!parsed.success) return { ok: false, error: "Didn't catch any words. Try again." };
      const text = parsed.data.text.trim();
      if (!text) return { ok: false, error: "Didn't catch any words. Try again." };
      return { ok: true, text };
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        return { ok: false, error: "Voice request timed out. Try typing the title." };
      }
      if (error instanceof UpstreamResponseError) {
        console.error(`xAI /v1/stt ${error.status} (${ext}, ${bin.length} bytes)`);
        if (error.status === 413) {
          return { ok: false, error: "That clip was too long. Try a shorter one." };
        }
        if (error.status === 415 || error.status === 400) {
          return {
            ok: false,
            error: "That recording format wasn't accepted. Try typing the title.",
          };
        }
      } else {
        console.error("xAI /v1/stt request failed", error);
      }
      return { ok: false, error: "Could not transcribe that clip. Try typing the title." };
    }
  });
