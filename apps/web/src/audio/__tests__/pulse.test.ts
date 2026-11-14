import { describe, expect, it } from "vitest";
import { BeatPulse } from "../pulse";
import { songQuery } from "../../youtube/iframe";

describe("BeatPulse", () => {
  it("locks tempo to steady taps", () => {
    const p = new BeatPulse(96);
    [0, 500, 1000, 1500].forEach((t) => p.tap(t));
    expect(p.bpm).toBe(120);
  });

  it("ignores a stale tap sequence and clamps silly tempos", () => {
    const p = new BeatPulse(96);
    p.tap(0);
    p.tap(100);
    p.tap(10_000); // >2 s gap starts over
    expect(p.tapCount).toBe(1);
    [10_100, 10_200, 10_300].forEach((t) => p.tap(t));
    expect(p.bpm).toBe(190);
  });

  it("fires one beat per period while playing and none while paused", () => {
    const p = new BeatPulse(120);
    p.reset(120);
    let hits = 0;
    const start = performance.now();
    for (let ms = 0; ms < 2000; ms += 16) if (p.frame(0.016, true, start + ms).beatHit) hits++;
    expect(hits).toBeGreaterThanOrEqual(4);
    expect(hits).toBeLessThanOrEqual(5);
    expect(p.frame(0.016, false, start + 2100).beatHit).toBe(false);
  });
});

describe("songQuery", () => {
  it("strips video noise from YouTube titles", () => {
    expect(songQuery("Kesariya - Brahmastra | Ranbir Kapoor | Official Video (4K)")).toBe("Kesariya - Brahmastra");
    expect(songQuery("Tum Hi Ho [Full Video Song] Aashiqui 2")).toBe("Tum Hi Ho Aashiqui 2");
  });
});
