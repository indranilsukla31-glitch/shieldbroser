import type { CollectionName, Lyrics, Mood, Track, TrackList, VisualDnaRecord, YtPlaylist, YtShelfName, YtVideo } from "@artei/shared/client";

export interface SavedCard {
  record: VisualDnaRecord;
  track: Track | null;
  savedAt: number;
}
export interface RemixAllowance {
  limit: number;
  used: number;
  remaining: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include", ...init });
  } catch {
    throw new ApiError(0, "offline", "You appear to be offline.");
  }
  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const api = {
  yt: {
    status: () => req<{ enabled: boolean }>("/api/youtube/status"),
    shelf: (name: YtShelfName) => req<{ videos: YtVideo[] }>(`/api/youtube/shelf/${name}`),
    search: (q: string, lyrical: boolean) => req<{ videos: YtVideo[] }>(`/api/youtube/search?q=${enc(q)}&lyrical=${lyrical ? 1 : 0}`),
    albums: (q = "") => req<{ playlists: YtPlaylist[] }>(`/api/youtube/albums?q=${enc(q)}`),
    playlist: (id: string) => req<{ videos: YtVideo[] }>(`/api/youtube/playlist/${enc(id)}`),
  },
  health: () => req<{ ok: boolean; catalog: string; jamendoConfigured: boolean; claudeConfigured: boolean; youtubeEnabled?: boolean }>("/api/health"),
  trending: (limit = 20) => req<TrackList>(`/api/tracks/trending?limit=${limit}`),
  collection: (name: CollectionName, limit = 20) => req<TrackList>(`/api/tracks/collection/${name}?limit=${limit}`),
  classics: (limit = 20) => req<TrackList>(`/api/tracks/classics?limit=${limit}`),
  mood: (mood: Mood, limit = 20) => req<TrackList>(`/api/tracks/mood/${mood}?limit=${limit}`),
  search: (q: string) => req<TrackList>(`/api/tracks/search?q=${enc(q)}`),
  track: (ref: string) => req<{ track: Track }>(`/api/tracks/${enc(ref)}`),
  lyrics: (ref: string) => req<Lyrics>(`/api/tracks/${enc(ref)}/lyrics`),
  streamUrl: (ref: string) => `/api/stream/${enc(ref)}`,
  session: () => req<{ anonId: string }>("/api/session", { method: "POST" }),
  likes: () => req<TrackList>("/api/library/likes"),
  like: (ref: string) => req<{ liked: boolean }>(`/api/library/likes/${enc(ref)}`, { method: "PUT" }),
  unlike: (ref: string) => req<{ liked: boolean }>(`/api/library/likes/${enc(ref)}`, { method: "DELETE" }),
  visualDna: (trackRef: string) =>
    req<{ record: VisualDnaRecord }>("/api/visual-dna", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackRef }),
    }),
  card: (id: string) => req<{ record: VisualDnaRecord; track: Track | null }>(`/api/cards/${enc(id)}`),
  cards: () => req<{ cards: SavedCard[] }>("/api/library/cards"),
  saveCard: (id: string) => req<{ saved: boolean }>(`/api/library/cards/${enc(id)}`, { method: "PUT" }),
  unsaveCard: (id: string) => req<{ saved: boolean }>(`/api/library/cards/${enc(id)}`, { method: "DELETE" }),
  remix: (ref: string, prompt: string, baseId?: string) =>
    req<{ record: VisualDnaRecord; allowance: RemixAllowance }>(`/api/visual-dna/${enc(ref)}/remix`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, baseId }),
    }),
  remixes: (ref: string) => req<{ records: VisualDnaRecord[]; allowance: RemixAllowance }>(`/api/visual-dna/${enc(ref)}/remixes`),
};
