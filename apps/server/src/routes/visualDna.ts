import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { savedCards, visualDna } from "../db/schema.js";
import type { Catalog } from "../sources/catalog.js";
import type { VisualDnaService } from "../claude/service.js";
import { notFound } from "./errors.js";

const Ref = z.string().min(3).max(80);

export function visualDnaRoutes(
  app: FastifyInstance,
  db: Db,
  catalog: Catalog,
  svc: VisualDnaService,
  ensureAnon: preHandlerAsyncHookHandler,
) {
  app.post(
    "/api/visual-dna",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => {
      const { trackRef } = z.object({ trackRef: Ref }).parse(req.body);
      return { record: await svc.getOrCreate(trackRef) };
    },
  );

  app.get("/api/visual-dna/:ref", async (req) => {
    const { ref } = z.object({ ref: Ref }).parse(req.params);
    const record = svc.getCached(ref);
    if (!record) throw notFound("No Visual DNA cached for this track yet");
    return { record };
  });

  app.post(
    "/api/visual-dna/:ref/remix",
    { preHandler: ensureAnon, config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (req) => {
      const { ref } = z.object({ ref: Ref }).parse(req.params);
      const { prompt, baseId } = z
        .object({ prompt: z.string().trim().min(2).max(140), baseId: z.string().uuid().optional() })
        .parse(req.body);
      const record = await svc.remix(ref, prompt, req.anonId!, baseId);
      return { record, allowance: svc.remixAllowance(req.anonId!) };
    },
  );

  app.get("/api/visual-dna/:ref/remixes", { preHandler: ensureAnon }, async (req) => {
    const { ref } = z.object({ ref: Ref }).parse(req.params);
    return { records: svc.listRemixes(ref, req.anonId!), allowance: svc.remixAllowance(req.anonId!) };
  });

  /** Public, shareable card data. */
  app.get("/api/cards/:id", async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const record = svc.getById(id);
    if (!record) throw notFound("Card not found");
    const item = await catalog.resolve(record.trackRef).catch(() => null);
    return { record, track: item?.track ?? null };
  });

  app.get("/api/library/cards", { preHandler: ensureAnon }, async (req) => {
    const rows = db
      .select({ dna: visualDna, savedAt: savedCards.createdAt })
      .from(savedCards)
      .innerJoin(visualDna, eq(savedCards.dnaId, visualDna.id))
      .where(eq(savedCards.userId, req.anonId!))
      .orderBy(desc(savedCards.createdAt))
      .all();
    const tracks = catalog.cachedMany(rows.map((r) => r.dna.trackRef));
    return {
      cards: rows.map((r) => ({
        record: svc.getById(r.dna.id)!,
        track: tracks.get(r.dna.trackRef) ?? null,
        savedAt: r.savedAt,
      })),
    };
  });

  app.put("/api/library/cards/:id", { preHandler: ensureAnon }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    if (!svc.getById(id)) throw notFound("Card not found");
    db.insert(savedCards).values({ userId: req.anonId!, dnaId: id, createdAt: Date.now() }).onConflictDoNothing().run();
    return { saved: true };
  });

  app.delete("/api/library/cards/:id", { preHandler: ensureAnon }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    db.delete(savedCards).where(and(eq(savedCards.userId, req.anonId!), eq(savedCards.dnaId, id))).run();
    return { saved: false };
  });
}
