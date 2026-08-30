export type GenreTint = {
  glowA: string;
  glowB: string;
  accent: string;
};

const DEFAULT_TINT: GenreTint = {
  glowA: "rgba(159, 214, 207, 0.22)",
  glowB: "rgba(232, 236, 242, 0.12)",
  accent: "#9fd6cf",
};

const TINTS: Record<string, GenreTint> = {
  edm: { glowA: "rgba(120, 220, 210, 0.28)", glowB: "rgba(90, 160, 255, 0.10)", accent: "#8ee0d6" },
  electronic: { glowA: "rgba(120, 220, 210, 0.28)", glowB: "rgba(90, 160, 255, 0.10)", accent: "#8ee0d6" },
  dance: { glowA: "rgba(120, 220, 210, 0.26)", glowB: "rgba(180, 200, 255, 0.10)", accent: "#9fd6cf" },
  house: { glowA: "rgba(100, 210, 200, 0.26)", glowB: "rgba(255, 210, 160, 0.08)", accent: "#9fd6cf" },
  "hip-hop": { glowA: "rgba(232, 196, 150, 0.22)", glowB: "rgba(180, 140, 110, 0.12)", accent: "#e0c8a4" },
  hiphop: { glowA: "rgba(232, 196, 150, 0.22)", glowB: "rgba(180, 140, 110, 0.12)", accent: "#e0c8a4" },
  rap: { glowA: "rgba(232, 196, 150, 0.22)", glowB: "rgba(180, 140, 110, 0.12)", accent: "#e0c8a4" },
  rnb: { glowA: "rgba(210, 150, 160, 0.22)", glowB: "rgba(160, 110, 130, 0.12)", accent: "#e2b8c0" },
  "r&b": { glowA: "rgba(210, 150, 160, 0.22)", glowB: "rgba(160, 110, 130, 0.12)", accent: "#e2b8c0" },
  soul: { glowA: "rgba(210, 150, 160, 0.22)", glowB: "rgba(200, 140, 100, 0.10)", accent: "#e2b8c0" },
  pop: { glowA: "rgba(200, 210, 230, 0.22)", glowB: "rgba(255, 200, 190, 0.10)", accent: "#d5dde8" },
  rock: { glowA: "rgba(220, 140, 110, 0.18)", glowB: "rgba(160, 160, 170, 0.12)", accent: "#e0b8a8" },
  metal: { glowA: "rgba(180, 190, 200, 0.16)", glowB: "rgba(120, 80, 70, 0.14)", accent: "#c8cdd4" },
  jazz: { glowA: "rgba(220, 190, 140, 0.22)", glowB: "rgba(140, 170, 190, 0.10)", accent: "#e4d0a8" },
  classical: { glowA: "rgba(190, 200, 220, 0.22)", glowB: "rgba(220, 220, 230, 0.10)", accent: "#c9d2de" },
  folk: { glowA: "rgba(170, 190, 140, 0.18)", glowB: "rgba(200, 180, 130, 0.10)", accent: "#c9d4b0" },
  country: { glowA: "rgba(210, 180, 120, 0.20)", glowB: "rgba(160, 140, 100, 0.10)", accent: "#ddc89a" },
  latin: { glowA: "rgba(220, 140, 110, 0.20)", glowB: "rgba(220, 190, 100, 0.10)", accent: "#e4b89a" },
  ambient: { glowA: "rgba(140, 190, 210, 0.22)", glowB: "rgba(180, 200, 210, 0.12)", accent: "#b4d4dc" },
  soundtrack: { glowA: "rgba(180, 190, 210, 0.20)", glowB: "rgba(140, 150, 180, 0.10)", accent: "#c4cce0" },
  world: { glowA: "rgba(180, 170, 130, 0.18)", glowB: "rgba(140, 180, 160, 0.10)", accent: "#d0c8a8" },
};

export function tintForGenre(genre: string | undefined): GenreTint {
  if (!genre) return DEFAULT_TINT;
  const key = genre.toLowerCase().replace(/[^a-z&]+/g, "");
  return TINTS[key] ?? TINTS[genre.toLowerCase()] ?? DEFAULT_TINT;
}
