import { SCENE_TYPES, type ColorRole, type SceneType } from "./constants.js";
import type { VisualDna } from "./types.js";

// Presets — used before Claude responds, when it isn't configured, and as the
// fallback when generation fails validation twice.
// ---------------------------------------------------------------------------

type Base = Omit<VisualDna, "version" | "sceneName" | "moodLine" | "moodTags" | "moments">;

const moments = (emph: [ColorRole, ColorRole, ColorRole, ColorRole]): VisualDna["moments"] => [
  { at: 0.12, label: "Opening", shift: { paletteEmphasis: emph[0], intensity: 0.45, motionSpeed: 0.4, particleBurst: false } },
  { at: 0.38, label: "Rise", shift: { paletteEmphasis: emph[1], intensity: 0.7, motionSpeed: 0.6, particleBurst: true } },
  { at: 0.62, label: "Peak", shift: { paletteEmphasis: emph[2], intensity: 0.95, motionSpeed: 0.8, particleBurst: true } },
  { at: 0.86, label: "Release", shift: { paletteEmphasis: emph[3], intensity: 0.5, motionSpeed: 0.35, particleBurst: false } },
];

const BASES: Record<string, Base & { name: string; line: string; tags: string[] }> = {
  nebula: {
    name: "Slow Nebula", line: "Dust and starlight folding into each other.", tags: ["dreamy", "spacious"],
    palette: { background: "#05040d", primary: "#6b4dff", secondary: "#ff4f9a", accent: "#35d0ff", highlight: "#ffe9b0" },
    scene: { type: "nebula", intensity: 0.6, complexity: 0.6, glow: 0.7, grain: 0.25 },
    motion: { style: "drift", speed: 0.35, turbulence: 0.4 },
    particles: { density: 0.55, size: 0.4, shape: "dust", behavior: "float" },
    camera: { movement: "slow_orbit", speed: 0.3 },
    audioMap: [
      { band: "bass", target: "glow", amount: 0.7 },
      { band: "highs", target: "particleSize", amount: 0.5 },
      { band: "beat", target: "lyricScale", amount: 0.5 },
      { band: "mids", target: "colorShift", amount: 0.3 },
    ],
    typography: { family: "display_sans", weight: 700, case: "as_is", tracking: 0, entrance: "blur_in", placement: "center", colorRole: "highlight" },
  },
  liquid_chrome: {
    name: "Mercury Pulse", line: "Molten metal bending to the beat.", tags: ["sleek", "electric"],
    palette: { background: "#07080c", primary: "#c9d4e6", secondary: "#5f6b85", accent: "#ff3d7f", highlight: "#ffffff" },
    scene: { type: "liquid_chrome", intensity: 0.75, complexity: 0.55, glow: 0.5, grain: 0.15 },
    motion: { style: "pulse", speed: 0.6, turbulence: 0.5 },
    particles: { density: 0.3, size: 0.3, shape: "spark", behavior: "burst" },
    camera: { movement: "dolly_in", speed: 0.4 },
    audioMap: [
      { band: "bass", target: "distortion", amount: 0.8 },
      { band: "beat", target: "cameraShake", amount: 0.4 },
      { band: "highs", target: "bloom", amount: 0.5 },
      { band: "beat", target: "lyricScale", amount: 0.6 },
    ],
    typography: { family: "condensed", weight: 800, case: "upper", tracking: 0.08, entrance: "scale", placement: "center", colorRole: "highlight" },
  },
  rain_on_glass: {
    name: "Window Rain", line: "City lights smeared through falling water.", tags: ["melancholy", "intimate"],
    palette: { background: "#060a10", primary: "#2f5d8a", secondary: "#e3a857", accent: "#d94f6b", highlight: "#eef4ff" },
    scene: { type: "rain_on_glass", intensity: 0.5, complexity: 0.6, glow: 0.55, grain: 0.3 },
    motion: { style: "flow", speed: 0.3, turbulence: 0.25 },
    particles: { density: 0.6, size: 0.35, shape: "droplet", behavior: "fall" },
    camera: { movement: "drift", speed: 0.2 },
    audioMap: [
      { band: "bass", target: "glow", amount: 0.5 },
      { band: "highs", target: "particleSpeed", amount: 0.5 },
      { band: "beat", target: "lyricScale", amount: 0.35 },
    ],
    typography: { family: "serif_editorial", weight: 500, case: "as_is", tracking: 0.01, entrance: "fade", placement: "lower_third", colorRole: "highlight" },
  },
  paper_cutouts: {
    name: "Paper Hills", line: "Layered paper landscapes breathing in time.", tags: ["warm", "playful"],
    palette: { background: "#1b1210", primary: "#f2a65a", secondary: "#e2574c", accent: "#5aa9a3", highlight: "#fff4e0" },
    scene: { type: "paper_cutouts", intensity: 0.55, complexity: 0.5, glow: 0.2, grain: 0.5 },
    motion: { style: "breathe", speed: 0.35, turbulence: 0.2 },
    particles: { density: 0.35, size: 0.6, shape: "petal", behavior: "fall" },
    camera: { movement: "drift", speed: 0.25 },
    audioMap: [
      { band: "bass", target: "motionSpeed", amount: 0.5 },
      { band: "mids", target: "colorShift", amount: 0.3 },
      { band: "beat", target: "lyricScale", amount: 0.5 },
    ],
    typography: { family: "rounded", weight: 800, case: "lower", tracking: 0, entrance: "rise", placement: "upper_third", colorRole: "highlight" },
  },
  neon_city: {
    name: "Night Drive", line: "Neon grid racing toward a violet horizon.", tags: ["nocturnal", "driving"],
    palette: { background: "#07020f", primary: "#ff2fb4", secondary: "#2de2ff", accent: "#ffd23f", highlight: "#f7f0ff" },
    scene: { type: "neon_city", intensity: 0.8, complexity: 0.6, glow: 0.85, grain: 0.2 },
    motion: { style: "flow", speed: 0.7, turbulence: 0.3 },
    particles: { density: 0.45, size: 0.3, shape: "spark", behavior: "rise" },
    camera: { movement: "dolly_in", speed: 0.6 },
    audioMap: [
      { band: "bass", target: "bloom", amount: 0.7 },
      { band: "beat", target: "cameraShake", amount: 0.3 },
      { band: "highs", target: "glow", amount: 0.5 },
      { band: "beat", target: "lyricScale", amount: 0.6 },
    ],
    typography: { family: "display_sans", weight: 800, case: "upper", tracking: 0.12, entrance: "glitch", placement: "lower_third", colorRole: "highlight" },
  },
  aurora: {
    name: "Polar Curtain", line: "Green light rippling over a silent sky.", tags: ["calm", "vast"],
    palette: { background: "#020812", primary: "#2bf5a6", secondary: "#7b5cff", accent: "#ff7ad9", highlight: "#e8fff6" },
    scene: { type: "aurora", intensity: 0.55, complexity: 0.5, glow: 0.75, grain: 0.15 },
    motion: { style: "flow", speed: 0.3, turbulence: 0.35 },
    particles: { density: 0.5, size: 0.25, shape: "dot", behavior: "float" },
    camera: { movement: "static", speed: 0.1 },
    audioMap: [
      { band: "mids", target: "glow", amount: 0.6 },
      { band: "bass", target: "motionSpeed", amount: 0.4 },
      { band: "beat", target: "lyricScale", amount: 0.35 },
    ],
    typography: { family: "grotesk", weight: 300, case: "lower", tracking: 0.04, entrance: "fade", placement: "upper_third", colorRole: "highlight" },
  },
  ink_in_water: {
    name: "Ink Bloom", line: "Pigment unfurling slowly through still water.", tags: ["organic", "introspective"],
    palette: { background: "#f1ece4", primary: "#14131c", secondary: "#2d3e7a", accent: "#c4374a", highlight: "#14131c" },
    scene: { type: "ink_in_water", intensity: 0.6, complexity: 0.7, glow: 0.1, grain: 0.35 },
    motion: { style: "swirl", speed: 0.3, turbulence: 0.6 },
    particles: { density: 0.25, size: 0.3, shape: "dust", behavior: "orbit" },
    camera: { movement: "slow_orbit", speed: 0.15 },
    audioMap: [
      { band: "bass", target: "distortion", amount: 0.5 },
      { band: "mids", target: "motionSpeed", amount: 0.4 },
      { band: "beat", target: "lyricScale", amount: 0.4 },
    ],
    typography: { family: "serif_editorial", weight: 600, case: "as_is", tracking: -0.01, entrance: "blur_in", placement: "center", colorRole: "highlight" },
  },
};

