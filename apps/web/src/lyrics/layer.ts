import type { VisualDna } from "@artei/shared/client";
import { FONT_STACKS, applyCase } from "../lib/fonts";
import type { EngineFrame } from "../visual/engine";
import { lineAt, type TimedLine } from "./timing";

interface WordBox {
  text: string;
  x: number;
  y: number;
  w: number;
  pulse: number;
}

interface Layout {
  index: number;
  fontSize: number;
  lineHeight: number;
  words: WordBox[];
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const ENTER_S = 0.6;

/**
 * Draws lyrics *inside* the scene on a 2D canvas layered over the WebGL
 * canvas: the current line in the Visual DNA's typography, words pulsing on
 * beats, and the previous line dissolving into particles.
 */
export class LyricsLayer {
  private ctx: CanvasRenderingContext2D;
  private dna!: VisualDna;
  private lines: TimedLine[] = [];
  private w = 1;
  private h = 1;
  private dpr = 1;
  private insetTop = 0;
  private insetBottom = 0;
  private current = -1;
  private shownAt = 0;
  private layout?: Layout;
  private nextLayout?: Layout;
  private dust: Dust[] = [];
  private fading?: { layout: Layout; alpha: number };
  private beatCount = 0;
  private maxDust: number;
  calm = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    lowPower: boolean,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.maxDust = lowPower ? 500 : 1400;
  }

  setDna(dna: VisualDna) {
    this.dna = dna;
    this.relayout();
  }

  setLines(lines: TimedLine[]) {
    this.lines = lines;
    this.current = -2; // force re-evaluation without dissolving
  }

  setInsets(top: number, bottom: number) {
    if (top === this.insetTop && bottom === this.insetBottom) return;
    this.insetTop = top;
    this.insetBottom = bottom;
    this.relayout();
  }

  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = Math.min(dpr, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.relayout();
  }

  private relayout() {
    if (!this.dna) return;
    if (this.current >= 0) this.layout = this.measure(this.current, 1);
    this.nextLayout = this.current + 1 < this.lines.length ? this.measure(this.current + 1, 0.5) : undefined;
  }

  private font(size: number) {
    const t = this.dna.typography;
    return `${t.weight} ${size}px ${FONT_STACKS[t.family]}`;
  }

  /** Word-wrap a line into word boxes positioned for the DNA's placement. */
  private measure(index: number, scale: number): Layout | undefined {
    const line = this.lines[index];
    if (!line || !this.dna) return undefined;
    const ctx = this.ctx;
    const t = this.dna.typography;
    const text = applyCase(line.text, t.case);
    const maxW = Math.min(this.w * 0.86, 900);
    let fontSize = Math.max(22, Math.min(this.w * 0.075, 64)) * scale;
    if (t.family === "condensed") fontSize *= 1.15;
    const words = text.split(/\s+/).filter(Boolean);
    let rows: { words: { text: string; w: number }[]; width: number }[] = [];
    const tracking = t.tracking * fontSize;
    // Shrink long lines so they never take more than 3 rows.
    for (let attempt = 0; attempt < 4; attempt++) {
      ctx.font = this.font(fontSize);
      const space = ctx.measureText(" ").width + tracking;
      rows = [{ words: [], width: 0 }];
      for (const word of words) {
        const ww = ctx.measureText(word).width + tracking * word.length;
        const row = rows.at(-1)!;
        if (row.words.length && row.width + space + ww > maxW) rows.push({ words: [{ text: word, w: ww }], width: ww });
        else {
          row.width += (row.words.length ? space : 0) + ww;
          row.words.push({ text: word, w: ww });
        }
      }
      if (rows.length <= 3) break;
      fontSize *= 0.85;
    }
    ctx.font = this.font(fontSize);
    const space = ctx.measureText(" ").width + tracking;
    const lineHeight = fontSize * 1.18;
    const blockH = rows.length * lineHeight;
    const areaTop = this.insetTop + 24;
    const areaBottom = this.h - this.insetBottom - 24;
    const areaH = Math.max(lineHeight, areaBottom - areaTop);
    let cy: number;
    switch (t.placement) {
      case "upper_third":
        cy = areaTop + areaH * 0.28;
        break;
      case "lower_third":
        cy = areaTop + areaH * 0.72;
        break;
      default:
        cy = areaTop + areaH * 0.48;
    }
    if (scale < 1 && this.layout) cy = this.layout.bottom + lineHeight * 0.9; // "next line" sits under the current one
    const top = cy - blockH / 2;
    const out: WordBox[] = [];
    rows.forEach((row, r) => {
      let x = this.w / 2 - row.width / 2;
      for (const word of row.words) {
        out.push({ text: word.text, x, y: top + r * lineHeight + lineHeight / 2, w: word.w, pulse: 0 });
        x += word.w + space;
      }
    });
    const widest = Math.max(...rows.map((r) => r.width));
    return { index, fontSize, lineHeight, words: out, top, bottom: top + blockH, left: this.w / 2 - widest / 2, right: this.w / 2 + widest / 2 };
  }

