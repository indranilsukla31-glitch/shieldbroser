import { describe, expect, it } from "vitest";
import { presetFor } from "@artei/shared/client";
import { DnaMapper, momentAt } from "../dnaMapper";
import type { AudioFrame } from "../../audio/analyser";

const loud: AudioFrame = { bass: 1, mids: 1, highs: 1, energy: 1, beat: 1, beatHit: true, live: true };

describe("momentAt", () => {
  const { moments } = presetFor("nebula");
  it("is -1 before the first moment and tracks progress after", () => {
    expect(momentAt(moments, 0)).toBe(-1);
    expect(momentAt(moments, moments[1]!.at + 0.01)).toBe(1);
    expect(momentAt(moments, 1)).toBe(moments.length - 1);
  });
});

describe("DnaMapper", () => {
  it("maps audio bands to targets using the DNA audioMap", () => {
    const dna = presetFor("liquid_chrome");
    const p = new DnaMapper(dna).frame(loud, 0.5, 1 / 60, false);
    const distortion = dna.audioMap.find((m) => m.target === "distortion")!.amount;
    expect(p.mods.distortion).toBeCloseTo(distortion);
    expect(p.mods.cameraShake).toBeGreaterThan(0);
  });

  it("calm mode damps audio reactions, removes shake and halves speed", () => {
    const dna = presetFor("liquid_chrome");
    const normal = new DnaMapper(dna).frame(loud, 0.5, 1 / 60, false);
    const calm = new DnaMapper(dna).frame(loud, 0.5, 1 / 60, true);
    expect(calm.mods.cameraShake).toBe(0);
    expect(calm.mods.distortion).toBeLessThan(normal.mods.distortion);
    expect(calm.motionSpeed).toBeLessThan(normal.motionSpeed);
  });

  it("fires a particle burst when entering a burst moment", () => {
    const dna = presetFor("nebula");
    const m = new DnaMapper(dna);
    const burstAt = dna.moments.find((x) => x.shift.particleBurst)!.at;
    m.frame(loud, burstAt - 0.01, 1 / 60, false);
    const p = m.frame(loud, burstAt + 0.001, 1 / 60, false);
    expect(p.burst).toBeGreaterThan(0.9);
  });
});
