import { describe, expect, it } from "vitest";
import { makeApp } from "./helpers.js";
import { decodeEntities, parseIsoDuration, toVideo } from "../src/youtube/service.js";
import type { FetchLike } from "../src/sources/jamendo.js";

const vid = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  snippet: { title: `Song ${id} &amp; Lyrical`, channelTitle: "Label", publishedAt: "2026-10-01T00:00:00Z", thumbnails: { high: { url: `https://i.ytimg.com/${id}.jpg` } }, liveBroadcastContent: "none" },
  contentDetails: { duration: "PT3M30S" },
  status: { embeddable: true, privacyStatus: "public" },
  ...extra,
});

function ytFetch(log: string[], opts: { quota?: boolean } = {}): FetchLike {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    log.push(url.pathname + url.search);
    if (opts.quota) {
      return new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }), { status: 403 });
    }
    const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
    if (url.pathname.endsWith("/search")) {
      if (url.searchParams.get("type") === "playlist") {
        return json({ items: [{ id: { playlistId: "PLabcdefghij" }, snippet: { title: "Album Jukebox", channelTitle: "Label" } }] });
      }
      return json({ items: [{ id: { videoId: "aaaaaaaaaaa" } }, { id: { videoId: "bbbbbbbbbbb" } }, { id: { videoId: "ccccccccccc" } }] });
    }
    if (url.pathname.endsWith("/videos")) {
      if (url.searchParams.get("chart") === "mostPopular") return json({ items: [vid("ttttttttttt"), vid("nnnnnnnnnnn", { status: { embeddable: false } })] });
      const ids = (url.searchParams.get("id") ?? "").split(",");
      return json({
        items: ids.map((id) => (id === "bbbbbbbbbbb" ? vid(id, { contentDetails: { regionRestriction: { blocked: ["IN"] } } }) : vid(id))),
      });
    }
    if (url.pathname.endsWith("/playlistItems")) return json({ items: [{ contentDetails: { videoId: "ccccccccccc" } }] });
    throw new Error(`unexpected ${url}`);
  }) as FetchLike;
}

describe("YouTube helpers", () => {
  it("parses ISO durations and entities", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M")).toBe(3720);
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(decodeEntities("Tum &amp; Hum &#39;Lyrical&#39;")).toBe("Tum & Hum 'Lyrical'");
  });

  it("drops non-embeddable, live and India-blocked videos", () => {
    expect(toVideo(vid("x", { status: { embeddable: false } }) as never)).toBeNull();
    expect(toVideo(vid("x", { contentDetails: { regionRestriction: { allowed: ["US"] } } }) as never)).toBeNull();
    const v = toVideo(vid("okokokokoko") as never)!;
    expect(v).toMatchObject({ id: "okokokokoko", title: "Song okokokokoko & Lyrical", duration: 210, lyrical: true });
  });
});

describe("YouTube routes", () => {
  it("is off without a key and never exposes it", async () => {
    const { app } = await makeApp();
    expect((await app.inject("/api/youtube/status")).json()).toEqual({ enabled: false });
    const r = await app.inject("/api/youtube/shelf/trending");
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("youtube_not_configured");
    await app.close();
  });

  it("serves the trending chart, filtered to playable videos, without leaking the key", async () => {
    const log: string[] = [];
    const { app } = await makeApp({ YOUTUBE_API_KEY: "secret-yt-key" }, ytFetch(log));
    const r = await app.inject("/api/youtube/shelf/trending");
    expect(r.statusCode).toBe(200);
    expect(r.json().videos.map((v: { id: string }) => v.id)).toEqual(["ttttttttttt"]);
    expect(r.body).not.toContain("secret-yt-key");
    expect(log[0]).toContain("regionCode=IN");
    expect(log[0]).toContain("videoCategoryId=10");
    expect((await app.inject("/api/health")).json().youtubeEnabled).toBe(true);
    await app.close();
  });

  it("searches (optionally for lyric videos), filters blocked videos and caches", async () => {
    const log: string[] = [];
    const { app } = await makeApp({ YOUTUBE_API_KEY: "k" }, ytFetch(log));
    const r = await app.inject("/api/youtube/search?q=kesariya&lyrical=1");
    expect(r.json().videos.map((v: { id: string }) => v.id)).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
    expect(decodeURIComponent(log[0]!).replace(/\+/g, " ")).toContain("q=kesariya lyrical");
    await app.inject("/api/youtube/search?q=Kesariya&lyrical=1");
    expect(log).toHaveLength(2); // search + videos, second call served from cache
    await app.close();
  });

  it("lists albums and plays a playlist", async () => {
    const { app } = await makeApp({ YOUTUBE_API_KEY: "k" }, ytFetch([]));
    expect((await app.inject("/api/youtube/albums?q=jukebox")).json().playlists[0]).toMatchObject({ id: "PLabcdefghij", title: "Album Jukebox" });
    expect((await app.inject("/api/youtube/playlist/PLabcdefghij")).json().videos).toHaveLength(1);
    expect((await app.inject("/api/youtube/playlist/bad id!")).statusCode).toBe(400);
    expect((await app.inject("/api/youtube/video/short")).statusCode).toBe(400);
    await app.close();
  });

  it("reports an exhausted daily quota clearly", async () => {
    const { app } = await makeApp({ YOUTUBE_API_KEY: "k" }, ytFetch([], { quota: true }));
    const r = await app.inject("/api/youtube/shelf/retro");
    expect(r.statusCode).toBe(429);
    expect(r.json().error.message).toMatch(/daily search allowance/);
    await app.close();
  });
});
