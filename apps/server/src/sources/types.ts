import type { Lyrics, Mood, Track } from "@artei/shared";

/** A track as returned by a catalog, including server-only fields. */
export interface SourceTrack {
  track: Track;
  lyrics: Lyrics;
  /** Upstream audio URL — never sent to the browser. */
  audioUrl: string;
}

export interface StreamResult {
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | Uint8Array;
}

export interface CatalogSource {
  readonly name: string;
  trending(limit: number): Promise<SourceTrack[]>;
  byMood(mood: Mood, limit: number): Promise<SourceTrack[]>;
  search(query: string, limit: number): Promise<SourceTrack[]>;
  get(id: string): Promise<SourceTrack | null>;
  stream(audioUrl: string, range: string | undefined): Promise<StreamResult>;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
