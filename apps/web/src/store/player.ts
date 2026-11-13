import { create } from "zustand";
import type { Track } from "@artei/shared";
import { api } from "../api/client";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayerState {
  queue: Track[];
  index: number;
  status: Status;
  error?: string;
  position: number;
  duration: number;
  buffered: number;
  current(): Track | undefined;
  playQueue(tracks: Track[], startIndex: number): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
}

/** One shared <audio> element for the whole app (so playback survives navigation). */
export const audio = new Audio();
audio.preload = "auto";
// Same-origin via the API proxy, but keep CORS mode so Web Audio analysis works later.
audio.crossOrigin = "anonymous";

export const usePlayer = create<PlayerState>((set, get) => {
  const load = (i: number, autoplay = true) => {
    const t = get().queue[i];
    if (!t) return;
    set({ index: i, status: "loading", error: undefined, position: 0, duration: t.duration, buffered: 0 });
    audio.src = api.streamUrl(t.ref);
    if (autoplay) {
      analyser.ensure();
      audio.play().catch((e: Error) => {
        // Autoplay can be blocked until the user interacts; that's a pause, not an error.
        if (e.name === "NotAllowedError") set({ status: "paused" });
        else if (e.name !== "AbortError") set({ status: "error", error: "This track couldn't be played." });
      });
    }
  };

  audio.addEventListener("playing", () => set({ status: "playing" }));
  audio.addEventListener("pause", () => {
    if (get().status !== "error") set({ status: "paused" });
  });
  audio.addEventListener("waiting", () => set({ status: "loading" }));
  audio.addEventListener("timeupdate", () => set({ position: audio.currentTime }));
  audio.addEventListener("durationchange", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) set({ duration: audio.duration });
  });
  audio.addEventListener("progress", () => {
    const b = audio.buffered;
    if (b.length) set({ buffered: b.end(b.length - 1) });
  });
  audio.addEventListener("ended", () => {
    const { index, queue } = get();
    if (index < queue.length - 1) load(index + 1);
    else set({ status: "paused" });
  });
  audio.addEventListener("error", () => {
    if (!audio.src) return;
    set({ status: "error", error: "This track failed to load. Try the next one." });
  });

  return {
    queue: [],
    index: -1,
    status: "idle",
    position: 0,
    duration: 0,
    buffered: 0,
    current: () => get().queue[get().index],
    playQueue: (tracks, startIndex) => {
      const cur = get().current();
      if (cur && cur.ref === tracks[startIndex]?.ref) {
        set({ queue: tracks, index: startIndex });
        analyser.ensure();
        if (audio.paused) void audio.play();
        return;
      }
      set({ queue: tracks });
      load(startIndex);
    },
    toggle: () => {
      const { status, index } = get();
      if (index < 0) return;
      if (status === "error") return load(index);
      analyser.ensure();
      if (audio.paused) void audio.play().catch(() => set({ status: "paused" }));
      else audio.pause();
    },
    next: () => {
      const { index, queue } = get();
      if (index < queue.length - 1) load(index + 1);
    },
    prev: () => {
      const { index } = get();
      // Standard behavior: restart the song unless we're in its first 3 seconds.
      if (audio.currentTime > 3 || index === 0) {
        audio.currentTime = 0;
        set({ position: 0 });
      } else load(index - 1);
    },
    seek: (sec) => {
      audio.currentTime = sec;
      set({ position: sec });
    },
  };
});

import { AudioAnalyser } from "../audio/analyser";
/** Shared analyser bound to the app's audio element (created lazily on first play). */
export const analyser = new AudioAnalyser(audio);
