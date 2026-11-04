import { useState } from "react";
import { usePlayer } from "../store/player";
import { formatTime } from "../lib/format";

export function SeekBar() {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  const pct = duration > 0 ? (shown / duration) * 100 : 0;
  return (
    <div>
      <input
        type="range"
        className="seek"
        min={0}
        max={duration || 1}
        step={0.1}
        value={shown}
        style={{ ["--p" as string]: `${pct}%` }}
        aria-label="Seek"
        aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => {
          if (drag !== null) seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag !== null) seek(drag);
          setDrag(null);
        }}
      />
      <div className="flex justify-between text-xs tabular-nums text-dim">
        <span>{formatTime(shown)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
