import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../store/player";
import { Artwork } from "./Artwork";
import { PlayPauseIcon } from "./Controls";

export function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index]);
  const toggle = usePlayer((s) => s.toggle);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="glass relative mx-3 mb-2 overflow-hidden rounded-2xl sm:mx-auto sm:max-w-xl"
        >
          <div className="flex items-center gap-3 p-2 pr-3">
            <button type="button" onClick={() => navigate("/now")} className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label="Open player">
              <Artwork track={track} className="h-11 w-11 shrink-0" rounded="rounded-xl" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{track.title}</p>
                <p className="truncate text-xs text-mist">{track.artist}</p>
              </div>
            </button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={toggle} aria-label="Play or pause"
              className="grid h-11 w-11 place-items-center rounded-full bg-fog text-ink">
              <PlayPauseIcon size={20} />
            </motion.button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
            <div className="h-full bg-glow" style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
