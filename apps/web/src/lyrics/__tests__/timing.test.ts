import { describe, expect, it } from "vitest";
import type { Lyrics } from "@artei/shared/client";
import { buildTimeline, lineAt, nudge, tapSync } from "../timing";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

const plain: Lyrics = { kind: "plain", lines: ["a", "b", "c", "d"].map((text) => ({ text })) };
const synced: Lyrics = { kind: "synced", lines: [{ text: "a", time: 10 }, { text: "b", time: 20 }, { text: "c", time: 30 }] };

describe("buildTimeline", () => {
  it("spreads plain lyrics evenly between intro and outro", () => {
    const tl = buildTimeline(plain, 100);
    close(tl.map((l) => l.start), [8, 29, 50, 71]);
    expect(tl[3]!.end).toBe(100);
  });

  it("uses timestamps for synced lyrics", () => {
    expect(buildTimeline(synced, 60).map((l) => l.start)).toEqual([10, 20, 30]);
  });

  it("returns nothing for instrumentals", () => {
    expect(buildTimeline({ kind: "none", lines: [] }, 100)).toEqual([]);
  });

  it("one anchor shifts, two anchors also re-space plain lyrics", () => {
    close(buildTimeline(plain, 100, [{ index: 1, time: 40 }]).map((l) => l.start), [19, 40, 61, 82]);
    close(buildTimeline(plain, 100, [{ index: 0, time: 10 }, { index: 2, time: 30 }]).map((l) => l.start), [10, 20, 30, 40]);
  });

  it("offsets synced lyrics from the latest anchor", () => {
    expect(buildTimeline(synced, 60, [{ index: 1, time: 22 }]).map((l) => l.start)).toEqual([12, 22, 32]);
  });
});

describe("lineAt / nudge / tapSync", () => {
  const tl = buildTimeline(plain, 100);
  it("finds the active line", () => {
    expect(lineAt(tl, 0)).toBe(-1);
    expect(lineAt(tl, 30)).toBe(1);
    expect(lineAt(tl, 99)).toBe(3);
  });
  it("nudges everything by the delta", () => {
    const anchors = nudge(tl, [], 30, 0.5);
    expect(buildTimeline(plain, 100, anchors)[1]!.start).toBeCloseTo(29.5);
  });
  it("tap anchors the closest line start", () => {
    expect(tapSync(tl, [], 48)).toEqual([{ index: 2, time: 48 }]);
    expect(tapSync(tl, [], 31)).toEqual([{ index: 1, time: 31 }]);
  });
});
