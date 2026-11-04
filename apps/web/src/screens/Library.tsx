import { Heart } from "lucide-react";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { TrackRow } from "../components/TrackRow";

export function Library() {
  const liked = useLibrary((s) => s.liked);
  const loaded = useLibrary((s) => s.loaded);
  const playQueue = usePlayer((s) => s.playQueue);
  return (
    <div className="pt-safe mx-auto max-w-3xl px-4 pb-6 sm:px-8">
      <h1 className="pt-8 font-display text-3xl font-extrabold tracking-tight">Library</h1>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-widest text-dim">Liked songs</h2>
      <div className="mt-2">
        {!loaded && <p className="text-sm text-dim">Loading…</p>}
        {loaded && liked.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
            <Heart className="text-glow" />
            <p className="font-medium">No liked songs yet</p>
            <p className="max-w-xs text-sm text-mist">Tap the heart on any song and it lands here. No account needed.</p>
          </div>
        )}
        {liked.map((t, i) => <TrackRow key={t.ref} track={t} onPlay={() => playQueue(liked, i)} />)}
      </div>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-dim">Visual DNA cards</h2>
      <p className="mt-2 text-sm text-dim">Saved cards will appear here once Visual DNA arrives.</p>
    </div>
  );
}
