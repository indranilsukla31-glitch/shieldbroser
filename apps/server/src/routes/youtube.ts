import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { YT_SHELVES } from "@artei/shared";
import { HttpError } from "./errors.js";
import { isPlaylistId, isVideoId, type YouTubeService } from "../youtube/service.js";

const notConfigured = () =>
  new HttpError(503, "youtube_not_configured", "YouTube mode is off. Add YOUTUBE_API_KEY to the server's environment to turn it on.");

/** YouTube mode metadata. The API key stays on the server; the browser only gets video ids. */
export function youtubeRoutes(app: FastifyInstance, yt: YouTubeService) {
  const need = () => {
    if (!yt.configured) throw notConfigured();
  };
  // Searches cost 100 quota units each, so keep a tight per-IP limit.
  const searchLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  app.get("/api/youtube/status", async () => ({ enabled: yt.configured }));

  app.get("/api/youtube/shelf/:name", async (req) => {
    need();
    const { name } = z.object({ name: z.enum(YT_SHELVES) }).parse(req.params);
    return { videos: await yt.shelf(name) };
  });

  app.get("/api/youtube/search", searchLimit, async (req) => {
    need();
    const { q, lyrical } = z
      .object({ q: z.string().trim().min(1).max(100), lyrical: z.enum(["0", "1"]).default("0") })
      .parse(req.query);
    return { videos: await yt.search(q, lyrical === "1") };
  });

  app.get("/api/youtube/albums", searchLimit, async (req) => {
    need();
    const { q } = z.object({ q: z.string().trim().max(100).default("") }).parse(req.query);
    return { playlists: await yt.albums(q) };
  });

  app.get("/api/youtube/playlist/:id", async (req) => {
    need();
    const { id } = z.object({ id: z.string().refine(isPlaylistId, "invalid playlist id") }).parse(req.params);
    return { videos: await yt.playlist(id) };
  });

  app.get("/api/youtube/video/:id", async (req) => {
    need();
    const { id } = z.object({ id: z.string().refine(isVideoId, "invalid video id") }).parse(req.params);
    const video = await yt.video(id);
    if (!video) throw new HttpError(404, "not_found", "That video isn't available to play here.");
    return { video };
  });
}
