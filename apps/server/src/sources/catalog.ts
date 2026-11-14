import { eq } from "drizzle-orm";
import { parseTrackRef, type Lyrics, type Mood, type Track, type TrackSource } from "@artei/shared";
import type { Db } from "../db/client.js";
import { tracks } from "../db/schema.js";
import { UpstreamError, type CatalogSource, type SourceTrack } from "./types.js";

const LIST_TTL_MS = 10 * 60 * 1000;
const TRACK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Routes requests to the right source, caches normalized tracks in SQLite and
 * caches list results in memory for a few minutes to stay well within API limits.
 */
export class Catalog {
  private listCache = new Map<string, { at: number; refs: Track[] }>();

  constructor(
    private readonly db: Db,
    private readonly sources: Partial<Record<TrackSource, CatalogSource>>,
    private readonly primary: TrackSource,
    /** Optional second catalog blended into focus and search, plus its own shelf. */
    private readonly secondary?: TrackSource,
  ) {}

  private source(name: TrackSource): CatalogSource {
    const s = this.sources[name];
    if (!s) throw new UpstreamError(`Source "${name}" is not enabled`, 404);
    return s;
  }

  private save(items: SourceTrack[]) {
    const now = Date.now();
    for (const it of items) {
      const row = {
        ref: it.track.ref,
        json: JSON.stringify(it.track),
        lyricsJson: JSON.stringify(it.lyrics),
        audioUrl: it.audioUrl,
        fetchedAt: now,
      };
      this.db.insert(tracks).values(row).onConflictDoUpdate({ target: tracks.ref, set: row }).run();
    }
  }

  private async list(key: string, load: () => Promise<SourceTrack[]>): Promise<Track[]> {
    const hit = this.listCache.get(key);
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.refs;
    const items = await load();
    this.save(items);
    const out = items.map((i) => i.track);
    // Don't cache an empty shelf: it's usually a transient catalog hiccup.
    if (out.length > 0) this.listCache.set(key, { at: Date.now(), refs: out });
    return out;
  }

  trending(limit = 20) {
    return this.list(`trending:${limit}`, () => this.source(this.primary).trending(limit));
  }

  byMood(mood: Mood, limit = 20) {
    // Focus gets public-domain classical recordings mixed in (1 in 3) when available.
    if (mood === "focus" && this.secondary) {
      return this.list(`mood:${mood}:${limit}`, () =>
        this.blend(
          () => this.source(this.primary).byMood(mood, limit),
          () => this.source(this.secondary!).byMood(mood, Math.ceil(limit / 3)),
          limit,
          3,
        ),
      );
    }
    return this.list(`mood:${mood}:${limit}`, () => this.source(this.primary).byMood(mood, limit));
  }

  search(q: string, limit = 20) {
    if (this.secondary) {
      return this.list(`search:${q.toLowerCase()}:${limit}`, () =>
        this.blend(
          () => this.source(this.primary).search(q, limit),
          () => this.source(this.secondary!).search(q, Math.ceil(limit / 2)),
          limit,
          2,
        ),
      );
    }
    return this.list(`search:${q.toLowerCase()}:${limit}`, () => this.source(this.primary).search(q, limit));
  }

  /** Public-domain / CC classical shelf (Internet Archive + Musopen). */
  classics(limit = 20) {
    if (!this.secondary) return Promise.resolve([]);
    return this.list(`classics:${limit}`, () => this.source(this.secondary!).trending(limit));
  }

  get hasSecondary() {
    return Boolean(this.secondary);
  }

  /**
   * Interleave a secondary source into primary results (every `every`-th item).
   * The secondary source is best-effort: its failures never break the shelf.
   */
  private async blend(
    primary: () => Promise<SourceTrack[]>,
    secondary: () => Promise<SourceTrack[]>,
    limit: number,
    every: number,
  ): Promise<SourceTrack[]> {
    const [a, b] = await Promise.allSettled([primary(), secondary()]);
    const extra = b.status === "fulfilled" ? b.value : [];
    if (a.status === "rejected") {
      if (extra.length) return extra.slice(0, limit);
      throw a.reason;
    }
    const out: SourceTrack[] = [];
    const main = [...a.value];
    let i = 0;
    while (out.length < limit && (main.length || extra.length)) {
      i++;
      const next = i % every === 0 && extra.length ? extra.shift() : main.shift() ?? extra.shift();
      if (next) out.push(next);
    }
    return out;
  }

  /** Resolve a track (and its server-only fields), using the SQLite cache when fresh. */
  async resolve(ref: string): Promise<SourceTrack | null> {
    const parsed = parseTrackRef(ref);
    if (!parsed) return null;
    const row = this.db.select().from(tracks).where(eq(tracks.ref, ref)).get();
    if (row && Date.now() - row.fetchedAt < TRACK_TTL_MS) {
      return { track: JSON.parse(row.json) as Track, lyrics: JSON.parse(row.lyricsJson) as Lyrics, audioUrl: row.audioUrl };
    }
    try {
      const fresh = await this.source(parsed.source).get(parsed.id);
      if (fresh) this.save([fresh]);
      return fresh;
    } catch (e) {
      // Serve stale cache rather than fail if the catalog is down.
      if (row) return { track: JSON.parse(row.json), lyrics: JSON.parse(row.lyricsJson), audioUrl: row.audioUrl };
      throw e;
    }
  }

  /** Look up cached tracks only (no network) — used for library listings. */
  cachedMany(refs: string[]): Map<string, Track> {
    const out = new Map<string, Track>();
    for (const ref of refs) {
      const row = this.db.select().from(tracks).where(eq(tracks.ref, ref)).get();
      if (row) out.set(ref, JSON.parse(row.json) as Track);
    }
    return out;
  }

  stream(item: SourceTrack, range: string | undefined) {
    const parsed = parseTrackRef(item.track.ref)!;
    return this.source(parsed.source).stream(item.audioUrl, range);
  }
}
