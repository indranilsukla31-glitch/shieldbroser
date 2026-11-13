import type { FontFamily, VisualDna } from "@artei/shared";

/** Bundled variable fonts for each Visual DNA typography family (all work offline). */
export const FONT_STACKS: Record<FontFamily, string> = {
  display_sans: '"Bricolage Grotesque Variable", system-ui, sans-serif',
  grotesk: '"Inter Variable", system-ui, sans-serif',
  serif_editorial: '"Fraunces Variable", Georgia, serif',
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
  rounded: '"Nunito Variable", system-ui, sans-serif',
  condensed: '"Oswald Variable", "Arial Narrow", sans-serif',
};

export function applyCase(text: string, c: VisualDna["typography"]["case"]): string {
  return c === "upper" ? text.toUpperCase() : c === "lower" ? text.toLowerCase() : text;
}

/** Make sure a font face is loaded before drawing it onto a canvas. */
export async function ensureFont(family: FontFamily, weight: number, size = 48): Promise<void> {
  try {
    await document.fonts.load(`${weight} ${size}px ${FONT_STACKS[family]}`);
  } catch {
    /* fall back to system font */
  }
}
