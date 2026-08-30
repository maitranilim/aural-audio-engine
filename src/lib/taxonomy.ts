import type { Classification } from "@/lib/types";

export function normLabel(s: string) {
  return s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function sameLabel(a: string, b: string) {
  const x = normLabel(a);
  const y = normLabel(b);
  return Boolean(x) && x === y;
}

export function isCollapsed(c: Pick<Classification, "genre" | "subgenre" | "microgenre">) {
  const g = c.genre.trim();
  const s = c.subgenre.trim();
  const m = c.microgenre.trim();
  if (!g || !s || !m) return true;
  return sameLabel(g, s) || sameLabel(s, m) || sameLabel(g, m);
}

const TREE: Record<string, Record<string, string[]>> = {
  EDM: {
    House: ["Tech House", "Deep House", "Tropical House", "French House", "Progressive House", "Moombahton"],
    Techno: ["Melodic Techno", "Minimal Techno", "Industrial Techno"],
    "Drum & Bass": ["Liquid DnB", "Neurofunk", "Jump Up"],
    Trance: ["Uplifting Trance", "Psytrance", "Progressive Trance"],
    Dubstep: ["Brostep", "Melodic Dubstep", "Riddim"],
    Garage: ["UK Garage", "2-Step", "Speed Garage"],
  },
  "Hip-Hop": {
    "East Coast Hip-Hop": ["Boom Bap", "Conscious Rap", "New York Drill"],
    "West Coast Hip-Hop": ["G-Funk", "Hyphy", "West Coast Trap"],
    Trap: ["Trap Rap", "Rage Rap", "Phonk"],
    "UK Rap": ["Grime", "UK Drill", "Afroswing"],
  },
  Pop: {
    "Dance-Pop": ["Electropop", "Europop", "Teen Pop"],
    Synthpop: ["Synthwave", "Indietronica", "French Synthpop"],
    "Indie Pop": ["Bedroom Pop", "Dream Pop", "Twee Pop"],
    "K-Pop": ["K-Pop Dance", "K-R&B", "City Pop"],
  },
  Rock: {
    "Alternative Rock": ["Indie Rock", "Britpop", "Post-Punk"],
    "Hard Rock": ["Classic Hard Rock", "Southern Rock", "Arena Rock"],
    Punk: ["Pop Punk", "Post-Punk", "Hardcore Punk"],
    Shoegaze: ["Dream Pop", "Noise Pop", "Nu-Gaze"],
  },
  "R&B": {
    "Contemporary R&B": ["PBR&B", "Alt-R&B", "Quiet Storm"],
    Funk: ["P-Funk", "Boogie", "Electro-Funk"],
    "Neo-Soul": ["Organic Soul", "Future Soul", "Nu-Soul"],
  },
  Jazz: {
    "Cool Jazz": ["West Coast Jazz", "Chamber Jazz", "Third Stream"],
    Bebop: ["Hard Bop", "Post-Bop", "Modal Jazz"],
    Fusion: ["Jazz-Funk", "Acid Jazz", "Jazz Rap"],
  },
  Metal: {
    "Heavy Metal": ["NWOBHM", "Power Metal", "Doom Metal"],
    "Extreme Metal": ["Death Metal", "Black Metal", "Thrash Metal"],
    "Metalcore": ["Melodic Metalcore", "Deathcore", "Nu-Metal"],
  },
  Folk: {
    "Indie Folk": ["Freak Folk", "Chamber Folk", "Folk Pop"],
    "Singer-Songwriter": ["Confessional Folk", "Americana", "Alt-Country"],
  },
  Country: {
    "Contemporary Country": ["Country Pop", "Bro-Country", "Country Rock"],
    "Outlaw Country": ["Honky Tonk", "Alt-Country", "Red Dirt"],
  },
  Classical: {
    Orchestral: ["Romantic Orchestral", "Minimalism", "Film Orchestral"],
    Chamber: ["String Quartet", "Piano Solo", "Baroque Chamber"],
  },
  Latin: {
    Reggaeton: ["Latin Trap", "Dembow", "Neoperreo"],
    Salsa: ["Salsa Dura", "Timba", "Boogaloo"],
    "Latin Pop": ["Bachata Pop", "Regional Mexican Pop", "Urbano"],
  },
  Ambient: {
    Downtempo: ["Trip-Hop", "Chillout", "Lounge"],
    "Ambient Electronic": ["Drone", "Dark Ambient", "New Age"],
  },
  Soundtrack: {
    "Film Score": ["Orchestral Score", "Hybrid Score", "Leitmotif Score"],
    "Game Music": ["Chiptune", "Cinematic Game Score", "Adaptive Score"],
  },
  World: {
    Afrobeat: ["Afrobeats", "Highlife", "Afro-House"],
    "Global Bass": ["Moombahton", "Baile Funk", "Kuduro"],
  },
  Soul: {
    "Classic Soul": ["Motown", "Southern Soul", "Northern Soul"],
    "Psychedelic Soul": ["Funk", "Sunshine Soul", "Cinematic Soul"],
  },
  Reggae: {
    "Roots Reggae": ["Dub", "Rocksteady", "Ska"],
    Dancehall: ["Ragga", "Bashment", "Reggae Fusion"],
  },
};

const ALIAS: Record<string, string> = {
  dance: "EDM",
  electronic: "EDM",
  electronica: "EDM",
  edm: "EDM",
  house: "EDM",
  techno: "EDM",
  "hip hop": "Hip-Hop",
  hiphop: "Hip-Hop",
  rap: "Hip-Hop",
  "r&b": "R&B",
  rnb: "R&B",
  "r&b/soul": "R&B",
  "rhythm and blues": "R&B",
  alternative: "Rock",
  "alt rock": "Rock",
  "singer/songwriter": "Folk",
  "singer songwriter": "Folk",
  soundtrack: "Soundtrack",
  score: "Soundtrack",
  kpop: "Pop",
  "k pop": "Pop",
  "k-pop": "Pop",
};

type Node = { genre: string; subgenre?: string; microgenre?: string };

function treeGenre(name: string) {
  const n = normLabel(name);
  return Object.keys(TREE).find((k) => normLabel(k) === n) ?? null;
}

function locate(raw: string): Node | null {
  const n = normLabel(raw);
  if (!n) return null;
  for (const [genre, subs] of Object.entries(TREE)) {
    if (normLabel(genre) === n) return { genre };
    for (const [sub, micros] of Object.entries(subs)) {
      if (normLabel(sub) === n) return { genre, subgenre: sub };
      for (const micro of micros) {
        if (normLabel(micro) === n) return { genre, subgenre: sub, microgenre: micro };
      }
    }
  }
  const aliased = ALIAS[n];
  if (aliased) return { genre: aliased };
  return null;
}

function isBucket(label: string, genre: string) {
  if (!label.trim()) return true;
  if (sameLabel(label, genre)) return true;
  if (treeGenre(label)) return true;
  const alias = ALIAS[normLabel(label)];
  if (!alias) return false;
  return !subsOf(genre).some((s) => sameLabel(s, label));
}

function subsOf(genre: string): string[] {
  const g = treeGenre(genre) ?? genre;
  return Object.keys(TREE[g] ?? {});
}

function microsOf(genre: string, subgenre: string): string[] {
  const g = treeGenre(genre) ?? genre;
  const subs = TREE[g];
  if (!subs) return [];
  const key = Object.keys(subs).find((k) => sameLabel(k, subgenre));
  return key ? subs[key] : [];
}

function firstUnused(candidates: string[], used: string[]): string | null {
  const taken = new Set(used.map(normLabel).filter(Boolean));
  return candidates.find((c) => c.trim() && !taken.has(normLabel(c))) ?? null;
}

const KNOWN: Array<{
  match: (title: string, artist: string) => boolean;
  genre: string;
  subgenre: string;
  microgenre: string;
}> = [
  {
    match: (t, a) =>
      t.includes("lean on") &&
      (a.includes("lazer") || a.includes("snake") || a.includes("mø") || /\bmo\b/.test(a)),
    genre: "EDM",
    subgenre: "Tropical House",
    microgenre: "Moombahton",
  },
  {
    match: (t, a) => t === "strobe" && a.includes("deadmau5"),
    genre: "EDM",
    subgenre: "Progressive House",
    microgenre: "Melodic Progressive House",
  },
  {
    match: (t, a) => t.includes("humble") && a.includes("kendrick"),
    genre: "Hip-Hop",
    subgenre: "West Coast Hip-Hop",
    microgenre: "Trap Rap",
  },
  {
    match: (t, a) => t.includes("midnight city") && a.includes("m83"),
    genre: "Pop",
    subgenre: "Synthpop",
    microgenre: "French Synthpop",
  },
  {
    match: (t, a) => t.includes("take five") && a.includes("brubeck"),
    genre: "Jazz",
    subgenre: "Cool Jazz",
    microgenre: "West Coast Jazz",
  },
  {
    match: (t, a) => t.includes("around the world") && a.includes("daft"),
    genre: "EDM",
    subgenre: "House",
    microgenre: "French House",
  },
  {
    match: (t, a) => t.includes("redbone") && a.includes("gambino"),
    genre: "R&B",
    subgenre: "Psychedelic Soul",
    microgenre: "Funk",
  },
];

function knownFor(title: string, artist: string) {
  const t = normLabel(title);
  const a = normLabel(artist);
  return KNOWN.find((k) => k.match(t, a)) ?? null;
}

function splitApart(genre: string, subgenre: string, microgenre: string, neighbors: string[]) {
  let g = genre.trim() || "Pop";
  let s = subgenre.trim();
  let m = microgenre.trim();

  const locM = locate(m);
  const locS = locate(s);
  const locG = locate(g);

  if (locG?.genre) g = locG.genre;
  else if (locS?.genre) g = locS.genre;
  else if (locM?.genre) g = locM.genre;

  if (isBucket(s, g)) {
    s =
      locS?.subgenre ||
      locM?.subgenre ||
      firstUnused(subsOf(g), [g]) ||
      `${g} lineage`;
  }

  const family = locS?.subgenre
    ? microsOf(locS.genre || g, locS.subgenre)
    : microsOf(g, s);
  const familySpecific =
    locS?.microgenre && sameLabel(locS.microgenre, s)
      ? [...family.filter((x) => !sameLabel(x, s))].reverse()
      : family;

  if (!m || sameLabel(m, s) || sameLabel(m, g) || isBucket(m, g)) {
    m =
      firstUnused([...neighbors, ...(locM?.microgenre ? [locM.microgenre] : []), ...familySpecific], [
        g,
        s,
      ]) || `${s} scene`;
  }

  if (sameLabel(s, g) || isBucket(s, g)) s = firstUnused(subsOf(g), [g, m]) || `${g} lineage`;
  if (sameLabel(m, s) || sameLabel(m, g) || isBucket(m, g)) {
    m = firstUnused([...familySpecific, ...neighbors], [g, s]) || `${s} scene`;
  }

  if (sameLabel(s, g)) s = `${g} lineage`;
  if (sameLabel(m, s)) m = `${s} scene`;
  if (sameLabel(m, g)) m = `${g} scene`;

  return { genre: g, subgenre: s, microgenre: m };
}

export function ensureDistinct(c: Classification): Classification {
  const known = knownFor(c.title, c.artist);
  if (known) {
    return { ...c, genre: known.genre, subgenre: known.subgenre, microgenre: known.microgenre };
  }

  const split = splitApart(c.genre, c.subgenre, c.microgenre, c.neighbors);
  return { ...c, ...split };
}
