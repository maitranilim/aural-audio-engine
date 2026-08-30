import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureDistinct, isCollapsed } from "@/lib/taxonomy";
import type { CatalogHit, Classification, ClassifyResponse } from "@/lib/types";

const QUERY_MAX = 200;
const AUDIO_B64_MAX = 1_800_000;
const cache = new Map<string, ClassifyResponse>();
const CACHE_MAX = 40;

const classificationSchema = z.object({
  found: z.boolean(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional().default(""),
  year: z.number().int().nullable().optional().default(null),
  genre: z.string(),
  subgenre: z.string(),
  microgenre: z.string(),
  confidence: z.number(),
  rationale: z.string(),
  era: z.string().optional().default(""),
  bpm_range: z.string().optional().default(""),
  energy: z.number().optional().default(0.5),
  traits: z.array(z.string()).optional().default([]),
  neighbors: z.array(z.string()).optional().default([]),
  similar: z
    .array(
      z.object({
        title: z.string(),
        artist: z.string(),
      }),
    )
    .optional()
    .default([]),
});

function normalize(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function remember(key: string, value: ClassifyResponse) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
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

async function searchItunes(term: string): Promise<CatalogHit[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: ItunesSong[] };
  return (body.results ?? [])
    .filter((r) => r.trackName && r.artistName)
    .map((r) => ({
      title: r.trackName!,
      artist: r.artistName!,
      album: r.collectionName ?? "",
      artworkUrl: r.artworkUrl100 ? artworkSize(r.artworkUrl100, 600) : null,
      previewUrl: r.previewUrl ?? null,
      year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
      catalogGenre: r.primaryGenreName ?? null,
      source: "itunes" as const,
    }));
}

type DeezerTrack = {
  title?: string;
  preview?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_medium?: string };
};

