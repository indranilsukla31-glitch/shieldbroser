import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { randomBytes } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(SERVER_ROOT, "../..");

// Repo-root .env first, then an optional apps/server/.env override.
loadDotenv({ path: path.join(REPO_ROOT, ".env"), quiet: true });
loadDotenv({ path: path.join(SERVER_ROOT, ".env"), override: true, quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default("0.0.0.0"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_SECRET: z.string().min(16).default("dev-only-insecure-cookie-secret"),
  DATABASE_PATH: z.string().default("./artei.db"),
  JAMENDO_CLIENT_ID: z.string().default(""),
  MOCK_CATALOG: z
    .string()
    .default("0")
    .transform((v) => v === "1" || v.toLowerCase() === "true"),
  ARCHIVE_ENABLED: z
    .string()
    .default("1")
    .transform((v) => v === "1" || v.toLowerCase() === "true"),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  YOUTUBE_API_KEY: z.string().default(""),
  REMIX_DAILY_LIMIT: z.coerce.number().int().min(0).default(10),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(overrides: Partial<Record<keyof AppConfig, string>> = {}): AppConfig {
  const cfg = EnvSchema.parse({ ...process.env, ...overrides });
  if (cfg.NODE_ENV === "production" && cfg.COOKIE_SECRET === "dev-only-insecure-cookie-secret") {
    // Don't refuse to start: use a random secret for this run (visitors get a new anonymous ID after restarts).
    console.warn("COOKIE_SECRET is not set; using a random one for this run. Set it to keep sessions across restarts.");
    cfg.COOKIE_SECRET = randomBytes(32).toString("hex");
  }
  return cfg;
}

export function resolveDbPath(p: string): string {
  return p === ":memory:" ? p : path.resolve(SERVER_ROOT, p);
}
