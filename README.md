# Aural

I built Aural to answer a question that broad music tags handle badly: where does a song sit between a genre, a subgenre, and a smaller scene?

Search for a track by name, or tap the mic while a song is playing. Like Shazam, Aural listens for up to 12 seconds, fingerprints the audio to name the exact recording, and then maps it. If the fingerprint finds no match, it transcribes the clip instead, so you can also just say or sing the title. It looks up catalog information, shows a short preview when the source provides one, and returns a three-level lineage with nearby scenes. The three labels must be distinct; `Dance → Dance → Dance` is not a useful answer.

## What the result means

Aural can use a live classifier when configured. Without one, it falls back to catalog information and labels the result as lower confidence. A lineage is a useful way to explore music, not a claim that every genre boundary is objective.

## Run it

```bash
npm install
npm run dev
```

For checks, run `npm run typecheck`, `npm test`, and `npm run build`.

The app uses React, TypeScript, TanStack Start, Tailwind CSS, and Zod. Catalog lookups use iTunes Search and Deezer. Audio recognition uses [AudD](https://audd.io); optional classification and transcription use xAI. All of it runs server-side, and API keys stay on the server.

| Variable | Purpose |
| --- | --- |
| `AUDD_API_TOKEN` | Audio fingerprint recognition for the mic. Without it, AudD allows only a few anonymous requests. |
| `XAI_API_KEY` | Genre, subgenre, and microgenre classification, plus the speech fallback for the mic. |

The mic needs HTTPS (or localhost) and asks for raw audio. Browser voice processing (noise suppression, echo cancellation, and auto gain) is turned off because it filters out music.

Start with `src/lib/classify.ts` for the lookup, recognition, and fallback logic, `src/lib/recognize.ts` for parsing fingerprint matches, `src/lib/taxonomy.ts` for the distinct-level rules, and `src/components/` for the search and result experience.