async function searchDeezer(term: string): Promise<CatalogHit[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=5`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: DeezerTrack[] };
  return (body.data ?? [])
    .filter((t) => t.title && t.artist?.name)
    .map((t) => ({
      title: t.title!,
      artist: t.artist!.name!,
      album: t.album?.title ?? "",
      artworkUrl: t.album?.cover_xl || t.album?.cover_medium || null,
      previewUrl: t.preview || null,
      year: null,
      catalogGenre: null,
      source: "deezer" as const,
    }));
}

async function searchCatalog(term: string): Promise<CatalogHit[]> {
  try {
    const itunes = await searchItunes(term);
    if (itunes.length > 0) return itunes;
  } catch {
    /* fall through */
  }
  try {
    return await searchDeezer(term);
  } catch {
    return [];
  }
}

function scoreHit(hit: CatalogHit, title: string, artist: string) {
  const t = hit.title.toLowerCase();
  const a = hit.artist.toLowerCase();
  const titleQ = title.toLowerCase();
  const artistQ = artist.toLowerCase();
  let s = 0;
  if (t === titleQ) s += 4;
  else if (t.includes(titleQ) || titleQ.includes(t)) s += 2;
  if (a === artistQ) s += 4;
  else if (a.includes(artistQ) || artistQ.includes(a)) s += 2;
  return s;
}

function pickCatalog(hits: CatalogHit[], title: string, artist: string): CatalogHit | null {
  if (hits.length === 0) return null;
  const ranked = hits
    .map((h) => ({ h, s: scoreHit(h, title, artist) }))
    .sort((a, b) => b.s - a.s);
  return ranked[0] && ranked[0].s >= 2 ? ranked[0].h : hits[0] ?? null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

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
    traits: raw.traits.map((t) => t.trim()).filter(Boolean).slice(0, 6),
    neighbors: raw.neighbors.map((t) => t.trim()).filter(Boolean).slice(0, 4),
    similar: raw.similar
      .map((s) => ({ title: s.title.trim(), artist: s.artist.trim() }))
      .filter((s) => s.title && s.artist)
      .slice(0, 3),
  });
}

async function askModel(messages: { role: string; content: string }[]): Promise<Classification> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("UNAVAILABLE");

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
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  return toClassification(classificationSchema.parse(extractJson(text)));
}

async function classifySong(query: string, candidates: CatalogHit[]): Promise<Classification> {
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

  const first = await askModel([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (!isCollapsed(first)) return first;

  const second = await askModel([
    { role: "system", content: system },
    {
      role: "user",
      content: `Your previous taxonomy collapsed two levels into the same label. Split them.

Song: ${first.title} — ${first.artist}
You returned: genre="${first.genre}", subgenre="${first.subgenre}", microgenre="${first.microgenre}"

Return JSON again. All three MUST differ. For dance/EDM tracks like Lean On, use EDM / Tropical House / Moombahton (or the true scene), not Dance / Dance / Dance.`,
    },
  ]);
  return second;
}

function fallbackFromCatalog(query: string, hits: CatalogHit[]): Classification {
  const hit = hits[0];
  return ensureDistinct({
    found: Boolean(hit),
    title: hit?.title ?? query,
    artist: hit?.artist ?? "",
    album: hit?.album ?? "",
    year: hit?.year ?? null,
    genre: hit?.catalogGenre || "Pop",
    subgenre: hit?.catalogGenre || "Pop",
    microgenre: hit?.catalogGenre || "Pop",
    confidence: hit ? 0.45 : 0.15,
    rationale: hit
      ? "Mapped from catalog genre, then split into a three-level lineage."
      : "Could not reach the classifier or a catalog match.",
    era: hit?.year ? String(hit.year) : "",
    bpmRange: "",
    energy: 0.5,
    traits: [],
    neighbors: [],
    similar: [],
  });
}

export const classifyTrack = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => {
    const query = input.query?.trim() ?? "";
    if (query.length < 1) throw new Error("Enter a song or artist");
    if (query.length > QUERY_MAX) throw new Error("Query is too long");
    return { query };
  })
  .handler(async ({ data }): Promise<ClassifyResponse> => {
    const query = data.query;
    const key = normalize(query);
    const cached = cache.get(key);
    if (cached) return cached;

    const candidates = await searchCatalog(query);

    let classification: Classification;
    try {
      classification = await classifySong(query, candidates);
    } catch (err) {
      if (err instanceof Error && err.message === "UNAVAILABLE") {
        return {
          ok: false,
          error: "Classification is unavailable right now. Try again in a moment.",
        };
      }
      classification = fallbackFromCatalog(query, candidates);
    }

    classification = ensureDistinct(classification);

    let catalog = classification.found
      ? pickCatalog(candidates, classification.title, classification.artist)
      : candidates[0] ?? null;

    if (classification.found && classification.title && classification.artist) {
      const resolved = `${classification.title} ${classification.artist}`;
      if (!catalog || scoreHit(catalog, classification.title, classification.artist) < 4) {
        const extra = await searchCatalog(resolved);
        const better = pickCatalog(extra, classification.title, classification.artist);
        if (better) catalog = better;
      }
    }

    const result: ClassifyResponse = {
      ok: true,
      classification,
      catalog,
      query,
    };
    remember(key, result);
    return result;
  });

export const transcribeClip = createServerFn({ method: "POST" })
  .validator((input: { audioBase64: string; mimeType: string }) => {
    const audioBase64 = input.audioBase64 ?? "";
    const mimeType = input.mimeType || "audio/webm";
    if (!audioBase64) throw new Error("Empty recording");
    if (audioBase64.length > AUDIO_B64_MAX) throw new Error("Recording is too long");
    return { audioBase64, mimeType };
  })
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Voice input is unavailable right now." };
    }

    const full = data.mimeType.toLowerCase();
    const mime = full.split(";")[0] || "audio/webm";
    // Name the file after the container it really is. `.m4a` promises AAC, and
    // Chrome will happily hand us Opus muxed into an MP4 — labelling that
    // `.m4a` is what makes a decoder reject a clip that is otherwise fine.
    const ext = mime.includes("wav")
      ? "wav"
      : mime.includes("webm")
        ? "webm"
        : mime.includes("ogg")
          ? "ogg"
          : mime.includes("mpeg") || mime.includes("mp3")
            ? "mp3"
            : mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")
              ? full.includes("opus")
                ? "mp4"
                : "m4a"
              : "webm";

    const bin = Buffer.from(data.audioBase64, "base64");
    const form = new FormData();
    form.append("language", "en");
    form.append("format", "true");
    form.append("keyterm", "song title");
    form.append("keyterm", "artist");
    form.append("keyterm", "album");
    form.append("file", new Blob([new Uint8Array(bin)], { type: mime }), `clip.${ext}`);

    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      // Without this every cause — a bad key, an oversized clip, a container
      // the API will not take — looked identical from the client, which is why
      // a broken mic path was so hard to place.
      const detail = await res.text().catch(() => "");
      console.error(
        `xAI /v1/stt ${res.status} (${ext}, ${bin.length} bytes): ${detail.slice(0, 500)}`,
      );
      if (res.status === 413) {
        return { ok: false, error: "That clip was too long. Try a shorter one." };
      }
      if (res.status === 415 || res.status === 400) {
        return { ok: false, error: "That recording format wasn't accepted. Try typing the title." };
      }
      return { ok: false, error: "Could not transcribe that clip. Try typing the title." };
    }

    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false, error: "Didn't catch any words. Try again." };
    return { ok: true, text };
  });
