/** Device tiering + adaptive resolution so mid-range Android phones hold ~60 fps. */
export type Tier = "low" | "mid" | "high";

export interface TierSettings {
  maxDpr: number;
  particles: number;
  octaves: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  low: { maxDpr: 1, particles: 900, octaves: 3 },
  mid: { maxDpr: 1.5, particles: 2500, octaves: 4 },
  high: { maxDpr: 2, particles: 6000, octaves: 5 },
};

export function detectTier(gl: WebGLRenderingContext | WebGL2RenderingContext): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  let gpu = "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    /* ignore */
  }
  const weakGpu = /Mali-[4T]|Mali-G(31|51|52|57)|Adreno \(TM\) [3-5]\d\d|Adreno \(TM\) 6[0-1]\d|PowerVR|SwiftShader|llvmpipe|Software/i.test(gpu);
  if (weakGpu || mem <= 2 || cores <= 4) return "low";
  if (mobile || mem <= 4 || cores <= 6) return "mid";
  return "high";
}

/**
 * Watches frame times and scales the render resolution down when we fall
 * under ~50 fps, and back up slowly when there's headroom.
 */
export class AdaptiveResolution {
  scale = 1;
  private ema = 16.7;
  private slowFor = 0;
  private fastFor = 0;

  /** Returns true when the scale changed. */
  update(frameMs: number, dt: number): boolean {
    if (frameMs > 250) return false; // tab switch / hitch — ignore
    this.ema += (frameMs - this.ema) * 0.08;
    if (this.ema > 20) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else if (this.ema < 17.5) {
      this.fastFor += dt;
      this.slowFor = 0;
    } else {
      this.slowFor = this.fastFor = 0;
    }
    if (this.slowFor > 1.5 && this.scale > 0.45) {
      this.scale = Math.max(0.45, this.scale - 0.15);
      this.slowFor = 0;
      return true;
    }
    if (this.fastFor > 6 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.1);
      this.fastFor = 0;
      return true;
    }
    return false;
  }

  get fps() {
    return 1000 / this.ema;
  }
}
