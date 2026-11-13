/**
 * Visual DNA v1 — the per-track parameter set Claude designs and our own
 * shader engine renders. Only enums and bounded numbers: nothing here is
 * executable, so a model response can only ever tune parameters.
 */

export const SCENE_TYPES = [
  "nebula",
  "liquid_chrome",
  "rain_on_glass",
  "paper_cutouts",
  "neon_city",
  "aurora",
  "ink_in_water",
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SCENE_LABELS: Record<SceneType, string> = {
  nebula: "Nebula",
  liquid_chrome: "Liquid Chrome",
  rain_on_glass: "Rain on Glass",
  paper_cutouts: "Paper Cutouts",
  neon_city: "Neon City",
  aurora: "Aurora",
  ink_in_water: "Ink in Water",
};

export const MOTION_STYLES = ["drift", "pulse", "swirl", "flow", "stutter", "breathe"] as const;
export const PARTICLE_SHAPES = ["dot", "spark", "dust", "droplet", "petal", "shard"] as const;
export const PARTICLE_BEHAVIORS = ["float", "rise", "fall", "orbit", "burst"] as const;
export const CAMERA_MOVES = ["static", "slow_orbit", "dolly_in", "drift", "handheld", "spiral"] as const;
export const BANDS = ["bass", "mids", "highs", "beat"] as const;
export const AUDIO_TARGETS = [
  "glow",
  "particleSize",
  "particleSpeed",
  "cameraShake",
  "colorShift",
  "distortion",
  "motionSpeed",
  "bloom",
  "lyricScale",
] as const;
export const FONT_FAMILIES = ["display_sans", "grotesk", "serif_editorial", "mono", "rounded", "condensed"] as const;
export const TEXT_ENTRANCES = ["fade", "rise", "blur_in", "typewriter", "glitch", "scale"] as const;
export const TEXT_PLACEMENTS = ["center", "lower_third", "upper_third", "drifting"] as const;
export const COLOR_ROLES = ["primary", "secondary", "accent", "highlight"] as const;

export type Band = (typeof BANDS)[number];
export type AudioTarget = (typeof AUDIO_TARGETS)[number];
export type ColorRole = (typeof COLOR_ROLES)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];

