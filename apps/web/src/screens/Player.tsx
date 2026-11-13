import { motion } from "framer-motion";
import { AlertCircle, ChevronDown } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { usePlayer } from "../store/player";
import { Artwork } from "../components/Artwork";
import { Controls } from "../components/Controls";
import { SeekBar } from "../components/SeekBar";
import { Credit } from "../components/Credit";
import { LikeButton } from "../components/LikeButton";
import { hash, trackHues } from "../lib/format";
import { useMemo } from "react";
import { presetFor, presetForTags, SCENE_TYPES, type SceneType } from "@artei/shared";
import { VisualCanvas } from "../components/VisualCanvas";
import { useCalm } from "../store/settings";

export function Player() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const navigate = useNavigate();

  const calm = useCalm();
  const { search } = useLocation();
  const dna = useMemo(() => {
    if (!track) return null;
    // ?scene=aurora lets you preview any scene preset.
    const forced = new URLSearchParams(search).get("scene") as SceneType | null;
    if (forced && SCENE_TYPES.includes(forced)) return presetFor(forced);
    return presetForTags(track.tags, hash(track.ref));
  }, [track, search]);

  if (!track || !dna) return <Navigate to="/" replace />;
  const [a, b] = trackHues(track.ref);

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

      <header className="pt-safe relative z-10 flex items-center justify-between px-3">
        <button onClick={() => navigate(-1)} aria-label="Close player"
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-white/10">
          <ChevronDown size={28} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist">Now playing</p>
        <div className="h-12 w-12" />
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
          </div>
          <div className="mt-2">
            <Controls />
          </div>
          <Credit track={track} className="mt-5 border-t border-white/10 pt-3" />
        </div>
      </div>
    </motion.div>
  );
}
