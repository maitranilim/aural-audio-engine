export type CatalogHit = {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  year: number | null;
  catalogGenre: string | null;
  source: "itunes" | "deezer";
};

export type SimilarTrack = {
  title: string;
  artist: string;
};

export type Classification = {
  found: boolean;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  subgenre: string;
  microgenre: string;
  confidence: number;
  rationale: string;
  era: string;
  bpmRange: string;
  energy: number;
  traits: string[];
  neighbors: string[];
  similar: SimilarTrack[];
};

export type ClassifyOk = {
  ok: true;
  classification: Classification;
  catalog: CatalogHit | null;
  query: string;
};

export type ClassifyErr = {
  ok: false;
  error: string;
};

export type ClassifyResponse = ClassifyOk | ClassifyErr;

export type HistoryItem = {
  id: string;
  savedAt: number;
  query: string;
  classification: Classification;
  catalog: CatalogHit | null;
};
