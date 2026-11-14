import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { mountYouTubePlayer, useYouTube } from "../store/youtube";

/**
 * The one embedded YouTube player for the whole app. It's never unmounted while
 * in use (so playback survives navigation): on the watch screen it sits over the
 * stage placeholder; elsewhere it shrinks to a small floating window. YouTube's
 * terms need the player visible while it plays, so it's never hidden mid-song.
 */
export function YouTubeHost() {
  const hasVideo = useYouTube((s) => s.index >= 0);
  const stage = useYouTube((s) => s.stage);
  const status = useYouTube((s) => s.status);
  const title = useYouTube((s) => s.queue[s.index]?.title);
  const toggle = useYouTube((s) => s.toggle);
  const close = useYouTube((s) => s.close);
  const [used, setUsed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (hasVideo) setUsed(true);
  }, [hasVideo]);

  useEffect(() => {
    if (!used || !mountRef.current) return;
    // The API replaces its target with an iframe, so give it a node React doesn't own.
    const target = document.createElement("div");
    mountRef.current.appendChild(target);
    void mountYouTubePlayer(target);
  }, [used]);

  // Follow the stage placeholder every frame (it animates in with the watch screen).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (!stage) {
      box.style.cssText = "";
      return;
    }
    let raf = 0;
    const follow = () => {
      const r = stage.getBoundingClientRect();
      box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;right:auto;bottom:auto;`;
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [stage, used]);

  if (!used) return null;
  const mini = !stage;
  const hidden = !hasVideo;

  return (
    <div
      ref={boxRef}
      className={`fixed overflow-hidden bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-[opacity,border-radius] duration-300
        ${mini ? "bottom-[10.5rem] right-3 z-[35] w-56 rounded-2xl sm:w-72" : "z-[45] rounded-3xl"}
        ${hidden ? "pointer-events-none invisible opacity-0" : "opacity-100"}`}
    >
      <div className={mini ? "aspect-video w-full" : "h-full w-full"}>
        <div ref={mountRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>
      {mini && !hidden && pathname !== "/yt/watch" && (
        <div className="flex items-center gap-1 bg-ink-2/95 px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-mist">{title}</p>
          <button onClick={toggle} aria-label={status === "playing" ? "Pause" : "Play"} className="grid h-7 w-7 place-items-center rounded-full text-fog hover:bg-white/10">
            {status === "playing" ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <button onClick={() => navigate("/yt/watch")} aria-label="Open YouTube player" className="grid h-7 w-7 place-items-center rounded-full text-fog hover:bg-white/10">
            <Maximize2 size={14} />
          </button>
          <button onClick={close} aria-label="Close YouTube player" className="grid h-7 w-7 place-items-center rounded-full text-fog hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
