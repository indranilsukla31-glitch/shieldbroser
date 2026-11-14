import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { itemToTracks, parseLength } from "../src/sources/archive.js";
import { fakeFetch, makeApp, AUDIO_BYTES } from "./helpers.js";
import type { FetchLike } from "../src/sources/jamendo.js";

// Shapes follow archive.org's advancedsearch and metadata APIs.
const ITEMS: Record<string, unknown> = {
  "musopen-chopin-nocturnes": {
    metadata: {
      identifier: "musopen-chopin-nocturnes",
      title: "Chopin - Nocturnes",
      creator: "Frédéric Chopin",
      licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/",
      subject: ["piano", "nocturne", "classical"],
    },
    files: [
      { name: "cover.jpg", format: "JPEG" },
      { name: "01 Nocturne Op. 9 No. 1.mp3", format: "VBR MP3", length: "331.2", source: "original" },
      { name: "02 Nocturne Op. 9 No. 2.mp3", format: "VBR MP3", length: "4:33", title: "Nocturne in E-flat major", source: "original" },
      { name: "02 Nocturne Op. 9 No. 2.ogg", format: "Ogg Vorbis", length: "273", source: "derivative" },
      { name: "tiny.mp3", format: "VBR MP3", length: "3", source: "original" },
    ],
  },
  "orchestra-cc-by": {
    metadata: { identifier: "orchestra-cc-by", title: "Symphony", creator: ["Some Orchestra"], licenseurl: "https://creativecommons.org/licenses/by/4.0/", subject: "symphony; orchestra" },
    files: [{ name: "symphony.mp3", format: "VBR MP3", length: "600" }],
  },
  "no-license-item": {
    metadata: { identifier: "no-license-item", title: "Unclear rights", creator: "Someone" },
    files: [{ name: "a.mp3", format: "VBR MP3", length: "200" }],
  },
};

function archiveFetch(opts: { down?: boolean; log?: string[] } = {}): FetchLike {
  const base = fakeFetch();
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    opts.log?.push(url);
    if (url.startsWith("https://archive.org/")) {
      if (opts.down) throw new Error("ECONNREFUSED");
      if (url.includes("/advancedsearch.php")) {
        const docs = Object.keys(ITEMS).map((identifier) => ({ identifier }));
        return Response.json({ response: { numFound: docs.length, docs } });
      }
      const meta = /\/metadata\/([^/?]+)/.exec(url);
      if (meta) return Response.json(ITEMS[decodeURIComponent(meta[1]!)] ?? {});
      if (url.includes("/download/")) {
        // archive.org redirects downloads to a storage node on *.us.archive.org
        return new Response(null, { status: 302, headers: { location: "https://ia800100.us.archive.org/1/items/x/file.mp3" } });
      }
    }
    if (url.startsWith("https://ia800100.us.archive.org/")) {
      return new Response(AUDIO_BYTES, { headers: { "content-type": "audio/mpeg", "content-length": "1000" } });
    }
    return base(input, init);
  }) as FetchLike;
}

describe("Internet Archive mapping", () => {
  it("parses IA lengths in seconds or clock time", () => {
    expect(parseLength("331.2")).toBeCloseTo(331.2);
    expect(parseLength("4:33")).toBe(273);
    expect(parseLength("1:02:03")).toBe(3723);
    expect(parseLength(undefined)).toBe(0);
  });

  it("maps MP3 files of a public-domain item to tracks, skipping non-MP3 and tiny files", () => {
    const tracks = itemToTracks(ITEMS["musopen-chopin-nocturnes"] as never);
    expect(tracks.map((t) => t.track.ref)).toEqual(["archive:musopen-chopin-nocturnes~1", "archive:musopen-chopin-nocturnes~2"]);
    expect(tracks[1]!.track).toMatchObject({
      title: "Nocturne in E-flat major",
      artist: "Frédéric Chopin",
      duration: 273,
      instrumental: true,
      hasLyrics: false,
      license: { name: "Public Domain", noDerivatives: false },
      sourceUrl: "https://archive.org/details/musopen-chopin-nocturnes",
    });
    expect(tracks[0]!.track.title).toBe("Nocturne Op. 9 No. 1");
    expect(tracks[0]!.audioUrl).toBe("https://archive.org/download/musopen-chopin-nocturnes/01%20Nocturne%20Op.%209%20No.%201.mp3");
  });

  it("skips items without a clear public-domain or CC license", () => {
    expect(itemToTracks(ITEMS["no-license-item"] as never)).toEqual([]);
    expect(itemToTracks({ metadata: { identifier: "x", licenseurl: "https://example.com/all-rights-reserved" }, files: [] })).toEqual([]);
  });
});

describe("Internet Archive in the API", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("serves a classics shelf with only properly licensed items", async () => {
    const log: string[] = [];
    ({ app } = await makeApp({}, archiveFetch({ log })));
    const { tracks } = (await app.inject("/api/tracks/classics")).json();
    expect(tracks.length).toBe(3);
    expect(tracks.every((t: { ref: string }) => t.ref.startsWith("archive:"))).toBe(true);
    expect(tracks.some((t: { ref: string }) => t.ref.includes("no-license-item"))).toBe(false);
    const search = log.find((u) => u.includes("advancedsearch"))!;
    expect(decodeURIComponent(search.replace(/\+/g, " "))).toContain("licenseurl:(*publicdomain* OR *creativecommons.org/licenses*)");
  });

  it("blends archive results into search and the focus shelf", async () => {
    ({ app } = await makeApp({}, archiveFetch()));
    const search = (await app.inject("/api/tracks/search?q=nocturne")).json().tracks.map((t: { ref: string }) => t.ref.split(":")[0]);
    expect(search).toContain("jamendo");
    expect(search).toContain("archive");
    const focus = (await app.inject("/api/tracks/mood/focus")).json().tracks.map((t: { ref: string }) => t.ref.split(":")[0]);
    expect(focus).toContain("archive");
  });

  it("keeps Jamendo working when the Archive is down", async () => {
    ({ app } = await makeApp({}, archiveFetch({ down: true })));
    const res = await app.inject("/api/tracks/search?q=fixture");
    expect(res.statusCode).toBe(200);
    expect(res.json().tracks.length).toBeGreaterThan(0);
    expect((await app.inject("/api/tracks/classics")).statusCode).toBe(502);
  });

  it("resolves an archive track and streams it through the allowlisted redirect", async () => {
    ({ app } = await makeApp({}, archiveFetch()));
    const t = await app.inject("/api/tracks/archive:musopen-chopin-nocturnes~2");
    expect(t.json().track.title).toBe("Nocturne in E-flat major");
    expect((await app.inject("/api/tracks/archive:musopen-chopin-nocturnes~2/lyrics")).json().kind).toBe("none");
    const s = await app.inject("/api/stream/archive:musopen-chopin-nocturnes~2");
    expect(s.statusCode).toBe(200);
    expect(s.rawPayload.length).toBe(1000);
    expect((await app.inject("/api/tracks/archive:no-license-item~0")).statusCode).toBe(404);
  });

  it("can be switched off", async () => {
    ({ app } = await makeApp({ ARCHIVE_ENABLED: "0" }, archiveFetch()));
    expect((await app.inject("/api/tracks/classics")).json().tracks).toEqual([]);
  });
});
