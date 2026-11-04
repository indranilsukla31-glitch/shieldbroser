import type { Lyrics, LyricLine } from "@artei/shared";

const LRC_RE = /^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

/** Normalize catalog-supplied lyric text. Recognizes LRC timestamps when present. */
export function parseLyrics(raw: string | undefined | null, attribution?: string): Lyrics {
  const text = (raw ?? "").replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n").trim();
  if (!text) return { kind: "none", lines: [] };

  const rawLines = text.split("\n").map((l) => l.trim());
  const timed: LyricLine[] = [];
  let lrcHits = 0;
  for (const l of rawLines) {
    const m = LRC_RE.exec(l);
    if (m) {
      lrcHits++;
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      const t = Number(m[1]) * 60 + Number(m[2]) + frac;
      if (m[4]) timed.push({ text: m[4], time: t });
    }
  }
  const nonEmpty = rawLines.filter((l) => l.length > 0);
  if (lrcHits > 0 && lrcHits >= nonEmpty.length * 0.6 && timed.length > 0) {
    timed.sort((a, b) => a.time! - b.time!);
    return { kind: "synced", lines: timed, attribution };
  }
  const lines: LyricLine[] = nonEmpty
    .map((l) => l.replace(LRC_RE, "$4").trim())
    .filter((l) => l.length > 0)
    .map((l) => ({ text: l }));
  if (lines.length === 0) return { kind: "none", lines: [] };
  return { kind: "plain", lines, attribution };
}
