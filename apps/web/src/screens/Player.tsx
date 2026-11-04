import { motion } from "framer-motion";
import { AlertCircle, ChevronDown } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { usePlayer } from "../store/player";
import { Artwork } from "../components/Artwork";
import { Controls } from "../components/Controls";
import { SeekBar } from "../components/SeekBar";
import { Credit } from "../components/Credit";
import { LikeButton } from "../components/LikeButton";
import { trackHues } from "../lib/format";

export function Player() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const navigate = useNavigate();

  if (!track) return <Navigate to="/" replace />;
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
      {/* Backdrop — replaced by the live visual engine in phase (b). */}
      <div aria-hidden className="absolute inset-0">
        <Artwork track={track} className="absolute inset-0 scale-125 opacity-60 blur-3xl" rounded="rounded-none" />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(80% 60% at 50% 30%, hsl(${a} 80% 50% / 0.25), transparent 70%),
                         linear-gradient(to bottom, transparent 30%, hsl(${b} 40% 4% / 0.95))`,
          }}
        />
      </div>

      <header className="pt-safe relative z-10 flex items-center justify-between px-3">
        <button onClick={() => navigate(-1)} aria-label="Close player"
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-white/10">
          <ChevronDown size={28} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist">Now playing</p>
        <div className="h-12 w-12" />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-8 py-4">
        <motion.div
          key={track.ref}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: status === "playing" ? 1 : 0.94, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="aspect-square w-full max-w-[min(70vw,46vh)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        >
          <Artwork track={track} className="h-full w-full" rounded="rounded-[2rem]" />
        </motion.div>
      </div>

      <div className="pb-safe relative z-10 mx-auto w-full max-w-xl px-3">
        <div className="glass mb-3 rounded-[2rem] px-5 pb-5 pt-4">
          <div className="flex items-start gap-2">
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
