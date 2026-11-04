import type { Track } from "@artei/shared";
import { Artwork } from "./Artwork";
import { formatTime } from "../lib/format";
import { usePlayer } from "../store/player";
import { LikeButton } from "./LikeButton";

export function TrackRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.ref === track.ref);
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5">
      <button type="button" onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Artwork track={track} className="h-12 w-12 shrink-0" rounded="rounded-xl" />
        <div className="min-w-0">
          <p className={`truncate font-medium ${isCurrent ? "text-glow" : ""}`}>{track.title}</p>
          <p className="truncate text-sm text-mist">
            {track.artist} · <span className="text-dim">{track.license.name}</span>
          </p>
        </div>
      </button>
      <span className="hidden text-sm tabular-nums text-dim sm:block">{formatTime(track.duration)}</span>
      <LikeButton track={track} />
    </div>
  );
}
