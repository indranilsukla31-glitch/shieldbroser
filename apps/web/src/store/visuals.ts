import { create } from "zustand";
import type { Track, VisualDnaRecord } from "@artei/shared/client";
import { api } from "../api/client";

interface Entry {
  status: "loading" | "ready" | "error";
  base?: VisualDnaRecord;
  /** The user's chosen remix (overrides base while set). */
  active?: VisualDnaRecord;
}

interface VisualsState {
  byRef: Record<string, Entry>;
  load(track: Track): void;
  setActive(ref: string, record: VisualDnaRecord | undefined): void;
}

/** Visual DNA per track: fetched once (server caches it), remix selection kept per session. */
export const useVisuals = create<VisualsState>((set, get) => ({
  byRef: {},
  load: (track) => {
    const cur = get().byRef[track.ref];
    if (cur && cur.status !== "error") return;
    set((s) => ({ byRef: { ...s.byRef, [track.ref]: { ...cur, status: "loading" } } }));
    api
      .visualDna(track.ref)
      .then(({ record }) =>
        set((s) => ({ byRef: { ...s.byRef, [track.ref]: { ...s.byRef[track.ref], status: "ready", base: record } } })),
      )
      .catch(() => set((s) => ({ byRef: { ...s.byRef, [track.ref]: { ...s.byRef[track.ref], status: "error" } } })));
  },
  setActive: (ref, record) =>
    set((s) => ({ byRef: { ...s.byRef, [ref]: { ...(s.byRef[ref] ?? { status: "ready" }), active: record } } })),
}));

export function currentRecord(e: Entry | undefined): VisualDnaRecord | undefined {
  return e?.active ?? e?.base;
}
