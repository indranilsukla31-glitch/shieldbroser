import { create } from "zustand";

type CalmPref = "auto" | "on" | "off";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

interface SettingsState {
  calm: CalmPref;
  setCalm(v: CalmPref): void;
}

export const useSettings = create<SettingsState>((set) => ({
  calm: load<CalmPref>("artei.calm", "auto"),
  setCalm: (calm) => {
    save("artei.calm", calm);
    set({ calm });
  },
}));

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Effective calm mode: explicit user choice, else the OS reduced-motion setting. */
export function useCalm(): boolean {
  const calm = useSettings((s) => s.calm);
  return calm === "on" || (calm === "auto" && prefersReducedMotion());
}

export { load as loadLocal, save as saveLocal };
