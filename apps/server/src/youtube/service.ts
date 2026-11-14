import type { YtPlaylist, YtShelfName, YtVideo } from "@artei/shared";
import type { FetchLike } from "../sources/jamendo.js";
import { UpstreamError } from "../sources/types.js";

/**
 * Metadata from the YouTube Data API v3 (search, charts, playlists) so the app
 * can show what to play. Playback itself happens in YouTube's official IFrame
 * player in the browser; Artei never fetches, proxies or analyses YouTube audio.
 *
 * Quota: search costs 100 units (10,000/day free), so shelves and searches are
 * cached for hours and only embeddable videos are returned.
 */
const API = "https://www.googleapis.com/youtube/v3";
const SHELF_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 6 * 60 * 60 * 1000;
const MUSIC = "10";
const DAY = 24 * 60 * 60 * 1000;

interface ShelfQuery {
  q: string;
  /** Only videos published within this many days. */
  recentDays?: number;
  order?: "relevance" | "viewCount";
}

const SHELF_QUERIES: Record<Exclude<YtShelfName, "trending">, ShelfQuery> = {
  new_hindi: { q: "new hindi song official video", recentDays: 60, order: "viewCount" },
  punjabi: { q: "new punjabi song official video", recentDays: 90, order: "viewCount" },
  romantic: { q: "romantic bollywood songs", order: "relevance" },
  nineties: { q: "90s bollywood hit songs", order: "viewCount" },
  retro: { q: "old hindi songs lata mangeshkar kishore kumar mohammed rafi", order: "viewCount" },
};

/** ISO-8601 duration ("PT4M13S", "PT1H2M") → seconds. */
export function parseIsoDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d! * 86400 + h! * 3600 + min! * 60 + s!;
}

/** YouTube titles arrive HTML-escaped in search results. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const LYRICAL_RE = /lyric|lyrical|with lyrics|bol\b/i;

interface Thumbs {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
}
const thumb = (t: Thumbs | undefined) => t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? "";

interface VideoItem {
  id: string;
  snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Thumbs; liveBroadcastContent?: string };
  contentDetails?: { duration?: string; regionRestriction?: { blocked?: string[]; allowed?: string[] } };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

/** Keep only videos that can actually play in the embedded player in India. */
export function toVideo(v: VideoItem): YtVideo | null {
  if (v.status && (v.status.embeddable === false || v.status.privacyStatus === "private")) return null;
  if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== "none") return null;
  const rr = v.contentDetails?.regionRestriction;
  if (rr?.blocked?.includes("IN") || (rr?.allowed && !rr.allowed.includes("IN"))) return null;
  const title = decodeEntities(v.snippet?.title ?? "");
  if (!title) return null;
  return {
    id: v.id,
    title,
    channel: decodeEntities(v.snippet?.channelTitle ?? ""),
    thumbnail: thumb(v.snippet?.thumbnails),
    duration: parseIsoDuration(v.contentDetails?.duration),
    publishedAt: v.snippet?.publishedAt ?? "",
    lyrical: LYRICAL_RE.test(title),
  };
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
export const isVideoId = (s: string) => VIDEO_ID.test(s);
export const isPlaylistId = (s: string) => PLAYLIST_ID.test(s);

export class YouTubeService {
  private cache = new Map<string, { at: number; ttl: number; data: unknown }>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly key: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  get configured() {
    return Boolean(this.key);
  }

