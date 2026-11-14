import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { fakeFetch, makeApp, type FakeFetchLog } from "./helpers.js";
import { tracks } from "../src/db/schema.js";

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("health", () => {
  it("reports configuration without leaking keys", async () => {
    ({ app } = await makeApp({ ANTHROPIC_API_KEY: "sk-secret" }));
    const res = await app.inject("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, catalog: "jamendo", jamendoConfigured: true, archiveEnabled: true, claudeConfigured: true });
    expect(res.body).not.toContain("sk-secret");
  });
});

describe("tracks (Jamendo, faked network)", () => {
  it("normalizes trending tracks with license + credit and hides audio URLs", async () => {
    const log: FakeFetchLog = { urls: [], headers: [] };
    ({ app } = await makeApp({}, fakeFetch(log)));
    const res = await app.inject("/api/tracks/trending?limit=5");
    expect(res.statusCode).toBe(200);
    const { tracks } = res.json();
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      ref: "jamendo:1886257",
      title: "Fixture Song",
      artist: "Fixture Artist",
      duration: 201,
      tempo: 128,
      hasLyrics: true,
      instrumental: false,
      license: { name: "CC BY-NC-SA 3.0", noDerivatives: false },
    });
    expect(tracks[1]).toMatchObject({ duration: 150, hasLyrics: false, instrumental: true, license: { noDerivatives: true } });
    // the browser must never see upstream audio URLs or the client id
    expect(res.body).not.toContain("storage.jamendo.com");
    expect(res.body).not.toContain("test-client");
    expect(log.urls[0]).toContain("order=popularity_week");
    expect(log.urls[0]).toContain("include=musicinfo+lyrics");
  });

  it("caches lists in memory", async () => {
    const log: FakeFetchLog = { urls: [], headers: [] };
    ({ app } = await makeApp({}, fakeFetch(log)));
    await app.inject("/api/tracks/trending");
    await app.inject("/api/tracks/trending");
    expect(log.urls).toHaveLength(1);
  });

  it("retries when Jamendo intermittently returns no results, and doesn't cache empties", async () => {
    let calls = 0;
    const base = fakeFetch();
    const flaky = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.jamendo.com/") && calls++ < 2) {
        return new Response(JSON.stringify({ headers: { status: "success", code: 0 }, results: [] }));
      }
      return base(input, init);
    }) as typeof fetch;
    ({ app } = await makeApp({}, flaky));
    const res = await app.inject("/api/tracks/trending");
    expect(res.json().tracks).toHaveLength(2);
    expect(calls).toBe(3);
  });

  it("validates mood and search params", async () => {
    ({ app } = await makeApp());
    expect((await app.inject("/api/tracks/mood/sad")).statusCode).toBe(400);
    expect((await app.inject("/api/tracks/mood/chill")).statusCode).toBe(200);
    expect((await app.inject("/api/tracks/search?q=")).statusCode).toBe(400);
    expect((await app.inject("/api/tracks/search?q=fixture")).statusCode).toBe(200);
  });

  it("returns a track and its lyrics", async () => {
    ({ app } = await makeApp());
    const t = await app.inject("/api/tracks/jamendo:1886257");
    expect(t.json().track.title).toBe("Fixture Song");
    const l = await app.inject("/api/tracks/jamendo:1886257/lyrics");
    expect(l.json()).toMatchObject({ kind: "plain", lines: [{ text: "First line here" }, { text: "Second line here" }, { text: "Third line" }] });
    const none = await app.inject("/api/tracks/jamendo:1886258/lyrics");
    expect(none.json()).toEqual({ kind: "none", lines: [] });
  });

  it("404s unknown and malformed refs", async () => {
    ({ app } = await makeApp());
    expect((await app.inject("/api/tracks/jamendo:999")).statusCode).toBe(404);
    expect((await app.inject("/api/tracks/bogus")).json().error.code).toBe("not_found");
  });

  it("returns 502 with a clean error when Jamendo is down", async () => {
    ({ app } = await makeApp({}, fakeFetch(undefined, { apiDown: true })));
    const res = await app.inject("/api/tracks/trending");
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("upstream_unavailable");
  });

  it("returns 503 when no Jamendo key is configured", async () => {
    ({ app } = await makeApp({ JAMENDO_CLIENT_ID: "" }));
    expect((await app.inject("/api/tracks/trending")).statusCode).toBe(503);
  });
});

