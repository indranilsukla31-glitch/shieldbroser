import type { CollectionName, Mood, Track } from "@artei/shared";
import { parseLicenseUrl } from "../lib/license.js";
import type { FetchLike } from "./jamendo.js";
import { hostAllowlist, proxyAudio } from "./stream.js";
import { UpstreamError, type CatalogSource, type SourceTrack, type StreamResult } from "./types.js";

/**
 * Internet Archive audio, including the Musopen collection (public-domain and
 * Creative Commons classical recordings). No API key needed.
 *
 * Licensing is strict: an item is used only when its `licenseurl` is a public
 * domain mark / CC0 or a Creative Commons license. Items without a clear
 * license are skipped entirely.
 */
const BASE = "https://archive.org";
/**
 * Shelves: Musopen plus classical-tagged items from the open-source audio collection
 * (only a handful of Musopen items carry a license field). Search covers both collections.
 */
const SHELF_COLLECTION =
  '(collection:musopen OR (collection:opensource_audio AND subject:(classical OR "classical music" OR piano OR symphony OR sonata OR baroque)))';
const SEARCH_COLLECTIONS = "collection:(musopen OR opensource_audio)";
// The search backend rejects leading wildcards, so only require that a license URL exists here;
// the strict public-domain / Creative Commons check happens on every item in itemToTracks.
const HAS_LICENSE = "licenseurl:http*";
const META_TTL_MS = 60 * 60 * 1000;
const TRACKS_PER_ITEM = 2;

export const isAllowedArchiveHost = hostAllowlist("archive.org");

interface SearchDoc {
  identifier: string;
  licenseurl?: string;
}

interface IaFile {
  name: string;
  format?: string;
  title?: string;
  creator?: string;
  length?: string;
  track?: string;
  source?: string;
}

