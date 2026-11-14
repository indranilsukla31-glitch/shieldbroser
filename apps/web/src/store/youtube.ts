import { create } from "zustand";
import type { YtVideo } from "@artei/shared/client";
import { api } from "../api/client";
import { audio } from "./player";
import { describeYtError, loadYouTubeApi, songQuery, YT_STATE, type YtPlayer } from "../youtube/iframe";
import { BeatPulse } from "../audio/pulse";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

interface YtState {
  queue: YtVideo[];
  index: number;
  status: Status;
  error?: string;
  position: number;
  duration: number;
  captions: boolean;
  bpm: number;
  /** Element the full-size player should sit on top of (set by the watch screen). */
  stage: HTMLElement | null;
  current(): YtVideo | undefined;
  playQueue(videos: YtVideo[], index: number): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  close(): void;
  setCaptions(on: boolean): void;
  tapBeat(): void;
  /** Swap the current song for its lyric video, if YouTube has one. */
  findLyricVideo(): Promise<"swapped" | "none">;
  setStage(el: HTMLElement | null): void;
}

/** Shared synthetic beat that drives the visuals in YouTube mode. */
export const ytPulse = new BeatPulse();

let player: YtPlayer | null = null;
let ready = false;
let pendingId: string | null = null;
let poll = 0;

export const useYouTube = create<YtState>((set, get) => {
  const load = (i: number) => {
    const v = get().queue[i];
    if (!v) return;
    set({ index: i, status: "loading", error: undefined, position: 0, duration: v.duration });
    // One thing plays at a time: pause Artei's own player.
    if (!audio.paused) audio.pause();
    if (player && ready) player.loadVideoById({ videoId: v.id });
    else pendingId = v.id;
  };

  // If the listener starts an Artei track, YouTube steps aside.
  audio.addEventListener("play", () => {
    if (player && ready && get().status === "playing") player.pauseVideo();
  });

  return {
    queue: [],
    index: -1,
    status: "idle",
    position: 0,
    duration: 0,
    captions: false,
    bpm: ytPulse.bpm,
    stage: null,
    current: () => get().queue[get().index],
    playQueue: (videos, index) => {
      set({ queue: videos });
      load(index);
    },
    toggle: () => {
      const { status, index } = get();
      if (!player || !ready || index < 0) return;
      if (status === "error") return load(index);
      if (status === "playing" || status === "loading") player.pauseVideo();
      else {
        if (!audio.paused) audio.pause();
        player.playVideo();
      }
    },
    next: () => {
      const { index, queue } = get();
      if (index < queue.length - 1) load(index + 1);
    },
    prev: () => {
      const { index, position } = get();
      if (position > 3 || index === 0) get().seek(0);
      else load(index - 1);
    },
    seek: (sec) => {
      player?.seekTo(sec, true);
      set({ position: sec });
    },
    close: () => {
      player?.stopVideo();
      set({ queue: [], index: -1, status: "idle", position: 0, duration: 0 });
    },
    setCaptions: (on) => {
      set({ captions: on });
      try {
        if (on) {
          player?.loadModule?.("captions");
          player?.setOption?.("captions", "reload", true);
        } else player?.unloadModule?.("captions");
      } catch {
        /* not every video has captions */
      }
    },
    tapBeat: () => set({ bpm: ytPulse.tap() }),
    findLyricVideo: async () => {
      const cur = get().current();
      if (!cur) return "none";
      const { videos } = await api.yt.search(songQuery(cur.title), true);
      const pick = videos.find((v) => v.id !== cur.id && v.lyrical);
      if (!pick) return "none";
      const queue = [...get().queue];
      queue[get().index] = pick;
      set({ queue });
      load(get().index);
      return "swapped";
    },
    setStage: (el) => set({ stage: el }),
  };
});

/** Create the single embedded player inside `el` (called once by YouTubeHost). */
let mounting = false;
export async function mountYouTubePlayer(el: HTMLElement): Promise<void> {
  if (mounting || player) return;
  mounting = true;
  let YT;
  try {
    YT = await loadYouTubeApi();
  } catch (e) {
    mounting = false;
    useYouTube.setState({ status: "error", error: (e as Error).message });
    return;
  }
  const { getState, setState } = useYouTube;
  player = new YT.Player(el, {
    width: "100%",
    height: "100%",
    playerVars: { playsinline: 1, rel: 0, iv_load_policy: 3, origin: location.origin, hl: "en", cc_lang_pref: "hi" },
    events: {
      onReady: () => {
        ready = true;
        if (pendingId) {
          player!.loadVideoById({ videoId: pendingId });
          pendingId = null;
        }
      },
      onStateChange: (e) => {
        const s = e.data;
        if (s === YT_STATE.PLAYING) {
          if (!audio.paused) audio.pause();
          setState({ status: "playing", error: undefined });
          ytPulse.reset(getState().bpm);
          startPolling();
        } else if (s === YT_STATE.PAUSED) setState({ status: "paused" });
        else if (s === YT_STATE.BUFFERING) setState({ status: "loading" });
        else if (s === YT_STATE.ENDED) {
          const { index, queue } = getState();
          if (index < queue.length - 1) getState().next();
          else setState({ status: "paused" });
        }
      },
      onError: (e) => {
        const { index, queue } = getState();
        // Some labels block embedding: skip ahead rather than stopping the queue.
        if (index < queue.length - 1) {
          setState({ error: describeYtError(e.data) });
          window.setTimeout(() => getState().next(), 1200);
        } else setState({ status: "error", error: describeYtError(e.data) });
      },
    },
  });
}

/** Position updates while YouTube plays (the iframe has no timeupdate event). */
function startPolling() {
  clearInterval(poll);
  poll = window.setInterval(() => {
    if (!player || !ready) return;
    const d = player.getDuration();
    useYouTube.setState({ position: player.getCurrentTime(), ...(d > 0 ? { duration: d } : {}) });
  }, 250);
}