  /** Draw one frame; `t` is the song position in seconds. */
  draw(t: number, frame: EngineFrame) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.dna) return;
    const dt = frame.dt;

    const idx = this.lines.length ? lineAt(this.lines, t) : -1;
    if (idx !== this.current) {
      const wasForced = this.current === -2;
      if (!wasForced && this.layout) this.retire(this.layout);
      this.current = idx;
      this.shownAt = frame.time;
      this.relayout();
    }

    this.drawDust(dt);
    if (this.fading) {
      this.fading.alpha -= dt / 0.45;
      if (this.fading.alpha <= 0) this.fading = undefined;
      else this.drawLine(this.fading.layout, 1, this.fading.alpha, frame, t, true);
    }
    if (this.layout && this.current >= 0) {
      if (frame.audio.beatHit && !this.calm) {
        this.beatCount++;
        const words = this.layout.words;
        if (words.length) words[this.beatCount % words.length]!.pulse = 1;
        for (const w of words) w.pulse = Math.max(w.pulse, 0.35);
      }
      const e = Math.min(1, (frame.time - this.shownAt) / ENTER_S);
      this.drawLine(this.layout, e, 1, frame, t, false);
      if (this.nextLayout) this.drawGhost(this.nextLayout, e);
    }
  }

  private color(): string {
    return this.dna.palette[this.dna.typography.colorRole];
  }

  private drawLine(l: Layout, e: number, alpha: number, frame: EngineFrame, t: number, fading: boolean) {
    const ctx = this.ctx;
    const ty = this.dna.typography;
    const ease = 1 - Math.pow(1 - e, 3);
    const entrance = this.calm ? "fade" : ty.entrance;
    const line = this.lines[l.index];
    const lyricAmt = this.dna.audioMap.filter((m) => m.target === "lyricScale").reduce((s, m) => s + m.amount, 0);
    // Word-by-word progress through the line (karaoke-style emphasis).
    const span = line ? Math.max(0.5, line.end - line.start) : 1;
    const prog = line ? Math.min(1, Math.max(0, (t - line.start) / (span * 0.85))) : 1;

    ctx.save();
    ctx.font = this.font(l.fontSize);
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.color();
    ctx.shadowColor = this.dna.palette.background;
    ctx.shadowBlur = l.fontSize * 0.45;
    let dy = 0;
    let scale = 1;
    let a = alpha;
    switch (entrance) {
      case "fade":
        a *= ease;
        break;
      case "rise":
        a *= ease;
        dy = (1 - ease) * l.fontSize * 0.6;
        break;
      case "scale":
        a *= ease;
        scale = 0.85 + 0.15 * ease;
        break;
      case "blur_in":
        a *= ease;
        if ("filter" in ctx && e < 1) ctx.filter = `blur(${(1 - ease) * 10}px)`;
        break;
      case "glitch":
        a *= e < 0.15 ? Math.random() : 1;
        break;
      default:
        break;
    }
    if (ty.placement === "drifting" && !this.calm) {
      dy += Math.sin(frame.time * 0.4) * l.fontSize * 0.4;
    }
    const cx = this.w / 2;
    const cy = (l.top + l.bottom) / 2;
    const totalChars = l.words.reduce((s, w) => s + w.text.length, 0);
    let charsShown = entrance === "typewriter" && !fading ? Math.floor((frame.time - this.shownAt) / 0.035) : Infinity;

    l.words.forEach((w, i) => {
      w.pulse *= Math.exp(-frame.dt * 6);
      const lit = fading || i / Math.max(1, l.words.length) <= prog + 0.001;
      const wa = a * (lit ? 1 : 0.55);
      if (wa <= 0.01) return;
      let text = w.text;
      if (charsShown !== Infinity) {
        if (charsShown <= 0) return;
        text = text.slice(0, charsShown);
        charsShown -= w.text.length;
      }
      const ps = this.calm ? 1 : 1 + w.pulse * 0.16 * (0.4 + lyricAmt);
      const s = scale * ps;
      const wx = cx + (w.x + w.w / 2 - cx) * scale;
      const wy = cy + (w.y - cy) * scale + dy;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, wa);
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ty.tracking}em`;
      if (entrance === "glitch" && !fading && e < 1) {
        const j = (1 - e) * 6;
        ctx.globalAlpha = wa * 0.6;
        ctx.fillStyle = this.dna.palette.accent;
        ctx.fillText(text, -w.w / 2 + (Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
        ctx.fillStyle = this.dna.palette.secondary;
        ctx.fillText(text, -w.w / 2 - (Math.random() - 0.5) * j, 0);
        ctx.fillStyle = this.color();
        ctx.globalAlpha = wa;
      }
      ctx.fillText(text, -w.w / 2, 0);
      ctx.restore();
    });
    ctx.restore();
    void totalChars;
  }

  private drawGhost(l: Layout, e: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = this.font(l.fontSize);
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.color();
    ctx.globalAlpha = 0.32 * e;
    ctx.shadowColor = this.dna.palette.background;
    ctx.shadowBlur = l.fontSize * 0.4;
    for (const w of l.words) ctx.fillText(w.text, w.x, w.y);
    ctx.restore();
  }

  /** Previous line → particles (or a simple fade in calm mode). */
  private retire(l: Layout) {
    if (this.calm) {
      this.fading = { layout: l, alpha: 1 };
      return;
    }
    const pad = 8;
    const x0 = Math.max(0, Math.floor(l.left - pad));
    const y0 = Math.max(0, Math.floor(l.top - pad));
    const bw = Math.min(this.w - x0, Math.ceil(l.right - l.left + pad * 2));
    const bh = Math.min(this.h - y0, Math.ceil(l.bottom - l.top + pad * 2));
    if (bw <= 0 || bh <= 0) return;
    // Rasterize the line at 1x into a scratch canvas and sample its pixels.
    const scratch = document.createElement("canvas");
    scratch.width = bw;
    scratch.height = bh;
    const sc = scratch.getContext("2d", { willReadFrequently: true })!;
    sc.font = this.font(l.fontSize);
    sc.textBaseline = "middle";
    sc.fillStyle = "#fff";
    for (const w of l.words) sc.fillText(w.text, w.x - x0, w.y - y0);
    const data = sc.getImageData(0, 0, bw, bh).data;
    const step = Math.max(2, Math.round(l.fontSize / 16));
    const behavior = this.dna.particles.behavior;
    const fresh: Dust[] = [];
    for (let y = 0; y < bh; y += step) {
      for (let x = 0; x < bw; x += step) {
        if (data[(y * bw + x) * 4 + 3]! > 120) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 15 + Math.random() * 45;
          let vy = Math.sin(angle) * speed - 25;
          if (behavior === "fall") vy = Math.abs(vy) * 0.8 + 20;
          fresh.push({ x: x0 + x, y: y0 + y, vx: Math.cos(angle) * speed, vy, life: 1, size: step * (0.6 + Math.random() * 0.6) });
        }
      }
    }
    // Keep within budget by random subsampling.
    while (fresh.length > this.maxDust) fresh.splice(Math.floor(Math.random() * fresh.length), 1);
    this.dust = this.dust.concat(fresh).slice(-this.maxDust);
  }

  private drawDust(dt: number) {
    if (!this.dust.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.color();
    const swirl = this.dna.particles.behavior === "orbit" ? 1 : 0;
    let alive = 0;
    for (const d of this.dust) {
      d.life -= dt / 1.6;
      if (d.life <= 0) continue;
      d.vx += (Math.random() - 0.5) * 40 * dt - swirl * (d.y - this.h / 2) * 0.3 * dt;
      d.vy += (Math.random() - 0.5) * 40 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      ctx.globalAlpha = d.life * d.life;
      const s = d.size * (0.4 + d.life * 0.6);
      ctx.fillRect(d.x, d.y, s, s);
      this.dust[alive++] = d;
    }
    this.dust.length = alive;
    ctx.restore();
  }
}