interface IaMetadata {
  metadata?: {
    identifier?: string;
    title?: string | string[];
    creator?: string | string[];
    licenseurl?: string;
    subject?: string | string[];
  };
  files?: IaFile[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function list(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr
    .flatMap((s) => s.split(/[;,]/))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.length < 30);
}

/** IA lengths come as seconds ("254.32") or clock time ("4:14", "1:02:03"). */
export function parseLength(raw: string | undefined): number {
  if (!raw) return 0;
  if (raw.includes(":")) return raw.split(":").reduce((acc, part) => acc * 60 + Number(part), 0) || 0;
  return Number(raw) || 0;
}

function isMp3(f: IaFile) {
  return /mp3/i.test(f.format ?? "") || /\.mp3$/i.test(f.name);
}

function cleanTitle(f: IaFile): string {
  if (f.title?.trim()) return f.title.trim();
  return f.name
    .replace(/\.mp3$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/^\d+[\s._-]+/, "")
    .trim();
}

/** Turn one IA item into tracks (only when the license is acceptable). */
export function itemToTracks(meta: IaMetadata, limit = Number.POSITIVE_INFINITY): SourceTrack[] {
  const m = meta.metadata;
  const id = m?.identifier;
  if (!m || !id || !m.licenseurl) return [];
  const license = parseLicenseUrl(m.licenseurl);
  // parseLicenseUrl marks anything it can't recognise as "unknown" — skip those items.
  if (license.name.startsWith("License unknown")) return [];

  // Prefer the original MP3s over IA's derived copies when both exist.
  const mp3s = (meta.files ?? []).filter(isMp3);
  const originals = mp3s.filter((f) => f.source !== "derivative");
  const files = (originals.length ? originals : mp3s).filter((f) => parseLength(f.length) >= 30);
  const album = first(m.title);
  const itemCreator = first(m.creator);
  const tags = list(m.subject).slice(0, 10);

  return files.slice(0, limit).map((f, i) => {
    const index = (meta.files ?? []).indexOf(f);
    return {
      audioUrl: `${BASE}/download/${encodeURIComponent(id)}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
      lyrics: { kind: "none", lines: [] },
      track: {
        ref: `archive:${id}~${index}`,
        title: cleanTitle(f) || `${album ?? id} (part ${i + 1})`,
        artist: f.creator?.trim() || itemCreator || "Unknown artist",
        album,
        duration: parseLength(f.length),
        artwork: `${BASE}/services/img/${encodeURIComponent(id)}`,
        sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
        license,
        tags,
        instrumental: true,
        hasLyrics: false,
      } satisfies Track,
    };
  });
}

export class ArchiveSource implements CatalogSource {
  readonly name = "archive";
  private meta = new Map<string, { at: number; data: IaMetadata }>();

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  private async json<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(12_000) });
    } catch (e) {
      throw new UpstreamError(`Internet Archive unreachable: ${(e as Error).message}`);
    }
    if (!res.ok) throw new UpstreamError(`Internet Archive HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  private async metadata(id: string): Promise<IaMetadata> {
    const hit = this.meta.get(id);
    if (hit && Date.now() - hit.at < META_TTL_MS) return hit.data;
    const data = await this.json<IaMetadata>(`${BASE}/metadata/${encodeURIComponent(id)}`);
    if (this.meta.size > 500) this.meta.delete(this.meta.keys().next().value!);
    this.meta.set(id, { at: Date.now(), data });
    return data;
  }

  /** Search items, then expand each into a couple of tracks. */
  private async find(collections: string, query: string, limit: number): Promise<SourceTrack[]> {
    // Many Musopen items hold only lossless files, so scan the whole (small) curated collection.
    const items = collections === SHELF_COLLECTION ? 40 : Math.max(4, Math.ceil(limit / TRACKS_PER_ITEM) + 2);
    const qs = new URLSearchParams({
      q: `${collections} AND mediatype:audio AND ${HAS_LICENSE}${query ? ` AND (${query})` : ""}`,
      rows: String(items),
      page: "1",
      output: "json",
    });
    qs.append("fl[]", "identifier");
    qs.append("fl[]", "licenseurl");
    qs.append("sort[]", "downloads desc");
    const body = await this.json<{ response?: { docs?: SearchDoc[] }; error?: string }>(`${BASE}/advancedsearch.php?${qs}`);
    if (!body.response) throw new UpstreamError(`Internet Archive search failed${body.error ? `: ${body.error}` : ""}`);
    // Skip items whose license obviously isn't PD/CC before fetching their metadata.
    const docs = body.response.docs?.filter((d) => !d.licenseurl || /publicdomain|creativecommons\.org\/licenses/i.test(d.licenseurl)) ?? [];
    const metas = await Promise.allSettled(docs.map((d) => this.metadata(d.identifier)));
    const out: SourceTrack[] = [];
    for (const m of metas) {
      if (m.status === "fulfilled") out.push(...itemToTracks(m.value, TRACKS_PER_ITEM));
      if (out.length >= limit) break;
    }
    return out.slice(0, limit);
  }

  trending(limit: number) {
    return this.find(SHELF_COLLECTION, "", limit);
  }

  /** Musopen is classical: the same curated set suits every mood it's blended into. */
  byMood(_mood: Mood, limit: number) {
    return this.find(SHELF_COLLECTION, "", limit);
  }

  /** Indian classical recordings with explicit PD/CC licenses; the Archive has no Hindi pop. */
  collection(name: CollectionName, limit: number) {
    if (name !== "indian_classical") return Promise.resolve([]);
    return this.find(
      SEARCH_COLLECTIONS,
      'subject:(raga OR hindustani OR carnatic OR sitar OR tabla OR "indian classical")',
      limit,
    );
  }

  search(q: string, limit: number) {
    // Quote-escape the user's words and match title, creator or subject.
    const words = q
      .replace(/["\\():^~*?[\]{}!]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    if (words.length === 0) return Promise.resolve([]);
    const term = words.map((w) => `"${w}"`).join(" AND ");
    return this.find(SEARCH_COLLECTIONS, `title:(${term}) OR creator:(${term}) OR subject:(${term})`, limit);
  }

  async get(id: string): Promise<SourceTrack | null> {
    const m = /^(.+)~(\d+)$/.exec(id);
    if (!m) return null;
    const meta = await this.metadata(m[1]!);
    const index = Number(m[2]);
    return itemToTracks(meta).find((t) => t.track.ref === `archive:${m[1]}~${index}`) ?? null;
  }

  stream(audioUrl: string, range: string | undefined): Promise<StreamResult> {
    return proxyAudio(audioUrl, range, isAllowedArchiveHost, this.fetchImpl);
  }
}
