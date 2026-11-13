import { Minus, Plus, RotateCcw, Hand } from "lucide-react";
import type { Lyrics } from "@artei/shared";
import { audio, usePlayer } from "../store/player";
import { useLyrics } from "../store/lyrics";
import { lineAt, nudge, tapSync, type TimedLine } from "../lyrics/timing";

/** Lyric timing controls: ±0.5 s nudges and "tap when this line starts". */
export function LyricsSync({ trackRef, lyrics, lines }: { trackRef: string; lyrics: Lyrics; lines: TimedLine[] }) {
  const anchors = useLyrics((s) => s.anchors[trackRef] ?? []);
  const setAnchors = useLyrics((s) => s.setAnchors);
  // Re-render as playback moves so the upcoming line stays current.
  const t = usePlayer((s) => s.position);
  const cur = lineAt(lines, t);
  const upcoming = lines[Math.min(lines.length - 1, cur + 1)];

  return (
    <div className="space-y-4">
      <p className="text-sm text-mist">
        {lyrics.kind === "synced"
          ? "These lyrics have timestamps. If they drift, nudge them."
          : "These lyrics have no timestamps, so lines are spread evenly across the song. Tap the button right as a line begins to lock the timing — two taps on different lines also fix the pace."}
      </p>
      <button
        onClick={() => setAnchors(trackRef, tapSync(lines, anchors, audio.currentTime))}
        className="flex w-full flex-col items-center gap-1 rounded-2xl bg-glow/90 px-4 py-4 font-semibold text-white active:scale-[0.98]"
      >
        <span className="flex items-center gap-2"><Hand size={18} /> Tap when this line starts</span>
        {upcoming && <span className="line-clamp-1 text-sm font-normal text-white/80">“{upcoming.text}”</span>}
      </button>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setAnchors(trackRef, nudge(lines, anchors, audio.currentTime, -0.5))}
          className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-white/10 text-sm font-medium hover:bg-white/15" aria-label="Show lyrics earlier by half a second">
          <Minus size={16} /> Earlier
        </button>
        <button onClick={() => setAnchors(trackRef, nudge(lines, anchors, audio.currentTime, 0.5))}
          className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-white/10 text-sm font-medium hover:bg-white/15" aria-label="Show lyrics later by half a second">
          <Plus size={16} /> Later
        </button>
        <button onClick={() => setAnchors(trackRef, [])} disabled={anchors.length === 0}
          className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-white/10 text-sm font-medium hover:bg-white/15 disabled:opacity-40">
          <RotateCcw size={16} /> Reset
        </button>
      </div>
      {lyrics.attribution && <p className="text-xs text-dim">{lyrics.attribution}</p>}
    </div>
  );
}
