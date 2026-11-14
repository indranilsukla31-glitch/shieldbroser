import type { AudioFrame } from "./analyser";

/**
 * A synthetic beat for YouTube mode. The embedded YouTube player's audio can't
 * be analysed (it plays inside YouTube's iframe), so the visuals follow a tempo
 * instead: a sensible default, or the listener's own taps.
 */
export class BeatPulse {
  bpm: number;
  private origin = 0;
  private taps: number[] = [];
  private lastBeatIndex = -1;
  private beat = 0;
  private clock = 0;

  constructor(bpm = 96) {
    this.bpm = bpm;
  }

  /** Record a tap (ms timestamp). After 3+ steady taps the tempo and phase lock to them. Returns the bpm. */
  tap(now: number = performance.now()): number {
    if (this.taps.length && now - this.taps[this.taps.length - 1]! > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    if (this.taps.length >= 3) {
      const gaps = this.taps.slice(1).map((t, i) => t - this.taps[i]!).sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)]!;
      this.bpm = Math.round(Math.min(190, Math.max(60, 60000 / median)));
      this.origin = now;
      this.lastBeatIndex = -1;
    }
    return this.bpm;
  }

  get tapCount() {
    return this.taps.length;
  }

  reset(bpm = 96) {
    this.bpm = bpm;
    this.taps = [];
    this.origin = performance.now();
    this.lastBeatIndex = -1;
  }

  /** Same shape as the real analyser's frame, so the engine doesn't care where it came from. */
  frame(dt: number, playing: boolean, now: number = performance.now()): AudioFrame {
    this.clock += dt;
    this.beat *= Math.exp(-dt * 7);
    const t = this.clock;
    if (!playing) {
      return { bass: 0.1 + 0.04 * Math.sin(t * 1.1), mids: 0.1 + 0.03 * Math.sin(t * 0.7), highs: 0.08, energy: 0.1, beat: this.beat, beatHit: false, live: false };
    }
    const period = 60000 / this.bpm;
    const index = Math.floor((now - this.origin) / period);
    const beatHit = index !== this.lastBeatIndex;
    if (beatHit) {
      this.lastBeatIndex = index;
      this.beat = 1;
    }
    const phase = ((now - this.origin) % period) / period;
    const env = Math.exp(-phase * 5);
    const bass = 0.28 + 0.6 * env;
    const mids = 0.4 + 0.15 * Math.sin(t * 2.1) + 0.15 * env;
    const highs = 0.3 + 0.2 * Math.max(0, Math.sin(t * 5.3)) + (index % 2 ? 0.15 * env : 0);
    return { bass, mids, highs, energy: bass * 0.5 + mids * 0.35 + highs * 0.15, beat: this.beat, beatHit, live: false };
  }
}