describe("stream proxy", () => {
  it("proxies audio and forwards Range", async () => {
    const log: FakeFetchLog = { urls: [], headers: [] };
    ({ app } = await makeApp({}, fakeFetch(log)));
    const full = await app.inject("/api/stream/jamendo:1886257");
    expect(full.statusCode).toBe(200);
    expect(full.headers["content-type"]).toBe("audio/mpeg");
    expect(full.rawPayload.length).toBe(1000);

    const part = await app.inject({ url: "/api/stream/jamendo:1886257", headers: { range: "bytes=0-99" } });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe("bytes 0-99/1000");
    expect(log.headers.at(-1)).toEqual({ range: "bytes=0-99" });
  });

  it("refuses to follow redirects to non-Jamendo hosts", async () => {
    let db;
    ({ app, db } = await makeApp());
    db.insert(tracks)
      .values({
        ref: "jamendo:42",
        json: JSON.stringify({ ref: "jamendo:42" }),
        lyricsJson: JSON.stringify({ kind: "none", lines: [] }),
        audioUrl: "https://prod-1.storage.jamendo.com/?trackid=redirect-evil",
        fetchedAt: Date.now(),
      })
      .run();
    const res = await app.inject("/api/stream/jamendo:42");
    expect(res.statusCode).toBe(502);
  });
});

describe("mock catalog", () => {
  it("serves synthesized WAV audio with range support", async () => {
    ({ app } = await makeApp({ MOCK_CATALOG: "1" }));
    const list = (await app.inject("/api/tracks/trending")).json().tracks;
    expect(list.length).toBeGreaterThan(3);
    const ref = list[0].ref;
    const head = await app.inject({ url: `/api/stream/${ref}`, headers: { range: "bytes=0-43" } });
    expect(head.statusCode).toBe(206);
    expect(head.rawPayload.subarray(0, 4).toString()).toBe("RIFF");
    expect(head.headers["content-range"]).toMatch(/^bytes 0-43\/\d+$/);
  });
});

describe("library", () => {
  it("issues an anonymous cookie and stores likes per user", async () => {
    ({ app } = await makeApp());
    const s = await app.inject({ method: "POST", url: "/api/session" });
    const cookie = s.cookies.find((c) => c.name === "artei_anon");
    expect(cookie?.httpOnly).toBe(true);
    const headers = { cookie: `artei_anon=${cookie!.value}` };

    expect((await app.inject({ method: "PUT", url: "/api/library/likes/jamendo:1886257", headers })).statusCode).toBe(200);
    // idempotent
    await app.inject({ method: "PUT", url: "/api/library/likes/jamendo:1886257", headers });
    const liked = (await app.inject({ url: "/api/library/likes", headers })).json();
    expect(liked.tracks.map((t: { ref: string }) => t.ref)).toEqual(["jamendo:1886257"]);

    // another (cookieless) user sees nothing
    expect((await app.inject("/api/library/likes")).json().tracks).toEqual([]);

    await app.inject({ method: "DELETE", url: "/api/library/likes/jamendo:1886257", headers });
    expect((await app.inject({ url: "/api/library/likes", headers })).json().tracks).toEqual([]);
  });

  it("ignores forged cookies", async () => {
    ({ app } = await makeApp());
    const res = await app.inject({ method: "POST", url: "/api/session", headers: { cookie: "artei_anon=forged" } });
    expect(res.json().anonId).not.toBe("forged");
  });

  it("refuses to like unknown tracks", async () => {
    ({ app } = await makeApp());
    expect((await app.inject({ method: "PUT", url: "/api/library/likes/jamendo:999" })).statusCode).toBe(404);
  });
});
