import { motion } from "framer-motion";
import { Loader2, Pause, Play, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "../store/player";

const spring = { type: "spring", stiffness: 500, damping: 28 } as const;

export function PlayPauseIcon({ size }: { size: number }) {
  const status = usePlayer((s) => s.status);
  if (status === "loading") return <Loader2 size={size} className="animate-spin" />;
  if (status === "error") return <RotateCw size={size} />;
  if (status === "playing") return <Pause size={size} fill="currentColor" />;
  return <Play size={size} fill="currentColor" className="translate-x-[2px]" />;
}

export function Controls() {
  const { toggle, next, prev, index, queue, status } = usePlayer();
  return (
    <div className="flex items-center justify-center gap-6 sm:gap-10">
      <motion.button whileTap={{ scale: 0.85 }} transition={spring} onClick={prev} aria-label="Previous"
        className="grid h-14 w-14 place-items-center rounded-full text-fog hover:bg-white/10">
        <SkipBack size={28} fill="currentColor" />
      </motion.button>
      <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={toggle}
        aria-label={status === "playing" ? "Pause" : "Play"}
        className="grid h-20 w-20 place-items-center rounded-full bg-fog text-ink shadow-[0_10px_40px_-8px_rgba(255,79,154,0.55)]">
        <PlayPauseIcon size={32} />
      </motion.button>
      <motion.button whileTap={{ scale: 0.85 }} transition={spring} onClick={next} aria-label="Next"
        disabled={index >= queue.length - 1}
        className="grid h-14 w-14 place-items-center rounded-full text-fog hover:bg-white/10 disabled:opacity-30">
        <SkipForward size={28} fill="currentColor" />
      </motion.button>
    </div>
  );
}
