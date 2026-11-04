export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Stable 32-bit hash for generating per-track fallback artwork colors. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // murmur3 finalizer: spreads small input differences across all bits
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function trackHues(ref: string): [number, number, number] {
  const h = hash(ref);
  const a = h % 360;
  return [a, (a + 40 + ((h >> 9) % 80)) % 360, (a + 180 + ((h >> 17) % 60)) % 360];
}
