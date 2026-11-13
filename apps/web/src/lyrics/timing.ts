import type { Lyrics } from "@artei/shared/client";

export interface TimedLine {
  text: string;
  start: number;
  /** Start of the next line (or the end of the song). */
  end: number;
}

/** A user tap saying "line `index` actually starts at `time` seconds". */
export interface Anchor {
  index: number;
  time: number;
}

const INTRO = 0.08;
const OUTRO = 0.92;

/**
 * Build the line timeline. Synced lyrics use their timestamps (shifted by the
 * latest anchor). Plain lyrics are spread evenly across the song; one anchor
 * shifts them, two anchors also fix the spacing between lines.
 */
export function buildTimeline(lyrics: Lyrics, duration: number, anchors: Anchor[] = []): TimedLine[] {
  const n = lyrics.lines.length;
  if (lyrics.kind === "none" || n === 0 || duration <= 0) return [];
  let starts: number[];

  if (lyrics.kind === "synced") {
    const base = lyrics.lines.map((l) => l.time ?? 0);
    const a = anchors.at(-1);
    const offset = a && a.index < n ? a.time - base[a.index]! : 0;
    starts = base.map((t) => t + offset);
  } else {
    let first = duration * INTRO;
    let step = (duration * (OUTRO - INTRO)) / n;
    const valid = anchors.filter((a) => a.index < n);
    if (valid.length >= 2) {
      const [a1, a2] = valid.slice(-2) as [Anchor, Anchor];
      if (a1.index !== a2.index) {
        const s = (a2.time - a1.time) / (a2.index - a1.index);
        if (s > 0.4 && s < 30) step = s;
      }
      first = a2.time - step * a2.index;
    } else if (valid.length === 1) {
      first = valid[0]!.time - step * valid[0]!.index;
    }
    starts = lyrics.lines.map((_, i) => first + step * i);
  }

  return lyrics.lines.map((l, i) => ({
    text: l.text,
    start: starts[i]!,
    end: i + 1 < n ? starts[i + 1]! : Math.max(starts[i]! + 4, duration),
  }));
}

/** Index of the line being sung at `t`, or -1 before the first line. */
export function lineAt(timeline: TimedLine[], t: number): number {
  let lo = 0;
  let hi = timeline.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid]!.start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Shift every line by `delta` seconds (the ± nudge buttons), expressed as a new anchor. */
export function nudge(timeline: TimedLine[], anchors: Anchor[], t: number, delta: number): Anchor[] {
  const i = Math.max(0, lineAt(timeline, t));
  const line = timeline[i];
  if (!line) return anchors;
  // Keep the spacing defined by earlier anchors by shifting all of them.
  if (anchors.length >= 2) return anchors.map((a) => ({ ...a, time: a.time + delta }));
  return [{ index: i, time: line.start + delta }];
}

/** "This line starts now": anchor the upcoming (or current) line to `t`. */
export function tapSync(timeline: TimedLine[], anchors: Anchor[], t: number): Anchor[] {
  const cur = lineAt(timeline, t);
  // Tapping usually happens just as the next line begins; pick whichever line start is closest.
  const candidates = [cur, cur + 1].filter((i) => i >= 0 && i < timeline.length);
  if (candidates.length === 0) return anchors;
  const index = candidates.reduce((best, i) => (Math.abs(timeline[i]!.start - t) < Math.abs(timeline[best]!.start - t) ? i : best));
  const next = [...anchors.filter((a) => a.index !== index), { index, time: t }];
  return next.slice(-2);
}
