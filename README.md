# Aural

I built Aural to answer a question that broad music tags handle badly: where does a song sit between a genre, a subgenre, and a smaller scene?

Search for a track by name, or use voice input when it is available. Aural looks up catalog information, shows a short preview when the source provides one, and returns a three-level lineage with nearby scenes. The three labels must be distinct; `Dance → Dance → Dance` is not a useful answer.

## What the result means

Aural can use a live classifier when configured. Without one, it falls back to catalog information and labels the result as lower confidence. A lineage is a useful way to explore music, not a claim that every genre boundary is objective.

## Run it

```bash
npm install
npm run dev
```

For checks, run `npm run typecheck`, `npm test`, and `npm run build`.

The app uses React, TypeScript, TanStack Start, Tailwind CSS, and Zod. Catalog lookups use iTunes Search and Deezer; optional classification and transcription run server-side. API keys stay on the server.

Start with `src/lib/classify.ts` for the lookup and fallback logic, `src/lib/taxonomy.ts` for the distinct-level rules, and `src/components/` for the search and result experience.
