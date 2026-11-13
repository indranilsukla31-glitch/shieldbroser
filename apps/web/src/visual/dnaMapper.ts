import type { AudioTarget, ColorRole, Moment, VisualDna } from "@artei/shared/client";
import type { AudioFrame } from "../audio/analyser";

export interface FrameParams {
  intensity: number;
  motionSpeed: number;
  emphasis: ColorRole;
  /** Burst envelope 0..1 when entering a moment with particleBurst. */
  burst: number;
  mods: Record<AudioTarget, number>;
  momentIndex: number;
}

const ZERO_MODS = (): Record<AudioTarget, number> => ({
  glow: 0,
  particleSize: 0,
  particleSpeed: 0,
  cameraShake: 0,
  colorShift: 0,
  distortion: 0,
  motionSpeed: 0,
  bloom: 0,
  lyricScale: 0,
});

/** Index of the moment active at `progress` (0..1), or -1 before the first. */
export function momentAt(moments: Moment[], progress: number): number {
  let idx = -1;
  for (let i = 0; i < moments.length; i++) if (progress >= moments[i]!.at) idx = i;
  return idx;
}

/**
 * Turns Visual DNA + the current audio frame + song position into the
 * per-frame parameters the renderer consumes. Pure apart from the burst state.
 */
export class DnaMapper {
  private lastMoment = -2;
  private burst = 0;
  private intensity = 0.5;
  private speed = 0.5;

  constructor(private dna: VisualDna) {
    this.intensity = dna.scene.intensity;
    this.speed = dna.motion.speed;
  }

  setDna(dna: VisualDna) {
    this.dna = dna;
    this.lastMoment = -2;
  }

  frame(audio: AudioFrame, progress: number, dt: number, calm: boolean): FrameParams {
    const { dna } = this;
    const mi = momentAt(dna.moments, progress);
    const m = mi >= 0 ? dna.moments[mi]! : undefined;
    if (mi !== this.lastMoment) {
      if (this.lastMoment !== -2 && m?.shift.particleBurst && !calm) this.burst = 1;
      this.lastMoment = mi;
    }
    this.burst *= Math.exp(-dt * 1.5);

    // Ease toward the active moment's targets (blend with the base DNA).
    const tI = m ? (dna.scene.intensity + m.shift.intensity) / 2 : dna.scene.intensity * 0.85;
    const tS = m ? (dna.motion.speed + m.shift.motionSpeed) / 2 : dna.motion.speed;
    const k = 1 - Math.exp(-dt * 0.8);
    this.intensity += (tI - this.intensity) * k;
    this.speed += (tS - this.speed) * k;

    const mods = ZERO_MODS();
    const audioScale = calm ? 0.3 : 1;
    for (const map of dna.audioMap) {
      mods[map.target] += audio[map.band] * map.amount * audioScale;
    }
    if (calm) mods.cameraShake = 0;

    return {
      intensity: this.intensity,
      motionSpeed: this.speed * (calm ? 0.5 : 1),
      emphasis: m?.shift.paletteEmphasis ?? "primary",
      burst: this.burst,
      mods,
      momentIndex: mi,
    };
  }
}
