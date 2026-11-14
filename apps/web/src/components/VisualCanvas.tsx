import { useEffect, useRef } from "react";
import type { VisualDna } from "@artei/shared/client";
import { VisualEngine, type EngineFrame } from "../visual/engine";
import type { AudioFrame } from "../audio/analyser";
import { analyser, audio, usePlayer } from "../store/player";

interface Props {
  dna: VisualDna;
  calm: boolean;
  onFrame?: (f: EngineFrame) => void;
  onEngine?: (e: VisualEngine | null) => void;
  className?: string;
  /** Alternative audio source (YouTube mode's synthetic beat). Defaults to Artei's player. */
  source?: { getAudio(dt: number): AudioFrame; isPlaying(): boolean; getProgress(): number };
}

/** Full-bleed WebGL canvas running the visual engine for the current track. */
export function VisualCanvas({ dna, calm, onFrame, onEngine, className = "", source }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualEngine | null>(null);
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;
  const src = useRef(source);
  src.current = source;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let engine: VisualEngine;
    try {
      engine = new VisualEngine(canvas, dna, {
        calm,
        getAudio: (dt) => src.current?.getAudio(dt) ?? analyser.frame(dt, !audio.paused),
        getProgress: () => {
          if (src.current) return src.current.getProgress();
          const { position, duration } = usePlayer.getState();
          return duration > 0 ? position / duration : 0;
        },
        isPlaying: () => src.current?.isPlaying() ?? !audio.paused,
        onFrame: (f) => frameCb.current?.(f),
        tier: (new URLSearchParams(location.search).get("tier") as "low" | "mid" | "high" | null) ?? undefined,
      });
    } catch (e) {
      // No WebGL: the gradient backdrop behind the canvas stays visible.
      console.warn("WebGL unavailable", e);
      return;
    }
    engineRef.current = engine;
    onEngine?.(engine);
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      engine.resize(r.width, r.height);
    });
    ro.observe(canvas);
    engine.start();
    return () => {
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
      onEngine?.(null);
    };
    // engine lives for the component's lifetime; dna/calm updates go through setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => engineRef.current?.setDna(dna), [dna]);
  useEffect(() => engineRef.current?.setCalm(calm), [calm]);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} aria-hidden />;
}
