import { motion } from "framer-motion";
import { Play } from "lucide-react";
import type { Track } from "@artei/shared/client";
import { Artwork } from "./Artwork";
import { usePlayer } from "../store/player";

export function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.ref === track.ref);
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="group w-36 shrink-0 snap-start text-left sm:w-44"
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      <div className="relative">
        <Artwork track={track} className="aspect-square w-full" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        <span
          className={`absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-fog text-ink shadow-lg transition
            ${isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
        >
          <Play size={18} fill="currentColor" />
        </span>
      </div>
      <p className={`mt-2 truncate text-sm font-semibold ${isCurrent ? "text-glow" : "text-fog"}`}>{track.title}</p>
      <p className="truncate text-xs text-mist">{track.artist}</p>
    </motion.button>
  );
}
