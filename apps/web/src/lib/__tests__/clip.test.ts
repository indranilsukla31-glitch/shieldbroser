import { describe, expect, it } from "vitest";
import type { Track } from "@artei/shared/client";
import { clipAllowed } from "../clip";

const track = (noDerivatives: boolean): Track => ({
  ref: "jamendo:1", title: "T", artist: "A", duration: 120, tags: [], instrumental: false, hasLyrics: false,
  license: { name: noDerivatives ? "CC BY-ND 4.0" : "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", attribution: true, nonCommercial: false, noDerivatives, shareAlike: false },
});

describe("clipAllowed", () => {
  it("blocks NoDerivatives tracks (syncing music to video is an adaptation)", () => {
    const r = clipAllowed(track(true));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("CC BY-ND 4.0");
  });
  it("allows other licenses", () => expect(clipAllowed(track(false)).ok).toBe(true));
});
