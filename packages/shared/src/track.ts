/** A track reference is `<source>:<id>`, e.g. `jamendo:1234567`. */
export type TrackSource = "jamendo" | "mock";
export const TRACK_SOURCES: readonly TrackSource[] = ["jamendo", "mock"];

export interface TrackRef {
  source: TrackSource;
  id: string;
}

const REF_RE = /^([a-z]+):([A-Za-z0-9_-]{1,64})$/;

export function parseTrackRef(ref: string): TrackRef | null {
  const m = REF_RE.exec(ref);
  if (!m) return null;
  const source = m[1] as TrackSource;
  if (!TRACK_SOURCES.includes(source)) return null;
  return { source, id: m[2]! };
}

export function formatTrackRef(r: TrackRef): string {
  return `${r.source}:${r.id}`;
}

/** Creative Commons (or public-domain) license attached to a track. */
export interface License {
  /** Short code, e.g. "CC BY-NC-SA 3.0" or "Public Domain". */
  name: string;
  /** Canonical license deed URL. */
  url: string;
  /** Requires attribution (BY). */
  attribution: boolean;
  /** NonCommercial clause (NC). */
  nonCommercial: boolean;
  /** NoDerivatives clause (ND) — clip export is disabled for these. */
  noDerivatives: boolean;
  /** ShareAlike clause (SA). */
  shareAlike: boolean;
}

export interface Track {
  ref: string;
  title: string;
  artist: string;
  artistUrl?: string;
  album?: string;
  /** Seconds. */
  duration: number;
  artwork?: string;
  /** Link back to the track page on the source catalog. */
  sourceUrl?: string;
  license: License;
  tags: string[];
  /** Beats per minute, if the catalog provides a usable hint. */
  tempo?: number;
  /** Catalog says the track is instrumental. */
  instrumental: boolean;
  /** Whether the catalog has (artist-supplied) lyrics for this track. */
  hasLyrics: boolean;
}

export interface LyricLine {
  text: string;
  /** Start time in seconds; absent when the source has no timing. */
  time?: number;
}

export type LyricsKind = "synced" | "plain" | "none";

export interface Lyrics {
  kind: LyricsKind;
  lines: LyricLine[];
  /** Where the lyrics came from, shown in the UI. */
  attribution?: string;
}

export const MOODS = ["chill", "focus", "workout", "latenight"] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, string> = {
  chill: "Chill",
  focus: "Focus",
  workout: "Workout",
  latenight: "Late Night",
};

export interface TrackList {
  tracks: Track[];
}

export interface ApiError {
  error: { code: string; message: string };
}
