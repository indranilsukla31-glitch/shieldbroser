import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { Track } from "@artei/shared";
import { useLibrary } from "../store/library";

export function LikeButton({ track, size = 20, className = "" }: { track: Track; size?: number; className?: string }) {
  const liked = useLibrary((s) => s.liked.some((t) => t.ref === track.ref));
  const toggle = useLibrary((s) => s.toggleLike);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={() => void toggle(track)}
      aria-pressed={liked}
      aria-label={liked ? "Remove from liked songs" : "Add to liked songs"}
      className={`grid h-11 w-11 place-items-center rounded-full transition hover:bg-white/10 ${className}`}
    >
      <Heart size={size} className={liked ? "text-glow" : "text-mist"} fill={liked ? "currentColor" : "none"} />
    </motion.button>
  );
}
