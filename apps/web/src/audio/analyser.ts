/**
 * Web Audio analysis for the visual engine: band energies (bass / mids / highs),
 * adaptive normalization so quiet and loud tracks both drive the visuals, and a
 * simple onset-based beat detector. Also exposes a MediaStream of the audio for
 * clip export.
 */
export interface AudioFrame {
  bass: number;
  mids: number;
  highs: number;
  /** Overall loudness 0..1. */
  energy: number;
  /** Decaying beat pulse 1 → 0. */
  beat: number;
  /** True only on the frame a beat is detected. */
  beatHit: boolean;
  /** Whether this frame came from real audio analysis. */
  live: boolean;
}

const BANDS_HZ = { bass: [25, 180], mids: [180, 2200], highs: [2200, 11000] } as const;

class Band {
  value = 0;
  private peak = 0.25;
  update(raw: number, dt: number) {
    // slowly-decaying peak → normalized value in 0..1
    this.peak = Math.max(raw, this.peak * Math.exp(-dt * 0.35), 0.08);
    const target = Math.min(1, raw / this.peak);
    // fast attack, slower release
    const k = target > this.value ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 8);
    this.value += (target - this.value) * k;
    return this.value;
  }
}

export class AudioAnalyser {
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaElementAudioSourceNode;
  private streamDest?: MediaStreamAudioDestinationNode;
  private freq?: Uint8Array<ArrayBuffer>;
  private bands = { bass: new Band(), mids: new Band(), highs: new Band() };
  private bassHistory: number[] = [];
  private lastBeat = 0;
  private beat = 0;
  private clock = 0;
  failed = false;

  constructor(private readonly el: HTMLAudioElement) {}

  /** Must be called from a user gesture (play button) the first time. */
  ensure(): void {
    if (this.ctx || this.failed) {
      void this.ctx?.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ latencyHint: "playback" });
      const source = ctx.createMediaElementSource(this.el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const streamDest = ctx.createMediaStreamDestination();
      source.connect(streamDest);
      this.ctx = ctx;
      this.source = source;
      this.analyser = analyser;
      this.streamDest = streamDest;
      this.freq = new Uint8Array(analyser.frequencyBinCount);
      void ctx.resume();
    } catch (e) {
      // Visuals fall back to the idle animation; playback is unaffected.
      console.warn("Web Audio unavailable", e);
      this.failed = true;
    }
  }

  /** Audio-only MediaStream (for MediaRecorder clip export). */
  get stream(): MediaStream | undefined {
    return this.streamDest?.stream;
  }

  private bandAvg(lo: number, hi: number): number {
    const a = this.analyser!;
    const binHz = a.context.sampleRate / a.fftSize;
    const from = Math.max(1, Math.floor(lo / binHz));
    const to = Math.min(this.freq!.length - 1, Math.ceil(hi / binHz));
    let sum = 0;
    for (let i = from; i <= to; i++) sum += this.freq![i]!;
    return sum / ((to - from + 1) * 255);
  }

  frame(dt: number, playing: boolean): AudioFrame {
    this.clock += dt;
    this.beat *= Math.exp(-dt * 7);
    const live = Boolean(this.analyser && playing && this.ctx?.state === "running");
    let bass: number, mids: number, highs: number;
    if (live) {
      this.analyser!.getByteFrequencyData(this.freq!);
      bass = this.bands.bass.update(this.bandAvg(...BANDS_HZ.bass), dt);
      mids = this.bands.mids.update(this.bandAvg(...BANDS_HZ.mids), dt);
      highs = this.bands.highs.update(this.bandAvg(...BANDS_HZ.highs), dt);
    } else {
      // Gentle idle "breathing" so the scene never looks frozen.
      const t = this.clock;
      bass = this.bands.bass.update(0.18 + 0.08 * Math.sin(t * 1.1), dt) * 0.5;
      mids = this.bands.mids.update(0.18 + 0.06 * Math.sin(t * 0.7 + 1), dt) * 0.5;
      highs = this.bands.highs.update(0.15 + 0.05 * Math.sin(t * 1.7 + 2), dt) * 0.4;
    }

    // Onset detection on bass vs. its recent average (~1 s window).
    let beatHit = false;
    if (live) {
      this.bassHistory.push(bass);
      if (this.bassHistory.length > 60) this.bassHistory.shift();
      const avg = this.bassHistory.reduce((s, v) => s + v, 0) / this.bassHistory.length;
      if (bass > avg * 1.25 + 0.06 && bass > 0.35 && this.clock - this.lastBeat > 0.26) {
        beatHit = true;
        this.lastBeat = this.clock;
        this.beat = 1;
      }
    }
    return { bass, mids, highs, energy: (bass * 0.5 + mids * 0.35 + highs * 0.15), beat: this.beat, beatHit, live };
  }
}
