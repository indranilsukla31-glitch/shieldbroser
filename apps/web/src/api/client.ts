import type { Lyrics, Mood, Track, TrackList } from "@artei/shared";

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
  health: () => req<{ ok: boolean; catalog: string; jamendoConfigured: boolean; claudeConfigured: boolean }>("/api/health"),
  trending: (limit = 20) => req<TrackList>(`/api/tracks/trending?limit=${limit}`),
  mood: (mood: Mood, limit = 20) => req<TrackList>(`/api/tracks/mood/${mood}?limit=${limit}`),
  search: (q: string) => req<TrackList>(`/api/tracks/search?q=${enc(q)}`),
  track: (ref: string) => req<{ track: Track }>(`/api/tracks/${enc(ref)}`),
  lyrics: (ref: string) => req<Lyrics>(`/api/tracks/${enc(ref)}/lyrics`),
  streamUrl: (ref: string) => `/api/stream/${enc(ref)}`,
  session: () => req<{ anonId: string }>("/api/session", { method: "POST" }),
  likes: () => req<TrackList>("/api/library/likes"),
  like: (ref: string) => req<{ liked: boolean }>(`/api/library/likes/${enc(ref)}`, { method: "PUT" }),
  unlike: (ref: string) => req<{ liked: boolean }>(`/api/library/likes/${enc(ref)}`, { method: "DELETE" }),
};
