/**
 * Deterministic little synth used by the offline mock catalog. It renders a
 * 16-bit mono WAV with real kicks, hats, bass and pads in distinct sections,
 * so the audio-reactive visuals have something meaningful to react to.
 */
export interface SynthSpec {
  seed: number;
  bpm: number;
  /** MIDI root note. */
  root: number;
  minor: boolean;
  duration: number;
  /** 0..1 — how busy the drums are. */
  energy: number;
}

const SR = 22050;

function midiHz(n: number) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export function renderWav(spec: SynthSpec): Uint8Array {
  const n = Math.floor(spec.duration * SR);
  const pcm = new Int16Array(n);
  let rng = spec.seed >>> 0 || 1;
  const noise = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 2147483648 - 1;
  };

  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const third = spec.minor ? 3 : 4;
  // i – VI – III – VII (minor) or I – V – vi – IV (major), as semitone offsets
  const prog = spec.minor ? [0, 8, 3, 10] : [0, 7, 9, 5];

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pos = t / spec.duration;
    const fade = Math.min(1, t / 2, (spec.duration - t) / 3);

    const barIdx = Math.floor(t / bar);
    const chordRoot = spec.root + prog[barIdx % 4]!;
    const tb = t % beat;

    const drums = pos > 0.15 && pos < 0.9;
    const kickOn = pos > 0.38 && pos < 0.88;
    const bassOn = pos > 0.15;

    let s = 0;

    // Pad: root, third, fifth with slow swell
    const padAmp = 0.12 * (0.6 + 0.4 * Math.sin(t * 0.4));
    for (const iv of [0, third, 7, 12]) {
      const f = midiHz(chordRoot + iv);
      s += padAmp * 0.25 * Math.sin(2 * Math.PI * f * t + Math.sin(t * 3 + iv) * 0.3);
    }

    // Bass: triangle-ish on root, pulsing on beats
    if (bassOn) {
      const f = midiHz(chordRoot - 24);
      const ph = (f * t) % 1;
      const tri = 4 * Math.abs(ph - 0.5) - 1;
      const env = Math.exp(-tb * 3);
      s += 0.22 * tri * (0.4 + 0.6 * env);
    }

    // Kick: pitch-swept sine on each beat
    if (kickOn) {
      const env = Math.exp(-tb * 14);
      const f = 45 + 90 * Math.exp(-tb * 30);
      s += 0.55 * env * Math.sin(2 * Math.PI * f * tb);
    }

    // Hats: noise bursts on 8ths (16ths when energetic)
    if (drums) {
      const div = spec.energy > 0.6 ? beat / 4 : beat / 2;
      const th = t % div;
      const accent = Math.floor(t / div) % 2 === 1 ? 1 : 0.5;
      s += 0.08 * accent * Math.exp(-th * 60) * noise();
    }

    // Clap/snare on 2 and 4
    if (kickOn && spec.energy > 0.3) {
      const b = Math.floor(t / beat) % 4;
      if (b === 1 || b === 3) s += 0.18 * Math.exp(-tb * 22) * noise();
    }

    s *= fade;
    pcm[i] = Math.max(-1, Math.min(1, s)) * 32767;
  }

  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, x: string) => [...x].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  new Int16Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}
