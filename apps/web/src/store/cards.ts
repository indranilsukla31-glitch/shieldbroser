import { create } from "zustand";
import type { Track, VisualDnaRecord } from "@artei/shared";
import { api, type SavedCard } from "../api/client";

interface CardsState {
  cards: SavedCard[];
  loaded: boolean;
  load(): Promise<void>;
  toggle(record: VisualDnaRecord, track: Track | null): Promise<void>;
}

export const useCards = create<CardsState>((set, get) => ({
  cards: [],
  loaded: false,
  load: async () => {
    try {
      const { cards } = await api.cards();
      set({ cards, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  toggle: async (record, track) => {
    const was = get().cards.some((c) => c.record.id === record.id);
    const prev = get().cards;
    set({ cards: was ? prev.filter((c) => c.record.id !== record.id) : [{ record, track, savedAt: Date.now() }, ...prev] });
    try {
      if (was) await api.unsaveCard(record.id);
      else await api.saveCard(record.id);
    } catch {
      set({ cards: prev });
    }
  },
}));
