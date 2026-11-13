import { create } from "zustand";
import type { Track } from "@artei/shared/client";
import { api } from "../api/client";

interface LibraryState {
  liked: Track[];
  loaded: boolean;
  load(): Promise<void>;
  isLiked(ref: string): boolean;
  toggleLike(track: Track): Promise<void>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  liked: [],
  loaded: false,
  load: async () => {
    try {
      const { tracks } = await api.likes();
      set({ liked: tracks, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  isLiked: (ref) => get().liked.some((t) => t.ref === ref),
  toggleLike: async (track) => {
    const was = get().isLiked(track.ref);
    // optimistic update, rolled back on failure
    set({ liked: was ? get().liked.filter((t) => t.ref !== track.ref) : [track, ...get().liked] });
    try {
      if (was) await api.unlike(track.ref);
      else await api.like(track.ref);
    } catch {
      set({ liked: was ? [track, ...get().liked] : get().liked.filter((t) => t.ref !== track.ref) });
    }
  },
}));
