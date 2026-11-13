import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, Dna, Loader2, Maximize2, Minimize2, Music2, Timer } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { presetFor, presetForTags, SCENE_TYPES, type SceneType } from "@artei/shared";
import { usePlayer } from "../store/player";
import { useCalm } from "../store/settings";
import { currentRecord, useVisuals } from "../store/visuals";
import { useLyrics } from "../store/lyrics";
import { Artwork } from "../components/Artwork";
import { Controls } from "../components/Controls";
import { SeekBar } from "../components/SeekBar";
import { Credit } from "../components/Credit";
import { LikeButton } from "../components/LikeButton";
import { VisualCanvas } from "../components/VisualCanvas";
import { MoodTimeline } from "../components/MoodTimeline";
import { Sheet } from "../components/Sheet";
import { DnaCardActions, DnaCardFace } from "../components/DnaCard";
import { LyricsOverlay, type LyricsOverlayHandle } from "../components/LyricsOverlay";
import { LyricsSync } from "../components/LyricsSync";
import { buildTimeline, lineAt } from "../lyrics/timing";
import { hash, trackHues } from "../lib/format";
import type { EngineFrame, VisualEngine } from "../visual/engine";

const spring = { type: "spring", stiffness: 300, damping: 32 } as const;

export function Player() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const duration = usePlayer((s) => s.duration);
  const navigate = useNavigate();
  const calm = useCalm();
  const { search } = useLocation();

  const entry = useVisuals((s) => (track ? s.byRef[track.ref] : undefined));
  const loadDna = useVisuals((s) => s.load);
  const lyricsEntry = useLyrics((s) => (track ? s.byRef[track.ref] : undefined));
  const anchors = useLyrics((s) => (track ? s.anchors[track.ref] : undefined));
  const loadLyrics = useLyrics((s) => s.load);

  const [sheet, setSheet] = useState<null | "dna" | "sync">(null);
  const [focus, setFocus] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [engine, setEngine] = useState<VisualEngine | null>(null);
  const [panelH, setPanelH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const overlayRef = useRef<LyricsOverlayHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!track) return;
    loadDna(track);
    loadLyrics(track.ref);
  }, [track, loadDna, loadLyrics]);

  const record = currentRecord(entry);
  const dna = useMemo(() => {
    if (!track) return null;
    // ?scene=aurora previews any scene preset (handy for testing the engine).
    const forced = new URLSearchParams(search).get("scene") as SceneType | null;
    if (forced && SCENE_TYPES.includes(forced)) return presetFor(forced);
    // Show a preset instantly; swap to Claude's Visual DNA as soon as it arrives.
    return record?.dna ?? presetForTags(track.tags, hash(track.ref));
  }, [track, search, record]);

  const lyrics = lyricsEntry?.lyrics;
  const lines = useMemo(
    () => (lyrics ? buildTimeline(lyrics, duration || track?.duration || 0, anchors ?? []) : []),
    [lyrics, duration, track, anchors],
  );
  const lyricsReady = lyricsEntry?.status === "ready" || lyricsEntry?.status === "error";
  const instrumental = lyricsReady && lines.length === 0;

  // Keep lyrics clear of the header and the control panel (full screen in focus mode).
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setPanelH(panelRef.current?.getBoundingClientRect().height ?? 0);
      setHeaderH(headerRef.current?.getBoundingClientRect().height ?? 0);
    });
    if (panelRef.current) ro.observe(panelRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, [focus]);

  const onFrame = useCallback((f: EngineFrame) => overlayRef.current?.draw(f), []);

  // Focus mode: hide all UI, go fullscreen where supported, Esc or tap to get out.
  const enterFocus = () => {
    setFocus(true);
    setFocusHint(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitFocus = useCallback(() => {
    setFocus(false);
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitFocus();
    const onFs = () => !document.fullscreenElement && setFocus(false);
    addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [focus, exitFocus]);
  useEffect(() => {
    if (!focusHint) return;
    const id = setTimeout(() => setFocusHint(false), 2500);
    return () => clearTimeout(id);
  }, [focusHint]);

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
      {/* Fallback gradient (visible if WebGL is unavailable), then the live visuals and lyrics. */}
      <div aria-hidden className="absolute inset-0"
        style={{ background: `radial-gradient(80% 60% at 50% 30%, hsl(${a} 70% 40% / 0.5), transparent 70%), hsl(${b} 40% 6%)` }} />
      <div className="absolute inset-0" onClick={() => focus && setFocusHint(true)}>
        <VisualCanvas dna={dna} calm={calm} onFrame={onFrame} onEngine={setEngine} />
        <LyricsOverlay
          ref={overlayRef}
          dna={dna}
          lines={lines}
          calm={calm}
          insetTop={focus ? 0 : headerH}
          insetBottom={focus ? 0 : panelH}
          lowPower={engine?.tier === "low"}
        />
      </div>

      {/* Screen-reader copy of the current line (the canvas is decorative). */}
      <CurrentLineForScreenReaders lines={lines} />

      <AnimatePresence>
        {focus && focusHint && (
          <motion.button initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onClick={exitFocus} className="glass pt-safe absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            <Minimize2 size={16} /> Exit focus
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!focus && (
          <motion.header ref={headerRef} key="header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={spring}
            className="pt-safe relative z-10 flex items-center justify-between gap-2 px-3">
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
                onClick={() => record && setSheet("dna")}
                className="glass flex min-w-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
                aria-label={designing ? "Claude is designing the visuals" : `Visual DNA: ${dna.sceneName}`}
              >
                {designing ? <Loader2 size={14} className="animate-spin" /> : <Dna size={14} className="text-glow" />}
                <span className="truncate">{designing ? "Designing visuals…" : dna.sceneName}</span>
              </motion.button>
            </AnimatePresence>
            <div className="flex shrink-0">
              {lines.length > 0 && (
                <button onClick={() => setSheet("sync")} aria-label="Lyrics timing" className="grid h-12 w-10 place-items-center rounded-full hover:bg-white/10">
                  <Timer size={20} />
                </button>
              )}
              <button onClick={enterFocus} aria-label="Focus mode" className="grid h-12 w-10 place-items-center rounded-full hover:bg-white/10">
                <Maximize2 size={20} />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-1 items-start justify-center pt-2">
        <AnimatePresence>
          {instrumental && !focus && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-mist">
              <Music2 size={12} /> Instrumental · no lyrics
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!focus && (
          <motion.div key="panel" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={spring}
            className="pb-safe relative z-10 mx-auto w-full max-w-xl px-3">
            <div ref={panelRef} className="glass mb-3 rounded-[2rem] px-5 pb-5 pt-4">
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
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={sheet === "dna"} onClose={() => setSheet(null)} title="Visual DNA">
        {record && (
          <>
            <DnaCardFace record={record} track={track} />
            <DnaCardActions record={record} track={track} />
          </>
        )}
      </Sheet>
      <Sheet open={sheet === "sync"} onClose={() => setSheet(null)} title="Lyrics timing">
        {lyrics && <LyricsSync trackRef={track.ref} lyrics={lyrics} lines={lines} />}
      </Sheet>
    </motion.div>
  );
}

function CurrentLineForScreenReaders({ lines }: { lines: ReturnType<typeof buildTimeline> }) {
  const position = usePlayer((s) => s.position);
  const idx = lineAt(lines, position);
  const line = idx >= 0 ? lines[idx] : undefined;
  return (
    <p className="sr-only" aria-live="polite">
      {line?.text ?? ""}
    </p>
  );
}
