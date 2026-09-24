import { z } from "zod";
import type { CatalogHit } from "./types.ts";

/**
 * Audio fingerprint recognition (the "Shazam" half of the mic).
 *
 * Speech-to-text can only help when someone *says* a title. When a song is
 * actually playing, the only thing that can name it is a fingerprint lookup
 * against a recording database. AudD exposes that as a single multipart POST
 * and returns Apple Music / Deezer metadata alongside the match, which also
 * gives us richer genre tags than a plain catalog search.
 */

export const AUDD_ENDPOINT = "https://api.audd.io/";

export type Recognition =
  | { status: "match"; hit: CatalogHit; genres: string[]; timecode: string | null }
  | { status: "none" }
  | { status: "error"; code: number | null; message: string };

const MAX_URL = 2_048;

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isInteger(year) && year >= 1800 && year <= 2100 ? year : null;
}

const text = (max: number) => z.string().max(max).optional();

const auddSchema = z
  .object({
    status: z.string().max(40),
    error: z
      .object({ error_code: z.number().optional(), error_message: text(500) })
      .passthrough()
      .optional(),
    result: z
      .object({
        title: text(240),
        artist: text(240),
        album: text(240),
        release_date: text(64),
        timecode: text(32),
        apple_music: z
          .object({
            genreNames: z.array(z.string().max(120)).max(24).optional(),
            previews: z
              .array(z.object({ url: text(MAX_URL) }).passthrough())
              .max(8)
              .optional(),
            artwork: z
              .object({ url: text(MAX_URL) })
              .passthrough()
              .optional(),
            releaseDate: text(64),
          })
          .passthrough()
          .nullish(),
        deezer: z
          .object({
            preview: text(MAX_URL),
            album: z
              .object({ cover_xl: text(MAX_URL), cover_medium: text(MAX_URL) })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

/** Genre tags worth keeping: Apple appends a generic "Music" to every list. */
export function usefulGenres(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || key === "music" || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 6);
}

export function parseAuddResponse(body: unknown): Recognition {
  const parsed = auddSchema.safeParse(body);
  if (!parsed.success) return { status: "error", code: null, message: "Malformed response" };
  const data = parsed.data;

  if (data.status !== "success") {
    return {
      status: "error",
      code: data.error?.error_code ?? null,
      message: data.error?.error_message?.trim() || "Recognition failed",
    };
  }

  const result = data.result;
  const title = result?.title?.trim();
  const artist = result?.artist?.trim();
  if (!result || !title || !artist) return { status: "none" };

  const apple = result.apple_music ?? null;
  const deezer = result.deezer ?? null;
  const genres = usefulGenres(apple?.genreNames ?? []);
  const appleArt = safeUrl(apple?.artwork?.url?.replace("{w}", "600").replace("{h}", "600"));

  return {
    status: "match",
    genres,
    timecode: result.timecode?.trim() || null,
    hit: {
      title,
      artist,
      album: result.album?.trim() ?? "",
      artworkUrl: appleArt ?? safeUrl(deezer?.album?.cover_xl ?? deezer?.album?.cover_medium),
      previewUrl: safeUrl(apple?.previews?.[0]?.url) ?? safeUrl(deezer?.preview),
      year: parseYear(result.release_date ?? apple?.releaseDate),
      catalogGenre: genres[0] ?? null,
      source: apple ? "itunes" : "deezer",
    },
  };
}
