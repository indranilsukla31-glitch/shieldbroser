import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { likes } from "../db/schema.js";
import type { Catalog } from "../sources/catalog.js";
import { notFound } from "./errors.js";

export function libraryRoutes(app: FastifyInstance, db: Db, catalog: Catalog, ensureAnon: preHandlerAsyncHookHandler) {
  app.post("/api/session", { preHandler: ensureAnon }, async (req) => ({ anonId: req.anonId }));

  app.get("/api/library/likes", { preHandler: ensureAnon }, async (req) => {
    const rows = db
      .select()
      .from(likes)
      .where(eq(likes.userId, req.anonId!))
      .orderBy(desc(likes.createdAt))
      .all();
    const found = catalog.cachedMany(rows.map((r) => r.trackRef));
    return { tracks: rows.map((r) => found.get(r.trackRef)).filter(Boolean) };
  });

  app.put("/api/library/likes/:ref", { preHandler: ensureAnon }, async (req) => {
    const { ref } = z.object({ ref: z.string() }).parse(req.params);
    const item = await catalog.resolve(ref);
    if (!item) throw notFound("Track not found");
    db.insert(likes)
      .values({ userId: req.anonId!, trackRef: ref, createdAt: Date.now() })
      .onConflictDoNothing()
      .run();
    return { liked: true };
  });

  app.delete("/api/library/likes/:ref", { preHandler: ensureAnon }, async (req) => {
    const { ref } = z.object({ ref: z.string() }).parse(req.params);
    db.delete(likes).where(and(eq(likes.userId, req.anonId!), eq(likes.trackRef, ref))).run();
    return { liked: false };
  });
}
