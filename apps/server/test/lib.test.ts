import { describe, expect, it } from "vitest";
import { parseLicenseUrl } from "../src/lib/license.js";
import { parseLyrics } from "../src/lib/lyrics.js";
import { parseRange } from "../src/lib/range.js";
import { parseTrackRef } from "@artei/shared";

describe("parseLicenseUrl", () => {
  it("parses CC BY-NC-SA", () => {
    const l = parseLicenseUrl("http://creativecommons.org/licenses/by-nc-sa/3.0/");
    expect(l).toMatchObject({ name: "CC BY-NC-SA 3.0", attribution: true, nonCommercial: true, shareAlike: true, noDerivatives: false });
    expect(l.url.startsWith("https://")).toBe(true);
  });
  it("flags ND", () => {
    expect(parseLicenseUrl("https://creativecommons.org/licenses/by-nd/4.0/").noDerivatives).toBe(true);
  });
  it("handles CC0", () => {
    expect(parseLicenseUrl("https://creativecommons.org/publicdomain/zero/1.0/")).toMatchObject({ attribution: false, noDerivatives: false });
  });
  it("treats unknown licenses as most restrictive", () => {
    expect(parseLicenseUrl("")).toMatchObject({ noDerivatives: true, nonCommercial: true });
  });
});

describe("parseLyrics", () => {
  it("returns none for empty", () => expect(parseLyrics("").kind).toBe("none"));
  it("splits plain lyrics and drops blank lines", () => {
    const l = parseLyrics("a<br/>b\n\nc");
    expect(l.kind).toBe("plain");
    expect(l.lines.map((x) => x.text)).toEqual(["a", "b", "c"]);
  });
  it("detects LRC timestamps", () => {
    const l = parseLyrics("[00:05.50]hello\n[01:02]world");
    expect(l.kind).toBe("synced");
    expect(l.lines).toEqual([{ text: "hello", time: 5.5 }, { text: "world", time: 62 }]);
  });
});

describe("parseRange", () => {
  it("parses open and suffix ranges", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=10-2000", 100)).toEqual({ start: 10, end: 99 });
  });
  it("rejects bad ranges", () => {
    expect(parseRange("bytes=200-", 100)).toBe("unsatisfiable");
    expect(parseRange("nonsense", 100)).toBeNull();
  });
});

describe("parseTrackRef", () => {
  it("accepts known sources only", () => {
    expect(parseTrackRef("jamendo:123")).toEqual({ source: "jamendo", id: "123" });
    expect(parseTrackRef("spotify:123")).toBeNull();
    expect(parseTrackRef("jamendo:../../etc")).toBeNull();
  });
});
