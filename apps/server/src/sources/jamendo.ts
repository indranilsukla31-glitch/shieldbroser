import type { Mood } from "@artei/shared";
import { parseLicenseUrl } from "../lib/license.js";
import { parseLyrics } from "../lib/lyrics.js";
import { UpstreamError, type CatalogSource, type SourceTrack, type StreamResult } from "./types.js";
import { hostAllowlist, proxyAudio } from "./stream.js";

const API = "https://api.jamendo.com/v3.0";

/** Jamendo `fuzzytags` / filters for each mood shelf. */
const MOOD_QUERY: Record<Mood, Record<string, string>> = {
  chill: { fuzzytags: "chillout+lounge+ambient+downtempo" },
  focus: { fuzzytags: "ambient+piano+minimal+classical", vocalinstrumental: "instrumental" },
  workout: { fuzzytags: "electronic+dance+energetic+rock", speed: "high+veryhigh" },
  latenight: { fuzzytags: "lofi+jazz+triphop+night" },
};

/** Jamendo only gives a coarse speed; map it to an approximate BPM hint. */
const SPEED_BPM: Record<string, number> = {
  verylow: 65,
  low: 85,
  medium: 105,
  high: 128,
  veryhigh: 150,
};

/** Hosts we are willing to proxy audio from (prevents SSRF via the stream proxy). */
export const isAllowedAudioHost = hostAllowlist("jamendo.com");

interface JamendoTrack {
  id: string;
  name: string;
  duration: number | string;
  artist_id: string;
  artist_name: string;
  album_name?: string;
  image?: string;
  album_image?: string;
  shareurl?: string;
  audio?: string;
  license_ccurl?: string;
  lyrics?: string;
  musicinfo?: {
    vocalinstrumental?: string;
    speed?: string;
    tags?: { genres?: string[]; instruments?: string[]; vartags?: string[] };
  };
}

interface JamendoResponse {
  headers: { status: string; code: number; error_message?: string; results_count?: number };
  results: JamendoTrack[];
}

export function normalizeJamendoTrack(t: JamendoTrack): SourceTrack | null {
  if (!t.audio) return null;
  const lyrics = parseLyrics(t.lyrics, "Lyrics supplied by the artist via Jamendo");
  const tags = [
    ...(t.musicinfo?.tags?.genres ?? []),
    ...(t.musicinfo?.tags?.vartags ?? []),
    ...(t.musicinfo?.tags?.instruments ?? []),
  ].slice(0, 12);
  const speed = t.musicinfo?.speed;
  return {
    audioUrl: t.audio.replace(/^http:\/\//, "https://"),
    lyrics,
    track: {
      ref: `jamendo:${t.id}`,
      title: t.name,
      artist: t.artist_name,
      artistUrl: `https://www.jamendo.com/artist/${t.artist_id}`,
      album: t.album_name || undefined,
      duration: Number(t.duration) || 0,
      artwork: t.image || t.album_image || undefined,
      sourceUrl: t.shareurl || `https://www.jamendo.com/track/${t.id}`,
      license: parseLicenseUrl(t.license_ccurl),
      tags,
      tempo: speed ? SPEED_BPM[speed] : undefined,
      instrumental: t.musicinfo?.vocalinstrumental === "instrumental",
      hasLyrics: lyrics.kind !== "none",
    },
  };
}

export type FetchLike = typeof fetch;

export class JamendoSource implements CatalogSource {
  readonly name = "jamendo";

  constructor(
    private readonly clientId: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  /**
   * Jamendo's API intermittently answers a valid query with zero results, so
   * retry empty answers a couple of times before believing them.
   */
  private async query(params: Record<string, string>): Promise<SourceTrack[]> {
    let results: SourceTrack[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      results = await this.queryOnce(params);
      if (results.length > 0) break;
    }
    return results;
  }

  private async queryOnce(params: Record<string, string>): Promise<SourceTrack[]> {
    if (!this.clientId) throw new UpstreamError("JAMENDO_CLIENT_ID is not configured", 503);
    const qs = new URLSearchParams({
      client_id: this.clientId,
      format: "json",
      include: "musicinfo+lyrics",
      audioformat: "mp32",
      imagesize: "600",
      ...params,
    });
    // Jamendo uses literal "+" as a separator in some params; URLSearchParams would encode it.
    const url = `${API}/tracks/?${qs.toString().replace(/%2B/g, "+")}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      throw new UpstreamError(`Jamendo unreachable: ${(e as Error).message}`);
    }
    if (!res.ok) throw new UpstreamError(`Jamendo HTTP ${res.status}`);
    const body = (await res.json()) as JamendoResponse;
    if (body.headers?.status !== "success") {
      throw new UpstreamError(`Jamendo error: ${body.headers?.error_message ?? "unknown"}`);
    }
    return body.results.map(normalizeJamendoTrack).filter((t): t is SourceTrack => t !== null);
  }

  trending(limit: number) {
    return this.query({ order: "popularity_week", groupby: "artist_id", limit: String(limit) });
  }

  byMood(mood: Mood, limit: number) {
    return this.query({ ...MOOD_QUERY[mood], order: "popularity_month", groupby: "artist_id", limit: String(limit) });
  }

  search(q: string, limit: number) {
    return this.query({ search: q, order: "relevance", limit: String(limit) });
  }

  async get(id: string) {
    const [t] = await this.query({ id, limit: "1" });
    return t ?? null;
  }

  stream(audioUrl: string, range: string | undefined): Promise<StreamResult> {
    return proxyAudio(audioUrl, range, isAllowedAudioHost, this.fetchImpl);
  }
}
