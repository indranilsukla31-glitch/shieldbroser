import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";
import { resolveDbPath, REPO_ROOT } from "./config.js";
import { openDb, type Db } from "./db/client.js";
import { Catalog } from "./sources/catalog.js";
import { JamendoSource, type FetchLike } from "./sources/jamendo.js";
import { MockSource } from "./sources/mock.js";
import { ArchiveSource } from "./sources/archive.js";
import type { CatalogSource } from "./sources/types.js";
import type { TrackSource } from "@artei/shared";
import { makeEnsureAnon } from "./plugins/session.js";
import { installErrorHandler } from "./routes/errors.js";
import { trackRoutes } from "./routes/tracks.js";
import { libraryRoutes } from "./routes/library.js";
import { visualDnaRoutes } from "./routes/visualDna.js";
import { ClaudeDnaModel, type DnaModel } from "./claude/model.js";
import { VisualDnaService } from "./claude/service.js";

export interface AppDeps {
  /** Override fetch for the Jamendo client (tests). */
  fetch?: FetchLike;
  /** Override the Visual DNA model (tests). `null` = Claude disabled. */
  dnaModel?: DnaModel | null;
}

export async function buildApp(cfg: AppConfig, deps: AppDeps = {}): Promise<{ app: FastifyInstance; db: Db }> {
  const app = Fastify({
    logger: cfg.NODE_ENV === "test" ? false : { level: cfg.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: true,
  });

  const { db, close } = openDb(resolveDbPath(cfg.DATABASE_PATH));
  app.addHook("onClose", async () => close());

  await app.register(cookie, { secret: cfg.COOKIE_SECRET });
  await app.register(cors, { origin: cfg.WEB_ORIGIN.split(","), credentials: true });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  const sources: Partial<Record<TrackSource, CatalogSource>> = { mock: new MockSource() };
  if (!cfg.MOCK_CATALOG) sources.jamendo = new JamendoSource(cfg.JAMENDO_CLIENT_ID, deps.fetch);
  const archiveOn = !cfg.MOCK_CATALOG && cfg.ARCHIVE_ENABLED;
  if (archiveOn) sources.archive = new ArchiveSource(deps.fetch);
  const catalog = new Catalog(db, sources, cfg.MOCK_CATALOG ? "mock" : "jamendo", archiveOn ? "archive" : undefined);

  installErrorHandler(app);

  const model =
    deps.dnaModel !== undefined
      ? deps.dnaModel
      : cfg.ANTHROPIC_API_KEY
        ? new ClaudeDnaModel(cfg.ANTHROPIC_API_KEY, cfg.ANTHROPIC_MODEL)
        : null;

  app.get("/api/health", async () => ({
    ok: true,
    catalog: cfg.MOCK_CATALOG ? "mock" : "jamendo",
    jamendoConfigured: Boolean(cfg.JAMENDO_CLIENT_ID),
    archiveEnabled: archiveOn,
    claudeConfigured: model !== null,
  }));

  const dnaService = new VisualDnaService(db, catalog, model, app.log, cfg.REMIX_DAILY_LIMIT);
  const ensureAnon = makeEnsureAnon(db, cfg.NODE_ENV === "production");

  trackRoutes(app, catalog);
  libraryRoutes(app, db, catalog, ensureAnon);
  visualDnaRoutes(app, db, catalog, dnaService, ensureAnon);

  // Production: serve the built PWA from the same origin (one deployable service).
  const webDist = path.join(REPO_ROOT, "apps/web/dist");
  if (cfg.NODE_ENV === "production" && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      setHeaders: (res, filePath) => {
        const name = path.basename(filePath);
        if (name === "sw.js" || name === "index.html" || name.endsWith(".webmanifest") || name === "registerSW.js") {
          res.header("cache-control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.header("cache-control", "public, max-age=31536000, immutable");
        }
      },
    });
    // SPA fallback: any non-API GET without a file extension gets index.html.
    app.setNotFoundHandler((req, reply) => {
      if ((req.method === "GET" || req.method === "HEAD") && !req.url.startsWith("/api/") && !path.extname(req.url.split("?")[0]!)) {
        return reply.header("cache-control", "no-cache").sendFile("index.html");
      }
      reply.code(404).send({ error: { code: "not_found", message: `No route ${req.method} ${req.url}` } });
    });
  }

  return { app, db };
}