const EMPH: Record<SceneType, [ColorRole, ColorRole, ColorRole, ColorRole]> = {
  nebula: ["primary", "secondary", "accent", "highlight"],
  liquid_chrome: ["secondary", "primary", "accent", "primary"],
  rain_on_glass: ["primary", "secondary", "accent", "primary"],
  paper_cutouts: ["primary", "secondary", "accent", "primary"],
  neon_city: ["secondary", "primary", "accent", "secondary"],
  aurora: ["primary", "secondary", "accent", "primary"],
  ink_in_water: ["secondary", "primary", "accent", "secondary"],
};

export function presetFor(scene: SceneType): VisualDna {
  const b = BASES[scene]!;
  const { name, line, tags, ...rest } = b;
  return structuredClone({ version: 1 as const, sceneName: name, moodLine: line, moodTags: tags, ...rest, moments: moments(EMPH[scene]) });
}

const TAG_SCENES: [RegExp, SceneType][] = [
  [/synthwave|retro|80s|night|electro|house|techno|edm|club/i, "neon_city"],
  [/rain|lofi|lo-fi|jazz|blues|sad|melanchol/i, "rain_on_glass"],
  [/ambient|space|cosmic|drone|dream|newage|meditat/i, "nebula"],
  [/classical|piano|minimal|contemporary|orchestra|ink/i, "ink_in_water"],
  [/folk|acoustic|indie|kids|happy|pop|country/i, "paper_cutouts"],
  [/rock|metal|dance|energetic|hiphop|rap|dubstep|drum/i, "liquid_chrome"],
  [/chill|lounge|calm|relax|nature|soundtrack|cinematic/i, "aurora"],
];

/** Deterministic preset choice from catalog tags (stable per track). */
export function presetForTags(tags: string[], seed = 0): VisualDna {
  const joined = tags.join(" ");
  for (const [re, scene] of TAG_SCENES) if (re.test(joined)) return presetFor(scene);
  return presetFor(SCENE_TYPES[Math.abs(seed) % SCENE_TYPES.length]!);
}
