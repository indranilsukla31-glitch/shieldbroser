import { SCENE_LABELS, type Track, type VisualDnaRecord } from "@artei/shared";
import { FONT_STACKS, ensureFont } from "./fonts";

/** Wraps text onto lines no wider than maxWidth. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Render a shareable 1080×1350 Visual DNA card (palette, scene, mood line, credit + license). */
export async function renderCardPng(record: VisualDnaRecord, track: Track | null): Promise<Blob> {
  const { dna } = record;
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  await Promise.all([ensureFont("display_sans", 800, 96), ensureFont("grotesk", 400, 32), ensureFont(dna.typography.family, dna.typography.weight, 64)]);

  const p = dna.palette;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, p.background);
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // soft color blooms
  const blob = (x: number, y: number, r: number, col: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col + "cc");
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(260, 320, 520, p.primary);
  blob(860, 520, 460, p.secondary);
  blob(540, 900, 380, p.accent);

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.7;
  ctx.font = `600 30px ${FONT_STACKS.grotesk}`;
  ctx.fillText("ARTEI · VISUAL DNA", 80, 110);
  ctx.globalAlpha = 1;

  // scene name in the DNA's own typography
  ctx.font = `${dna.typography.weight} 96px ${FONT_STACKS[dna.typography.family]}`;
  let y = 560;
  for (const line of wrap(ctx, dna.sceneName, W - 160).slice(0, 2)) {
    ctx.fillText(line, 80, y);
    y += 104;
  }
  ctx.font = `400 40px ${FONT_STACKS.grotesk}`;
  ctx.globalAlpha = 0.9;
  for (const line of wrap(ctx, dna.moodLine, W - 160).slice(0, 3)) {
    ctx.fillText(line, 80, y + 10);
    y += 54;
  }
  ctx.globalAlpha = 1;

  // palette swatches
  const sw = [p.background, p.primary, p.secondary, p.accent, p.highlight];
  sw.forEach((col, i) => {
    const x = 80 + i * 130;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x, 980, 110, 110, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `500 20px ${FONT_STACKS.mono}`;
    ctx.fillText(col.toUpperCase(), x, 1120);
  });

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 28px ${FONT_STACKS.grotesk}`;
  ctx.fillText(`${SCENE_LABELS[dna.scene.type]} · ${dna.moodTags.join(" · ")}`, 80, 1185);
  if (track) {
    ctx.globalAlpha = 0.75;
    ctx.font = `400 26px ${FONT_STACKS.grotesk}`;
    ctx.fillText(`“${track.title}” by ${track.artist}`.slice(0, 70), 80, 1240);
    ctx.fillText(`Music licensed ${track.license.name}`, 80, 1280);
    ctx.globalAlpha = 1;
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Share via the Web Share API when files are supported, else download. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
