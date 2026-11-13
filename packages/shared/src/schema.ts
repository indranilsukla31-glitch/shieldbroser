import { z } from "zod";
import {
  AUDIO_TARGETS,
  BANDS,
  CAMERA_MOVES,
  COLOR_ROLES,
  FONT_FAMILIES,
  MOTION_STYLES,
  PARTICLE_BEHAVIORS,
  PARTICLE_SHAPES,
  SCENE_TYPES,
  TEXT_ENTRANCES,
  TEXT_PLACEMENTS,
} from "./constants.js";

/** Server-side validation of Visual DNA (zod). The browser imports only the types. */
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color");
const Unit = z.number().min(0).max(1);

export const VisualDnaSchema = z.object({
  version: z.literal(1),
  sceneName: z.string().min(1).max(40),
  moodLine: z.string().min(1).max(120),
  moodTags: z.array(z.string().min(1).max(20)).min(1).max(5),
  palette: z.object({
    background: Hex,
    primary: Hex,
    secondary: Hex,
    accent: Hex,
    highlight: Hex,
  }),
  scene: z.object({
    type: z.enum(SCENE_TYPES),
    intensity: Unit,
    complexity: Unit,
    glow: Unit,
    grain: Unit,
  }),
  motion: z.object({
    style: z.enum(MOTION_STYLES),
    speed: Unit,
    turbulence: Unit,
  }),
  particles: z.object({
    density: Unit,
    size: Unit,
    shape: z.enum(PARTICLE_SHAPES),
    behavior: z.enum(PARTICLE_BEHAVIORS),
  }),
  camera: z.object({
    movement: z.enum(CAMERA_MOVES),
    speed: Unit,
  }),
  audioMap: z
    .array(z.object({ band: z.enum(BANDS), target: z.enum(AUDIO_TARGETS), amount: Unit }))
    .min(2)
    .max(8),
  typography: z.object({
    family: z.enum(FONT_FAMILIES),
    weight: z.number().int().min(100).max(900),
    case: z.enum(["as_is", "upper", "lower"]),
    tracking: z.number().min(-0.05).max(0.3),
    entrance: z.enum(TEXT_ENTRANCES),
    placement: z.enum(TEXT_PLACEMENTS),
    colorRole: z.enum(COLOR_ROLES),
  }),
  moments: z
    .array(
      z.object({
        at: Unit,
        lyricLineIndex: z.number().int().min(0).optional(),
        label: z.string().min(1).max(30),
        shift: z.object({
          paletteEmphasis: z.enum(COLOR_ROLES),
          intensity: Unit,
          motionSpeed: Unit,
          particleBurst: z.boolean(),
        }),
      }),
    )
    .min(3)
    .max(5),
});

import type { VisualDna } from "./types.js";

/** Validate and normalize (sort moments, dedupe audio mappings). */
export function validateVisualDna(input: unknown):
  | { ok: true; dna: VisualDna }
  | { ok: false; errors: string[] } {
  const r = VisualDnaSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const dna = r.data;
  dna.moments = [...dna.moments].sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  dna.audioMap = dna.audioMap.filter((m) => {
    const k = `${m.band}:${m.target}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ok: true, dna };
}
