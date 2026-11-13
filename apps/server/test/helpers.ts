import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { FetchLike } from "../src/sources/jamendo.js";
import type { DnaModel } from "../src/claude/model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const jamendoFixture = JSON.parse(readFileSync(path.join(here, "fixtures/jamendo-tracks.json"), "utf8"));

export const AUDIO_BYTES = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 256));

export interface FakeFetchLog {
  urls: string[];
  headers: Record<string, string>[];
}

/** A stand-in for the network: Jamendo API → fixture, Jamendo storage → fake audio. */
export function fakeFetch(log: FakeFetchLog = { urls: [], headers: [] }, opts: { apiDown?: boolean } = {}): FetchLike {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    log.urls.push(url);
    log.headers.push((init?.headers ?? {}) as Record<string, string>);
    if (url.startsWith("https://api.jamendo.com/")) {
      if (opts.apiDown) throw new Error("ECONNREFUSED");
      const u = new URL(url);
      const id = u.searchParams.get("id");
      const results = id ? jamendoFixture.results.filter((r: { id: string }) => r.id === id) : jamendoFixture.results;
      return new Response(JSON.stringify({ ...jamendoFixture, results }), { headers: { "content-type": "application/json" } });
    }
    if (url.includes("trackid=redirect-evil")) {
      return new Response(null, { status: 302, headers: { location: "https://evil.example.com/x.mp3" } });
    }
    if (url.startsWith("https://prod-1.storage.jamendo.com/")) {
      const range = (init?.headers as Record<string, string> | undefined)?.range;
      if (range) {
        return new Response(AUDIO_BYTES.slice(0, 100), {
          status: 206,
          headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-99/1000", "content-length": "100" },
        });
      }
      return new Response(AUDIO_BYTES, { headers: { "content-type": "audio/mpeg", "content-length": "1000" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as FetchLike;
}

export async function makeApp(overrides: Record<string, string> = {}, fetch?: FetchLike, dnaModel?: DnaModel | null) {
  const cfg = loadConfig({
    NODE_ENV: "test",
    DATABASE_PATH: ":memory:",
    JAMENDO_CLIENT_ID: "test-client",
    MOCK_CATALOG: "0",
    ...overrides,
  });
  return buildApp(cfg, { fetch: fetch ?? fakeFetch(), dnaModel });
}