  private async get<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ ...params, key: this.key });
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      throw new UpstreamError(`YouTube unreachable: ${(e as Error).message}`);
    }
    if (!res.ok) {
      let reason = "";
      try {
        const body = (await res.json()) as { error?: { errors?: { reason?: string }[] } };
        reason = body.error?.errors?.[0]?.reason ?? "";
      } catch {
        /* ignore */
      }
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        throw new UpstreamError("YouTube's daily search allowance is used up. It resets at midnight Pacific time.", 429);
      }
      if (res.status === 400 || res.status === 403) {
        throw new UpstreamError(`YouTube rejected the request (${reason || res.status}). Check YOUTUBE_API_KEY.`, 502);
      }
      throw new UpstreamError(`YouTube HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  /** Cache + de-duplicate concurrent identical requests (quota is precious). */
  private cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.data as T);
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const p = load()
      .then((data) => {
        const empty = Array.isArray(data) && data.length === 0;
        if (!empty) {
          if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(key, { at: Date.now(), ttl, data });
        }
        return data;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  /** Full details for ids (1 quota unit per 50), filtered to playable videos, in the given order. */
  private async videos(ids: string[]): Promise<YtVideo[]> {
    if (ids.length === 0) return [];
    const body = await this.get<{ items?: VideoItem[] }>("videos", {
      part: "snippet,contentDetails,status",
      id: ids.slice(0, 50).join(","),
      maxResults: "50",
    });
    const byId = new Map((body.items ?? []).map((v) => [v.id, toVideo(v)]));
    return ids.map((id) => byId.get(id)).filter((v): v is YtVideo => Boolean(v));
  }

  private async searchIds(q: string, opts: { order?: string; publishedAfter?: string; max?: number }): Promise<string[]> {
    const params: Record<string, string> = {
      part: "snippet",
      type: "video",
      q,
      videoCategoryId: MUSIC,
      videoEmbeddable: "true",
      videoSyndicated: "true",
      regionCode: "IN",
      relevanceLanguage: "hi",
      safeSearch: "moderate",
      maxResults: String(opts.max ?? 25),
      order: opts.order ?? "relevance",
    };
    if (opts.publishedAfter) params.publishedAfter = opts.publishedAfter;
    const body = await this.get<{ items?: { id?: { videoId?: string } }[] }>("search", params);
    return (body.items ?? []).map((i) => i.id?.videoId).filter((id): id is string => Boolean(id));
  }

  trending(limit = 25): Promise<YtVideo[]> {
    return this.cached(`trending:${limit}`, SHELF_TTL_MS, async () => {
      const body = await this.get<{ items?: VideoItem[] }>("videos", {
        part: "snippet,contentDetails,status",
        chart: "mostPopular",
        regionCode: "IN",
        videoCategoryId: MUSIC,
        maxResults: String(Math.min(50, limit)),
      });
      return (body.items ?? []).map(toVideo).filter((v): v is YtVideo => Boolean(v));
    });
  }

  shelf(name: YtShelfName, limit = 25): Promise<YtVideo[]> {
    if (name === "trending") return this.trending(limit);
    const s = SHELF_QUERIES[name];
    return this.cached(`shelf:${name}:${limit}`, SHELF_TTL_MS, async () => {
      // Round "recent" to the day so the cache key and query stay stable.
      const publishedAfter = s.recentDays
        ? new Date(Math.floor((Date.now() - s.recentDays * DAY) / DAY) * DAY).toISOString()
        : undefined;
      const ids = await this.searchIds(s.q, { order: s.order, publishedAfter, max: limit });
      return this.videos(ids);
    });
  }

  search(q: string, lyrical: boolean): Promise<YtVideo[]> {
    const query = `${q.trim().slice(0, 100)}${lyrical ? " lyrical" : ""}`;
    return this.cached(`search:${query.toLowerCase()}`, SEARCH_TTL_MS, async () => this.videos(await this.searchIds(query, {})));
  }

  /** Albums: YouTube "jukebox" / album playlists. */
  albums(q: string): Promise<YtPlaylist[]> {
    const query = q.trim().slice(0, 100) || "bollywood movie songs jukebox";
    return this.cached(`albums:${query.toLowerCase()}`, SEARCH_TTL_MS, async () => {
      const body = await this.get<{ items?: { id?: { playlistId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Thumbs } }[] }>(
        "search",
        { part: "snippet", type: "playlist", q: query, regionCode: "IN", relevanceLanguage: "hi", safeSearch: "moderate", maxResults: "20" },
      );
      return (body.items ?? [])
        .filter((i) => i.id?.playlistId)
        .map((i) => ({
          id: i.id!.playlistId!,
          title: decodeEntities(i.snippet?.title ?? ""),
          channel: decodeEntities(i.snippet?.channelTitle ?? ""),
          thumbnail: thumb(i.snippet?.thumbnails),
        }));
    });
  }

  playlist(id: string): Promise<YtVideo[]> {
    return this.cached(`playlist:${id}`, SHELF_TTL_MS, async () => {
      const body = await this.get<{ items?: { contentDetails?: { videoId?: string } }[] }>("playlistItems", {
        part: "contentDetails",
        playlistId: id,
        maxResults: "50",
      });
      const ids = (body.items ?? []).map((i) => i.contentDetails?.videoId).filter((v): v is string => Boolean(v));
      return this.videos(ids);
    });
  }

  video(id: string): Promise<YtVideo | null> {
    return this.cached(`video:${id}`, SHELF_TTL_MS, async () => (await this.videos([id]))[0] ?? null);
  }
}
