import { useState } from "react";
import { Dna, Heart, Play } from "lucide-react";
import { useCards } from "../store/cards";
import { useVisuals } from "../store/visuals";
import { Sheet } from "../components/Sheet";
import { DnaCardActions, DnaCardFace } from "../components/DnaCard";
import { useNavigate } from "react-router-dom";
import type { SavedCard } from "../api/client";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { TrackRow } from "../components/TrackRow";

export function Library() {
  const liked = useLibrary((s) => s.liked);
  const loaded = useLibrary((s) => s.loaded);
  const playQueue = usePlayer((s) => s.playQueue);
  const cards = useCards((s) => s.cards);
  const cardsLoaded = useCards((s) => s.loaded);
  const setActive = useVisuals((s) => s.setActive);
  const navigate = useNavigate();
  const [open, setOpen] = useState<SavedCard | null>(null);

  const playWithCard = (c: SavedCard) => {
    if (!c.track) return;
    // Play the song with exactly this Visual DNA (base or remix).
    if (c.record.kind === "remix") setActive(c.track.ref, c.record);
    playQueue([c.track], 0);
    setOpen(null);
    navigate("/now");
  };

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
      {cardsLoaded && cards.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center">
          <Dna className="text-glow" />
          <p className="font-medium">No saved cards yet</p>
          <p className="max-w-xs text-sm text-mist">In the player, tap the scene name at the top to see a song's Visual DNA and save it.</p>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const p = c.record.dna.palette;
          return (
            <button key={c.record.id} onClick={() => setOpen(c)} className="overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition hover:ring-white/30"
              style={{ background: `radial-gradient(80% 70% at 20% 20%, ${p.primary}cc, transparent 70%), radial-gradient(70% 70% at 90% 70%, ${p.secondary}aa, transparent 70%), ${p.background}` }}>
              <div className="aspect-[4/5] p-3 flex flex-col justify-end">
                <p className="font-display text-lg font-bold leading-tight text-white">{c.record.dna.sceneName}</p>
                <p className="truncate text-xs text-white/75">{c.track?.title ?? "Unknown track"}</p>
                <div className="mt-2 flex gap-1">
                  {[p.primary, p.secondary, p.accent, p.highlight].map((col, i) => (
                    <span key={i} className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: col }} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title="Visual DNA">
        {open && (
          <>
            <DnaCardFace record={open.record} track={open.track} />
            {open.track && (
              <button onClick={() => playWithCard(open)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-glow font-semibold text-white">
                <Play size={18} fill="currentColor" /> Play with these visuals
              </button>
            )}
            <DnaCardActions record={open.record} track={open.track} />
          </>
        )}
      </Sheet>
    </div>
  );
}
