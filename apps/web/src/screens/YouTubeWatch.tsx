import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ExternalLink, Loader2, Pause, Play, SkipBack, SkipForward, Sparkles, Subtitles, Captions, Drum } from "lucide-react";
import { presetFor, presetForTags, SCENE_LABELS, SCENE_TYPES, type SceneType } from "@artei/shared/client";
import { useYouTube, ytPulse } from "../store/youtube";
import { useCalm } from "../store/settings";
import { VisualCanvas } from "../components/VisualCanvas";
import { formatTime, hash } from "../lib/format";

const spring = { type: "spring", stiffness: 320, damping: 34 } as const;

/** Words in Hindi/Punjabi song titles → catalog-style tags the visual presets understand. */
function titleTags(title: string): string[] {
  const t = title.toLowerCase();
  const tags = [t];
  if (/ishq|pyaar|pyar|love|mohabbat|romantic|dil\b|tum\b|saiyaan|sajna/.test(t)) tags.push("chill");
  if (/sad|bewafa|judaai|tanha|dard|breakup|alvida/.test(t)) tags.push("sad");
  if (/party|dance|dj\b|remix|nachde|thumka|club/.test(t)) tags.push("dance");
  return tags;
}

function YtSeek() {
  const position = useYouTube((s) => s.position);
  const duration = useYouTube((s) => s.duration);
  const seek = useYouTube((s) => s.seek);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  const pct = duration > 0 ? (shown / duration) * 100 : 0;
  const commit = () => {
    if (drag !== null) seek(drag);
    setDrag(null);
  };
  return (
    <div>
      <input type="range" className="seek" min={0} max={duration || 1} step={0.5} value={shown}
        style={{ ["--p" as string]: `${pct}%` }} aria-label="Seek"
        onChange={(e) => setDrag(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} />
      <div className="flex justify-between text-xs tabular-nums text-dim">
        <span>{formatTime(shown)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export function YouTubeWatch() {
  const navigate = useNavigate();
  const calm = useCalm();
  const video = useYouTube((s) => s.queue[s.index]);
  const queue = useYouTube((s) => s.queue);
  const index = useYouTube((s) => s.index);
  const status = useYouTube((s) => s.status);
  const error = useYouTube((s) => s.error);
  const captions = useYouTube((s) => s.captions);
  const bpm = useYouTube((s) => s.bpm);
  const { toggle, next, prev, setCaptions, tapBeat, findLyricVideo, setStage, playQueue } = useYouTube.getState();
  const [scene, setScene] = useState<SceneType | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [lyricBusy, setLyricBusy] = useState(false);
  const [tapFlash, setTapFlash] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, [setStage]);

  // New song → back to its own scene.
  useEffect(() => setScene(null), [video?.id]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);

  const dna = useMemo(() => {
    if (scene) return presetFor(scene);
    return video ? presetForTags(titleTags(video.title), hash(video.id)) : presetFor("nebula");
  }, [scene, video]);

  const source = useMemo(
    () => ({
      getAudio: (dt: number) => ytPulse.frame(dt, useYouTube.getState().status === "playing"),
      isPlaying: () => useYouTube.getState().status === "playing",
      getProgress: () => {
        const { position, duration } = useYouTube.getState();
        return duration > 0 ? position / duration : 0;
      },
    }),
    [],
  );

  const cycleScene = () => {
    const cur = scene ?? dna.scene.type;
    const nextScene = SCENE_TYPES[(SCENE_TYPES.indexOf(cur) + 1) % SCENE_TYPES.length]!;
    setScene(nextScene);
    setNote(SCENE_LABELS[nextScene]);
  };

  const onTap = useCallback(() => {
    tapBeat();
    setTapFlash((n) => n + 1);
    if (ytPulse.tapCount < 3) setNote("Keep tapping along to the beat…");
    else setNote(`Visuals locked to ${ytPulse.bpm} BPM`);
  }, [tapBeat]);

  const onLyrics = async () => {
    setLyricBusy(true);
    try {
      const r = await findLyricVideo();
      setNote(r === "swapped" ? "Switched to the lyric video" : "No lyric video found for this song");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setLyricBusy(false);
    }
  };

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate("/yt"));

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-ink" role="dialog" aria-label="YouTube player">
      <div className="absolute inset-0">
        <VisualCanvas dna={dna} calm={calm} source={source} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/80" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="pt-safe flex items-center justify-between px-3 pb-2 pt-2">
          <button onClick={close} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
            <ChevronDown size={26} />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Hits · via YouTube</p>
            <p className="text-xs text-dim">{SCENE_LABELS[dna.scene.type]}</p>
          </div>
          <button onClick={cycleScene} aria-label="Change visual scene" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
            <Sparkles size={20} />
          </button>
        </header>

        {/* YouTubeHost positions the real player exactly over this box. */}
        <div className="px-4">
          <div ref={stageRef} className="mx-auto aspect-video w-[min(100%,720px,calc((100dvh-400px)*16/9))] min-w-[280px] rounded-3xl bg-black/40" />
        </div>

        <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8 pt-5">
          {video ? (
            <>
              <motion.div key={video.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="line-clamp-2 font-display text-xl font-bold leading-tight sm:text-2xl">{video.title}</h1>
                <p className="mt-1 truncate text-sm text-mist">{video.channel}</p>
              </motion.div>

              <div className="mt-4"><YtSeek /></div>

              <div className="mt-2 flex items-center justify-center gap-6">
                <button onClick={prev} aria-label="Previous" className="grid h-12 w-12 place-items-center rounded-full hover:bg-white/10"><SkipBack size={24} fill="currentColor" /></button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={toggle} aria-label={status === "playing" ? "Pause" : "Play"}
                  className="grid h-16 w-16 place-items-center rounded-full bg-fog text-ink shadow-xl">
                  {status === "loading" ? <Loader2 size={26} className="animate-spin" /> : status === "playing" ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </motion.button>
                <button onClick={next} disabled={index >= queue.length - 1} aria-label="Next" className="grid h-12 w-12 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><SkipForward size={24} fill="currentColor" /></button>
              </div>

              <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {video.lyrical ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-fog px-3 py-2 text-xs font-semibold text-ink"><Subtitles size={14} /> Lyrics in video</span>
                ) : (
                  <button onClick={() => void onLyrics()} disabled={lyricBusy} className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold">
                    {lyricBusy ? <Loader2 size={14} className="animate-spin" /> : <Subtitles size={14} />} Lyric video
                  </button>
                )}
                <button onClick={() => setCaptions(!captions)} aria-pressed={captions}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${captions ? "bg-fog text-ink" : "glass"}`}>
                  <Captions size={14} /> Captions
                </button>
                <motion.button key={tapFlash} onClick={onTap} initial={{ scale: tapFlash ? 1.12 : 1 }} animate={{ scale: 1 }}
                  className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" aria-label={`Tap the beat, now ${bpm} BPM`}>
                  <Drum size={14} /> Tap beat · {bpm}
                </motion.button>
                <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer"
                  className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold">
                  <ExternalLink size={14} /> YouTube
                </a>
              </div>

              <AnimatePresence>
                {(note || error) && (
                  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 rounded-xl bg-black/40 px-3 py-2 text-center text-xs text-mist backdrop-blur" role="status">
                    {note ?? error}
                  </motion.p>
                )}
              </AnimatePresence>

              {queue.length > 1 && (
                <section className="mt-6">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-dim">Up next</h2>
                  <ul className="space-y-1">
                    {queue.map((v, i) =>
                      i <= index ? null : (
                        <li key={`${v.id}-${i}`}>
                          <button onClick={() => playQueue(queue, i)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5">
                            <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-lg object-cover" />
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</span>
                              <span className="block truncate text-xs text-dim">{v.channel}</span>
                            </span>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}
              <p className="mt-8 text-center text-[11px] text-dim">
                Played by YouTube's official player. The visuals follow the tempo, not the audio — tap the beat to sync them.
              </p>
            </>
          ) : (
            <p className="mt-10 text-center text-sm text-mist">Nothing playing. Pick a song from Hits.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
