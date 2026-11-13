import { and, desc, eq, gt, count } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { presetForTags, type Track, type VisualDna, type VisualDnaRecord } from "@artei/shared";
import type { Db } from "../db/client.js";
import { visualDna } from "../db/schema.js";
import type { Catalog } from "../sources/catalog.js";
import { HttpError, notFound } from "../routes/errors.js";
import type { DnaModel } from "./model.js";
import { generateDna } from "./generate.js";
import { remixPrompt, trackPrompt } from "./prompts.js";

const RETRY_PRESET_AFTER_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = typeof visualDna.$inferSelect;

function toRecord(r: Row): VisualDnaRecord {
  return {
    id: r.id,
    trackRef: r.trackRef,
    kind: r.kind,
    parentId: r.parentId ?? undefined,
    origin: r.origin,
    remixPrompt: r.remixPrompt ?? undefined,
    dna: JSON.parse(r.json) as VisualDna,
    createdAt: r.createdAt,
  };
}

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function presetForTrack(track: Track): VisualDna {
  return presetForTags(track.tags, seedOf(track.ref));
}

export class VisualDnaService {
  private inflight = new Map<string, Promise<VisualDnaRecord>>();

  constructor(
    private readonly db: Db,
    private readonly catalog: Catalog,
    private readonly model: DnaModel | null,
    private readonly log: { warn: (o: object, msg: string) => void },
    private readonly remixDailyLimit = 10,
  ) {}

  get claudeEnabled() {
    return this.model !== null;
  }

  private baseRow(ref: string): Row | undefined {
    return this.db
      .select()
      .from(visualDna)
      .where(and(eq(visualDna.trackRef, ref), eq(visualDna.kind, "base")))
      .get();
  }

  getCached(ref: string): VisualDnaRecord | null {
    const r = this.baseRow(ref);
    return r ? toRecord(r) : null;
  }

  getById(id: string): VisualDnaRecord | null {
    const r = this.db.select().from(visualDna).where(eq(visualDna.id, id)).get();
    return r ? toRecord(r) : null;
  }

  /** Cached Visual DNA for a track, generating it (one model call per track) if needed. */
  getOrCreate(ref: string): Promise<VisualDnaRecord> {
    const existing = this.baseRow(ref);
    if (existing && !this.shouldRegenerate(existing)) return Promise.resolve(toRecord(existing));
    // De-duplicate concurrent requests for the same track.
    let p = this.inflight.get(ref);
    if (!p) {
      p = this.create(ref, existing).finally(() => this.inflight.delete(ref));
      this.inflight.set(ref, p);
    }
    return p;
  }

  private shouldRegenerate(r: Row): boolean {
    if (r.origin === "claude" || !this.model) return false;
    // A preset stored because Claude wasn't configured → regenerate now; after a failure → back off.
    return r.model === "none" || Date.now() - r.createdAt > RETRY_PRESET_AFTER_MS;
  }

  private async create(ref: string, existing: Row | undefined): Promise<VisualDnaRecord> {
    const item = await this.catalog.resolve(ref);
    if (!item) throw notFound("Track not found");

    let dna: VisualDna;
    let origin: "claude" | "preset" = "preset";
    if (this.model) {
      const res = await generateDna(this.model, trackPrompt(item.track, item.lyrics));
      if (res.ok) {
        dna = res.dna;
        origin = "claude";
      } else {
        this.log.warn({ ref, reason: res.reason, detail: res.detail }, "Visual DNA generation failed; using preset");
        dna = presetForTrack(item.track);
      }
    } else {
      dna = presetForTrack(item.track);
    }

    const row = {
      id: existing?.id ?? randomUUID(),
      trackRef: ref,
      kind: "base" as const,
      parentId: null,
      ownerId: null,
      origin,
      model: this.model?.id ?? "none",
      remixPrompt: null,
      json: JSON.stringify(dna),
      createdAt: Date.now(),
    };
    this.db.insert(visualDna).values(row).onConflictDoUpdate({ target: visualDna.id, set: row }).run();
    return toRecord(row);
  }

  remixesToday(ownerId: string): number {
    const r = this.db
      .select({ n: count() })
      .from(visualDna)
      .where(and(eq(visualDna.ownerId, ownerId), eq(visualDna.kind, "remix"), gt(visualDna.createdAt, Date.now() - DAY_MS)))
      .get();
    return r?.n ?? 0;
  }

  remixAllowance(ownerId: string) {
    const used = this.remixesToday(ownerId);
    return { limit: this.remixDailyLimit, used, remaining: Math.max(0, this.remixDailyLimit - used) };
  }

  async remix(ref: string, request: string, ownerId: string, baseId?: string): Promise<VisualDnaRecord> {
    if (!this.model) throw new HttpError(503, "claude_unavailable", "Remix needs Claude, which isn't configured on this server.");
    if (this.remixesToday(ownerId) >= this.remixDailyLimit) {
      throw new HttpError(429, "remix_limit", `You've used all ${this.remixDailyLimit} remixes for today. Try again tomorrow.`);
    }
    const item = await this.catalog.resolve(ref);
    if (!item) throw notFound("Track not found");
    const base = baseId ? this.getById(baseId) : await this.getOrCreate(ref);
    if (!base || base.trackRef !== ref) throw notFound("Visual DNA not found for this track");

    const res = await generateDna(this.model, remixPrompt(item.track, base.dna, request));
    if (!res.ok) {
      this.log.warn({ ref, reason: res.reason, detail: res.detail }, "remix failed");
      throw new HttpError(502, "remix_failed", "Couldn't remix the vibe this time. Your remix allowance wasn't used.");
    }
    const row = {
      id: randomUUID(),
      trackRef: ref,
      kind: "remix" as const,
      parentId: base.id,
      ownerId,
      origin: "claude" as const,
      model: this.model.id,
      remixPrompt: request,
      json: JSON.stringify(res.dna),
      createdAt: Date.now(),
    };
    this.db.insert(visualDna).values(row).run();
    return toRecord(row);
  }

  listRemixes(ref: string, ownerId: string): VisualDnaRecord[] {
    return this.db
      .select()
      .from(visualDna)
      .where(and(eq(visualDna.trackRef, ref), eq(visualDna.ownerId, ownerId), eq(visualDna.kind, "remix")))
      .orderBy(desc(visualDna.createdAt))
      .all()
      .map(toRecord);
  }
}
