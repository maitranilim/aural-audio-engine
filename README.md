# Aural

Aural maps a named song to a three-level genre lineage: genre, subgenre, and microgenre. It supports typed lookup and optional voice transcription, then shows catalog metadata, a short preview when available, and nearby scenes.

## Product boundary

The three levels are always distinct. Aural does not present a broad catalog tag such as `Dance` three times as a lineage. When a live classifier is unavailable, the result is labeled as a lower-confidence catalog-based fallback.

## Run locally

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Stack

TanStack Start, React, TypeScript, Tailwind CSS, Zod, iTunes Search, Deezer, and optional xAI speech-to-text/classification. API keys remain server-side.

## Repository layout

- `src/components/` — the search flow and result UI
- `src/lib/classify.ts` — validation, catalog lookup, classification, and fallback behavior
- `src/lib/taxonomy.ts` — the distinct-level taxonomy rules
- `src/lib/speech.ts` — microphone capture

Created and maintained by [maitranilim](https://github.com/maitranilim).
