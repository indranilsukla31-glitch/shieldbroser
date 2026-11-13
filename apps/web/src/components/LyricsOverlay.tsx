import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { VisualDna } from "@artei/shared/client";
import { LyricsLayer } from "../lyrics/layer";
import type { TimedLine } from "../lyrics/timing";
import type { EngineFrame } from "../visual/engine";
import { audio } from "../store/player";
import { ensureFont } from "../lib/fonts";

export interface LyricsOverlayHandle {
  draw(frame: EngineFrame): void;
  canvas: HTMLCanvasElement | null;
}

interface Props {
  dna: VisualDna;
  lines: TimedLine[];
  calm: boolean;
  insetTop: number;
  insetBottom: number;
  lowPower: boolean;
}

/** Canvas layer for in-scene lyrics; drawn in lockstep with the visual engine. */
export const LyricsOverlay = forwardRef<LyricsOverlayHandle, Props>(function LyricsOverlay(
  { dna, lines, calm, insetTop, insetBottom, lowPower },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<LyricsLayer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const layer = new LyricsLayer(canvas, lowPower);
    layerRef.current = layer;
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect;
      layer.resize(r.width, r.height, window.devicePixelRatio || 1);
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      layerRef.current = null;
    };
  }, [lowPower]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.setDna(dna);
    // Re-measure once the DNA's font has actually loaded.
    void ensureFont(dna.typography.family, dna.typography.weight).then(() => layerRef.current?.setDna(dna));
  }, [dna]);
  useEffect(() => layerRef.current?.setLines(lines), [lines]);
  useEffect(() => {
    if (layerRef.current) layerRef.current.calm = calm;
  }, [calm]);
  useEffect(() => layerRef.current?.setInsets(insetTop, insetBottom), [insetTop, insetBottom]);

  useImperativeHandle(ref, () => ({
    draw: (frame) => layerRef.current?.draw(audio.currentTime, frame),
    get canvas() {
      return canvasRef.current;
    },
  }));

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block h-full w-full" aria-hidden />;
});
