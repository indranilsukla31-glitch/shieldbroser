import type { Track, VisualDna } from "@artei/shared/client";
import { FONT_STACKS } from "./fonts";

export const CLIP_SECONDS = 15;
const W = 720;
const H = 1280;
const SOURCE_NAME: Record<string, string> = { jamendo: "Jamendo", mock: "Artei offline demo" };

/** Clips sync music to moving images, which CC treats as an adaptation: not allowed for ND. */
export function clipAllowed(track: Track): { ok: true } | { ok: false; reason: string } {
  if (track.license.noDerivatives) {
    return {
      ok: false,
      reason: `This track is licensed ${track.license.name}, which doesn't allow derivative works. Putting music to video counts as one, so clip export is off for this song.`,
    };
  }
  return { ok: true };
}

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Records a vertical clip by compositing the WebGL canvas, the lyrics canvas
 * and a credit overlay into one canvas each engine frame, plus the track's
 * audio from the Web Audio graph.
 */
export class ClipRecorder {
  private comp = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private done?: (b: Blob) => void;
  private fail?: (e: Error) => void;
  readonly mimeType: string;
  active = false;

  constructor(
    private readonly sources: { visuals: HTMLCanvasElement; lyrics: HTMLCanvasElement | null },
    private readonly track: Track,
    private readonly dna: VisualDna,
    private readonly audioStream: MediaStream | undefined,
    private readonly onProgress: (p: number) => void,
  ) {
    this.comp.width = W;
    this.comp.height = H;
    this.ctx = this.comp.getContext("2d")!;
    const mime = pickMimeType();
    if (!mime) throw new Error("This browser can't record video.");
    this.mimeType = mime;
  }

  start(): Promise<Blob> {
    const video = this.comp.captureStream(30);
    const tracks = [...video.getVideoTracks(), ...(this.audioStream?.getAudioTracks() ?? [])];
    const stream = new MediaStream(tracks);
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 160_000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.onstop = () => {
      this.active = false;
      video.getTracks().forEach((t) => t.stop());
      this.done?.(new Blob(this.chunks, { type: this.mimeType.split(";")[0] }));
    };
    this.recorder.onerror = () => this.fail?.(new Error("Recording failed."));
    this.drawFrame(); // paint something before the first chunk
    this.recorder.start(500);
    this.startedAt = performance.now();
    this.active = true;
    return new Promise((resolve, reject) => {
      this.done = resolve;
      this.fail = reject;
    });
  }

  cancel() {
    this.done = undefined;
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.active = false;
  }

  /** Call right after each engine render (the WebGL buffer is only valid then). */
  drawFrame() {
    if (!this.active && this.recorder) return;
    const ctx = this.ctx;
    const src = this.sources.visuals;
    // cover-fit the full-screen canvases into 9:16
    const s = Math.max(W / src.width, H / src.height);
    const dw = src.width * s;
    const dh = src.height * s;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(src, dx, dy, dw, dh);
    const ly = this.sources.lyrics;
    if (ly && ly.width > 0) {
      const ls = Math.max(W / ly.width, H / ly.height);
      ctx.drawImage(ly, (W - ly.width * ls) / 2, (H - ly.height * ls) / 2, ly.width * ls, ly.height * ls);
    }
    this.drawCredit();
    if (this.active) {
      const p = (performance.now() - this.startedAt) / (CLIP_SECONDS * 1000);
      this.onProgress(Math.min(1, p));
      if (p >= 1 && this.recorder?.state === "recording") this.recorder.stop();
    }
  }

  private drawCredit() {
    const ctx = this.ctx;
    const t = this.track;
    const g = ctx.createLinearGradient(0, H - 300, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 300, W, 300);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 44px ${FONT_STACKS.display_sans}`;
    ctx.fillText(t.title.slice(0, 26), 48, H - 168);
    ctx.font = `500 30px ${FONT_STACKS.grotesk}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(t.artist.slice(0, 36), 48, H - 124);
    // License credit, as the Creative Commons licenses require.
    ctx.globalAlpha = 0.85;
    const source = SOURCE_NAME[t.ref.split(":")[0]!] ?? "the source catalog";
    this.fitText(`Music: “${t.title.slice(0, 28)}” by ${t.artist.slice(0, 24)} · ${t.license.name}`, 48, H - 82, 22);
    this.fitText(`${t.license.url.replace(/^https?:\/\//, "")} · via ${source}`, 48, H - 52, 22);
    ctx.globalAlpha = 0.75;
    ctx.font = `700 26px ${FONT_STACKS.display_sans}`;
    ctx.fillText("artei.", W - 120, 70);
    ctx.font = `500 18px ${FONT_STACKS.grotesk}`;
    ctx.fillText(this.dna.sceneName.slice(0, 30), 48, 70);
    ctx.restore();
  }

  /** Draw a credit line, shrinking the font so it never runs off the frame. */
  private fitText(text: string, x: number, y: number, size: number) {
    const ctx = this.ctx;
    let s = size;
    do {
      ctx.font = `500 ${s}px ${FONT_STACKS.grotesk}`;
      if (ctx.measureText(text).width <= W - x * 2) break;
      s -= 1;
    } while (s > 12);
    ctx.fillText(text, x, y);
  }
}
