import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { AppConfig } from "./config.js";
import { resolveDbPath } from "./config.js";
import { openDb, type Db } from "./db/client.js";
import { Catalog } from "./sources/catalog.js";
import { JamendoSource, type FetchLike } from "./sources/jamendo.js";
import { MockSource } from "./sources/mock.js";
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
  const catalog = new Catalog(db, sources, cfg.MOCK_CATALOG ? "mock" : "jamendo");

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
    claudeConfigured: model !== null,
  }));

  const dnaService = new VisualDnaService(db, catalog, model, app.log, cfg.REMIX_DAILY_LIMIT);
  const ensureAnon = makeEnsureAnon(db, cfg.NODE_ENV === "production");

  trackRoutes(app, catalog);
  libraryRoutes(app, db, catalog, ensureAnon);
  visualDnaRoutes(app, db, catalog, dnaService, ensureAnon);

  return { app, db };
}
