# Aural

Aural is a one-page tool that takes a song name and tells you its **genre**, **subgenre**, and **microgenre**. Type it, tap a chip, or talk into the mic.

I built this because catalog apps usually dump a track in a bucket like “Dance” and call it a day. That’s not a lineage. Lean On is not Dance / Dance / Dance. It’s EDM, then tropical house, then moombahton. Three different rungs, never the same word twice.

Made by Nilim.

---

## What you actually do on the site

First time you open it, a short tour explains the idea. Skip it or click through once, it stays gone on that device.

The mapper stays pinned at the top while you scroll. You name a track. Aural looks the recording up, then splits it into three labels, plus artwork, a preview clip, traits, neighbor scenes, and similar tracks. Under that is a long page: how it works, why the three rungs exist, and an atlas of example songs.

That’s the whole product. No account. Recents live on your device.

---

## The UI, in brief

The look is **glassmorphism** (the frosted-glass thing you see on newer phones). Dark ink background, ice-mint accent, blur and a thin specular edge on cards so they feel like glass sitting on the page, not flat grey boxes. I used CSS `backdrop-filter` for that, not a screenshot of glass.

Why this and not a generic dashboard:

- one job, so the search field is the hero, always on top
- results don’t replace the page, they drop in and you keep scrolling
- the background glow tints a little with the genre so EDM and jazz don’t feel like the same room
- buttons are at least 44px because thumbs exist
- first visit gets an overlay, not a wall of docs

Type is Syne for titles, Outfit for body, IBM Plex Mono for the tiny labels. Lucide for icons. Sonner for the little error toasts (“mic denied”, “didn’t catch that”).

---

## Tools, where they sit, and why I picked them

These are the ones the app actually uses. I picked boring, industry-standard stuff on purpose so the interesting part could be the taxonomy, not the framework.

| Tool | Where | Why |
|---|---|---|
| **TypeScript** | whole project | Catches “this might be null” before a user hits it. |
| **React 19** | every screen | Industry default for this kind of UI. Components, state, that’s it. |
| **TanStack Start** (Vite + React Router) | app shell + routes | File-based pages, and **server functions** so catalog lookup and classification never run in the browser with a secret key sitting in the JS bundle. |
| **Vite 8** | dev server + production build | Fast refresh while I’m editing, standard bundler for React apps. |
| **Tailwind CSS v4** | `src/styles.css` + class names | Design tokens (colors, radii, glass shadows) live in one theme. I wasn’t going to hand-write 400 classless rules. |
| **Zod** | `src/lib/classify.ts` | The model replies with JSON. Zod checks the shape so a missing `microgenre` doesn’t blow up the page. |
| **iTunes Search API** | server, first catalog | Public, no key, artwork + 30s preview + year. That’s how the cover and play button show up. |
| **Deezer API** | server, fallback catalog | If iTunes misses, Deezer usually still has a cover and preview. |
| **MediaRecorder + getUserMedia** | `src/lib/speech.ts` | Real recording from the mic. The old “live captions only” path failed silently in a lot of browsers. |
| **Speech-to-text on the server** | `transcribeClip` | Turns the recording into text, then the same classify path as typing. |
| **Web Speech API** (optional) | captions while you record | Nice when the browser supports it. Not the source of truth, because it often just… dies. |
| **localStorage** | history + onboarding | No backend user table. Recents and “I already saw the tour” stay on the device. |
| **Lucide React** | icons | Standard icon set, not emoji, not random SVGs. |
| **Sonner** | toasts | Tiny, accessible, doesn’t fight the glass UI. |

The language model call happens **only on the server**, after the catalog search. The browser never sees that key. I also cache recent lookups in memory so tapping the same track twice doesn’t hammer the model.

---

## Functions, and the hole each one fills

### Mapping a song

- **`classifyTrack`** — the front door. You send a query, it comes back with a classification + catalog hit, or a readable error.
- **`searchItunes` / `searchDeezer` / `searchCatalog`** — “what recording is this, and can I show art + a preview?” iTunes first, Deezer if that comes back empty.
- **`classifySong`** — asks a language model for the three-level split, with hard rules: the three labels must be different, and “Dance” is too broad.
- **`ensureDistinct`** (`src/lib/taxonomy.ts`) — the seatbelt. If the model (or a fallback) still returns Dance / Dance / Dance, this lifts it into a real ladder using a genre tree. Known tracks like Lean On are pinned to EDM → Tropical House → Moombahton so that one can’t collapse again.
- **`isCollapsed`** — true when any two rungs are the same word. Used to retry and to refuse to display a fake lineage.

Problem this whole block solves: music sites give you one tag. I needed three, and I needed them to stay different even when the model gets lazy.

### Voice

- **`beginRecording`** — asks for the mic, records in chunks, auto-stops around 12s.
- **`blobToBase64`** — turns the clip into something the server can read.
- **`transcribeClip`** — speech → text on the server, then we classify that text like you typed it.

Problem this solves: tapping the mic used to start a browser speech API that would error as “no speech” and go idle, so it looked broken. Recording is the real path now. If permission is denied, you get a toast, not a dead button.

### Memory, first visit, mood

- **`loadHistory` / `pushHistory` / `clearHistory`** — last 16 maps on this device, so you can tap back into a result without searching again.
- **`hasOnboarded` / `markOnboarded`** — first visit tour. Once you skip or finish, it doesn’t nag.
- **`tintForGenre`** — picks the background glow so the page reacts to the answer a little.

### UI pieces

- **`SearchDock`** — the pinned mapper: text field, mic, submit.
- **`ResultView`** — artwork, preview player, the three rungs, confidence, traits, neighbors, similar tracks. It runs `ensureDistinct` again before drawing, so the screen cannot show duplicates even if old history is messy.
- **`Onboarding`** — three short cards. What it is, how to use it, why the rungs differ.
- **`Atmosphere`** — the drifting glass glows in the back.
- **`HistoryRail`** — horizontal recents.
- **`PreviewPlayer`** — the 30-second catalog clip, play/pause.
- **`HowSection` / `LineageSection` / `AtlasSection` / `AboutSection`** — the rest of the one-pager, so the tool isn’t a blank search box floating in a void.

---

## The three rungs (the whole point)

1. **Genre** — the wide family a listener would pick. EDM, Hip-Hop, Jazz, not “Dance”.
2. **Subgenre** — the family inside that. House, not EDM again.
3. **Microgenre** — the scene tag. Tech house, tropical house, moombahton. Not House again.

If two of those come back as the same string, that’s a bug, and the code treats it like one.

---

## Run it locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`.

```bash
npm run build
npm run typecheck
```

Mic only works in a real browser with permission. The preview iframe may block it; the deployed site on https will ask like any other app.

---

## What I didn’t do, on purpose

No accounts. No playlist social network. No “10,000 genres” wiki. One field, three labels, a long page that explains itself. If the taxonomy is wrong, that’s the product failing in public, which is the point of shipping it.
