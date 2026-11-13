import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, Dna, Loader2 } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { presetFor, presetForTags, SCENE_TYPES, type SceneType } from "@artei/shared";
import { usePlayer } from "../store/player";
import { useCalm } from "../store/settings";
import { currentRecord, useVisuals } from "../store/visuals";
import { Artwork } from "../components/Artwork";
import { Controls } from "../components/Controls";
import { SeekBar } from "../components/SeekBar";
import { Credit } from "../components/Credit";
import { LikeButton } from "../components/LikeButton";
import { VisualCanvas } from "../components/VisualCanvas";
import { MoodTimeline } from "../components/MoodTimeline";
import { Sheet } from "../components/Sheet";
import { DnaCardActions, DnaCardFace } from "../components/DnaCard";
import { hash, trackHues } from "../lib/format";

export function Player() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const navigate = useNavigate();
  const calm = useCalm();
  const { search } = useLocation();
  const entry = useVisuals((s) => (track ? s.byRef[track.ref] : undefined));
  const loadDna = useVisuals((s) => s.load);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    if (track) loadDna(track);
  }, [track, loadDna]);

  const record = currentRecord(entry);
  const dna = useMemo(() => {
    if (!track) return null;
    // ?scene=aurora previews any scene preset (handy for testing the engine).
    const forced = new URLSearchParams(search).get("scene") as SceneType | null;
    if (forced && SCENE_TYPES.includes(forced)) return presetFor(forced);
    // Show a preset instantly; swap to Claude's Visual DNA as soon as it arrives.
    return record?.dna ?? presetForTags(track.tags, hash(track.ref));
  }, [track, search, record]);

  if (!track || !dna) return <Navigate to="/" replace />;
  const [a, b] = trackHues(track.ref);
  const designing = entry?.status === "loading";

  return (
    <motion.div
      key="player"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-ink"
    >
      {/* Fallback gradient (visible if WebGL is unavailable), then the live visuals. */}
      <div aria-hidden className="absolute inset-0"
        style={{ background: `radial-gradient(80% 60% at 50% 30%, hsl(${a} 70% 40% / 0.5), transparent 70%), hsl(${b} 40% 6%)` }} />
      <div className="absolute inset-0">
        <VisualCanvas dna={dna} calm={calm} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

      <header className="pt-safe relative z-10 flex items-center justify-between gap-2 px-3">
        <button onClick={() => navigate(-1)} aria-label="Close player"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full hover:bg-white/10">
          <ChevronDown size={28} />
        </button>
        <AnimatePresence mode="wait">
          <motion.button
            key={designing ? "designing" : dna.sceneName}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={() => record && setCardOpen(true)}
            className="glass flex min-w-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            aria-label={designing ? "Claude is designing the visuals" : `Visual DNA: ${dna.sceneName}`}
          >
            {designing ? <Loader2 size={14} className="animate-spin" /> : <Dna size={14} className="text-glow" />}
            <span className="truncate">{designing ? "Designing visuals…" : dna.sceneName}</span>
          </motion.button>
        </AnimatePresence>
        <div className="h-12 w-12 shrink-0" />
      </header>

      <div className="relative z-10 flex-1" />

      <div className="pb-safe relative z-10 mx-auto w-full max-w-xl px-3">
        <div className="glass mb-3 rounded-[2rem] px-5 pb-5 pt-4">
          <div className="flex items-start gap-3">
            <Artwork track={track} className="h-14 w-14 shrink-0" rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{track.title}</h1>
              <p className="truncate text-mist">{track.artist}</p>
            </div>
            <LikeButton track={track} size={24} />
          </div>
          {status === "error" && (
            <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle size={16} /> {error} Tap play to retry.
            </p>
          )}
          <div className="mt-3">
            <SeekBar />
            <MoodTimeline dna={dna} />
          </div>
          <div className="mt-1">
            <Controls />
          </div>
          <Credit track={track} className="mt-5 border-t border-white/10 pt-3" />
        </div>
      </div>

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title="Visual DNA">
        {record && (
          <>
            <DnaCardFace record={record} track={track} />
            <DnaCardActions record={record} track={track} />
          </>
        )}
      </Sheet>
    </motion.div>
  );
}
