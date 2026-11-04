import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MOODS, type Lyrics } from "@artei/shared";
import type { Catalog } from "../sources/catalog.js";
import { notFound } from "./errors.js";

const Limit = z.coerce.number().int().min(1).max(50).default(20);

export function trackRoutes(app: FastifyInstance, catalog: Catalog) {
  app.get("/api/tracks/trending", async (req) => {
    const { limit } = z.object({ limit: Limit }).parse(req.query);
    return { tracks: await catalog.trending(limit) };
  });

  app.get("/api/tracks/mood/:mood", async (req) => {
    const { mood } = z.object({ mood: z.enum(MOODS) }).parse(req.params);
    const { limit } = z.object({ limit: Limit }).parse(req.query);
    return { tracks: await catalog.byMood(mood, limit) };
  });

  app.get("/api/tracks/search", async (req) => {
    const { q, limit } = z
      .object({ q: z.string().trim().min(1).max(100), limit: Limit })
      .parse(req.query);
    return { tracks: await catalog.search(q, limit) };
  });

  app.get("/api/tracks/:ref", async (req) => {
    const { ref } = z.object({ ref: z.string() }).parse(req.params);
    const item = await catalog.resolve(ref);
    if (!item) throw notFound("Track not found");
    return { track: item.track };
  });

  app.get("/api/tracks/:ref/lyrics", async (req, reply) => {
    const { ref } = z.object({ ref: z.string() }).parse(req.params);
    const item = await catalog.resolve(ref);
    if (!item) throw notFound("Track not found");
    reply.header("cache-control", "public, max-age=3600");
    return item.lyrics satisfies Lyrics;
  });

  app.get("/api/stream/:ref", async (req, reply) => {
    const { ref } = z.object({ ref: z.string() }).parse(req.params);
    const item = await catalog.resolve(ref);
    if (!item) throw notFound("Track not found");
    const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
    const res = await catalog.stream(item, range);
    reply.code(res.status);
    for (const [k, v] of Object.entries(res.headers)) reply.header(k, v);
    reply.header("cache-control", "public, max-age=86400");
    if (res.body instanceof Uint8Array) return reply.send(Buffer.from(res.body.buffer, res.body.byteOffset, res.body.byteLength));
    const { Readable } = await import("node:stream");
    return reply.send(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream));
  });
}
