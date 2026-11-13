import { create } from "zustand";
import type { Lyrics } from "@artei/shared/client";
import { api } from "../api/client";
import { loadLocal, saveLocal } from "./settings";
import type { Anchor } from "../lyrics/timing";

interface LyricsState {
  byRef: Record<string, { status: "loading" | "ready" | "error"; lyrics?: Lyrics }>;
  anchors: Record<string, Anchor[]>;
  load(ref: string): void;
  setAnchors(ref: string, anchors: Anchor[]): void;
}

const key = (ref: string) => `artei.sync.${ref}`;

export const useLyrics = create<LyricsState>((set, get) => ({
  byRef: {},
  anchors: {},
  load: (ref) => {
    if (!(ref in get().anchors)) set((s) => ({ anchors: { ...s.anchors, [ref]: loadLocal<Anchor[]>(key(ref), []) } }));
    const cur = get().byRef[ref];
    if (cur && cur.status !== "error") return;
    set((s) => ({ byRef: { ...s.byRef, [ref]: { status: "loading" } } }));
    api
      .lyrics(ref)
      .then((lyrics) => set((s) => ({ byRef: { ...s.byRef, [ref]: { status: "ready", lyrics } } })))
      // Lyrics are optional: a failure just means the instrumental view.
      .catch(() => set((s) => ({ byRef: { ...s.byRef, [ref]: { status: "error" } } })));
  },
  setAnchors: (ref, anchors) => {
    saveLocal(key(ref), anchors);
    set((s) => ({ anchors: { ...s.anchors, [ref]: anchors } }));
  },
}));
