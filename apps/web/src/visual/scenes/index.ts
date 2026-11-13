import type { SceneType } from "@artei/shared";
import { COMMON } from "./common";

/**
 * One fragment-shader body per scene type. Each defines `vec3 scene(vec2 p)`
 * using the shared uniforms; `main` applies the finishing pass.
 */
const SCENES: Record<SceneType, string> = {
  nebula: /* glsl */ `
vec3 scene(vec2 p){
  float t = uT * 0.08;
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(fbm(p * 1.8 + (2.0 + uTurb * 2.0) * q + vec2(1.7, 9.2) + t * 0.6),
                fbm(p * 1.8 + (2.0 + uTurb * 2.0) * q + vec2(8.3, 2.8) - t * 0.5));
  float f = fbm(p * 2.0 + r * (1.5 + uDistort));
  vec3 col = mix(uBg, uC1, smoothstep(0.15, 0.75, f));
  col = mix(col, uC2, smoothstep(0.3, 1.0, dot(q, q)) * 0.75);
  col = mix(col, uC3, smoothstep(0.55, 1.0, r.x) * 0.5);
  col *= 0.85 + uIntensity * 0.8 + uBass * uGlow * 0.8;
  // stars
  vec2 g = p * 60.0;
  float s = hash(floor(g));
  float star = step(0.985, s) * smoothstep(0.5, 0.0, length(fract(g) - 0.5));
  col += uC4 * star * (0.4 + uHighs * 1.4) * (0.6 + 0.4 * sin(uTime * 3.0 + s * 40.0));
  col += uC4 * pow(f, 4.0) * uGlow * (0.3 + uBloom);
  return col;
}`,

  liquid_chrome: /* glsl */ `
float height(vec2 p){
  float t = uT * 0.15;
  vec2 w = vec2(fbm(p * 1.2 + t), fbm(p * 1.2 - t + 3.1));
  return fbm(p * 1.6 + w * (1.4 + uDistort * 1.5 + uTurb));
}
vec3 scene(vec2 p){
  float e = 0.004;
  float h = height(p);
  vec3 n = normalize(vec3(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h, e * (1.2 - uBass * 0.6)));
  // fake environment: banded studio lights reflected in the surface
  float band = n.y * 6.0 + n.x * 2.0 + uT * 0.2;
  float stripes = 0.5 + 0.5 * sin(band * 3.14159);
  vec3 env = mix(uC2 * 0.4, uC1, smoothstep(0.1, 0.9, stripes));
  env = mix(env, uC4, pow(stripes, 18.0) * (0.6 + uBloom));
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  vec3 col = mix(uBg, env, 0.75 + 0.25 * uIntensity);
  col += uC3 * fres * (0.4 + uBass * 1.2) * uGlow;
  col *= 0.7 + 0.5 * uIntensity;
  return col;
}`,

  rain_on_glass: /* glsl */ `
vec3 bokeh(vec2 p){
  vec3 col = mix(uBg, uC1 * 0.55, smoothstep(-0.8, 0.8, p.y));
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 c = vec2(hash1(fi * 3.1) * 1.2 - 0.6, hash1(fi * 7.7) * 1.2 - 0.6);
    c.x += sin(uT * 0.05 + fi) * 0.08;
    float r = 0.06 + 0.14 * hash1(fi * 1.9);
    float d = smoothstep(r, r * 0.4, length(p - c));
    vec3 lc = i % 3 == 0 ? uC2 : (i % 3 == 1 ? uC3 : uC1);
    col += lc * d * (0.45 + 0.5 * uGlow) * (0.7 + 0.6 * uMids);
  }
  return col;
}
vec2 drops(vec2 p, float scale, float speed){
  vec2 uv = p * scale;
  uv.y += uT * speed;
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash(id);
  float y = fract(-uT * speed * (0.6 + h) + h) - 0.5;
  vec2 dp = vec2(f.x - (h - 0.5) * 0.6, f.y - y * 0.8);
  float r = 0.08 + 0.06 * h;
  float d = length(dp * vec2(1.0, 0.75));
  float m = smoothstep(r, r * 0.6, d);
  // trail
  float trail = smoothstep(0.05, 0.0, abs(f.x - (h - 0.5) * 0.6)) * smoothstep(-0.05, 0.5, f.y - y) * step(h, 0.6) * 0.3;
  return (dp * m * 2.5) + vec2(0.0, trail * 0.02);
}
vec3 scene(vec2 p){
  vec2 off = drops(p, 7.0, 0.25 + uHighs * 0.15) + drops(p * 1.7 + 3.0, 7.0, 0.18) * 0.6;
  float wet = length(off);
  vec3 col = bokeh(p + off * (0.6 + uDistort));
  col += uC4 * smoothstep(0.02, 0.12, wet) * 0.12;
  col *= 0.6 + uIntensity * 0.6 + uBass * uGlow * 0.4;
  return col;
}`,

  paper_cutouts: /* glsl */ `
vec3 scene(vec2 p){
  vec3 col = mix(uBg, uC3 * 0.5, smoothstep(-0.6, 1.0, p.y));
  // sun
  col = mix(col, uC4, smoothstep(0.2, 0.19, length(p - vec2(0.45, 0.32))) * 0.8);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float depth = fi / 5.0;
    float base = 0.25 - fi * 0.13;
    float freq = 1.2 + fi * 0.5 + uComplexity;
    float amp = 0.12 + 0.05 * fi;
    float x = p.x * freq + fi * 10.0 + uT * 0.04 * (fi + 1.0);
    float edge = base + (fbm(vec2(x, fi)) - 0.5) * amp * 2.0 + sin(uT * 0.5 + fi) * 0.01 * (1.0 + uBass * 3.0);
    vec3 lc = i % 3 == 0 ? uC1 : (i % 3 == 1 ? uC2 : uC3);
    lc = mix(lc, uBg, depth * 0.55);
    float inside = smoothstep(0.002, -0.002, p.y - edge);
    // drop shadow cast on the layer behind
    float shadow = smoothstep(0.06, 0.0, p.y - edge) * (1.0 - inside) * 0.35;
    col *= 1.0 - shadow;
    col = mix(col, lc, inside);
  }
  // paper fibre texture
  col *= 0.92 + 0.08 * noise(p * 300.0);
  col *= 0.75 + 0.35 * uIntensity;
  return col;
}`,

  neon_city: /* glsl */ `
vec3 scene(vec2 p){
  float horizon = -0.05;
  vec3 col;
  if (p.y > horizon) {
    float y = p.y - horizon;
    col = mix(uC1 * 0.45, uBg, smoothstep(0.0, 0.7, y));
    // striped sun
    vec2 sp = p - vec2(0.0, horizon + 0.2);
    float sun = smoothstep(0.17, 0.165, length(sp));
    float stripes = step(0.0, sin((sp.y) * 70.0 + uT * 2.0)) + step(0.05, sp.y);
    col = mix(col, mix(uC3, uC1, -sp.y * 3.0 + 0.5), sun * clamp(stripes, 0.0, 1.0));
    col += uC1 * smoothstep(0.6, 0.0, length(sp)) * 0.35 * (uGlow + uBloom);
    // skyline
    float bx = floor(p.x * 42.0);
    float bh = 0.02 + 0.11 * hash(vec2(bx, 3.0)) * (0.6 + uComplexity);
    if (y < bh) {
      col = uBg * 0.6;
      vec2 w = fract(vec2(p.x * 42.0 * 3.0, y * 110.0));
      float lit = step(0.6, hash(floor(vec2(p.x * 126.0, y * 110.0)))) * step(0.35, w.x) * step(0.35, w.y);
      col += mix(uC2, uC3, hash(vec2(bx, 9.0))) * lit * (0.35 + uMids * 0.6);
    }
  } else {
    float d = horizon - p.y;
    float z = 0.35 / max(d, 0.002);
    float gx = p.x * z;
    float gz = z + uT * 1.5;
    float lx = smoothstep(0.06, 0.0, abs(fract(gx) - 0.5) - 0.44);
    float lz = smoothstep(0.06, 0.0, abs(fract(gz) - 0.5) - 0.44);
    float fade = smoothstep(0.0, 0.5, d);
    col = uBg + (uC2 * lx + uC1 * lz) * fade * (0.6 + uBass * uGlow * 1.5);
    col += uC1 * smoothstep(0.15, 0.0, d) * 0.5 * (uGlow + uBloom);
  }
  return col * (0.6 + 0.5 * uIntensity);
}`,

  aurora: /* glsl */ `
vec3 scene(vec2 p){
  vec3 col = mix(uBg, uC2 * 0.15, smoothstep(-0.5, 0.8, p.y));
  vec2 g = p * 80.0;
  float s = hash(floor(g));
  col += uC4 * step(0.992, s) * smoothstep(0.5, 0.0, length(fract(g) - 0.5)) * (0.5 + uHighs);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y = 0.05 + fi * 0.09 + 0.12 * sin(p.x * (1.2 + fi * 0.4) + uT * 0.2 + fi * 1.7)
              + (fbm(vec2(p.x * 1.5 + uT * 0.05, fi)) - 0.5) * 0.3 * (1.0 + uTurb);
    float dy = p.y - y;
    float curtain = exp(-dy * dy * 90.0) + smoothstep(0.0, 0.35, dy) * exp(-dy * 6.0) * 0.6;
    curtain *= step(-0.02, dy) * 0.6 + 0.4;
    float rays = 0.55 + 0.45 * noise(vec2(p.x * 28.0 + fi * 13.0, uT * 0.4));
    vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.3, dy));
    c = mix(c, uC3, fi / 3.0 * 0.4);
    col += c * curtain * rays * (0.35 + 0.5 * uGlow) * (0.6 + uMids * 0.9);
  }
  // mountains
  float m = -0.32 + (fbm(vec2(p.x * 2.0, 1.0)) - 0.5) * 0.35;
  col = mix(col, uBg * 0.5, smoothstep(0.004, -0.004, p.y - m));
  return col * (0.6 + 0.5 * uIntensity);
}`,

  ink_in_water: /* glsl */ `
vec3 scene(vec2 p){
  float t = uT * 0.06;
  vec2 q = vec2(fbm(p * 1.3 + vec2(t, -t)), fbm(p * 1.3 + vec2(4.7, 1.9) + t));
  vec2 r = vec2(fbm(p * 1.6 + 3.0 * q * (1.0 + uTurb) + vec2(1.2, 6.3) + t * 1.4),
                fbm(p * 1.6 + 3.0 * q * (1.0 + uTurb) + vec2(7.1, 2.2) - t));
  float d = fbm(p * 1.8 + r * (2.0 + uDistort * 2.0));
  vec3 col = uBg;
  col = mix(col, uC2, smoothstep(0.32, 0.55, d) * 0.85);
  col = mix(col, uC1, smoothstep(0.45, 0.68, d));
  float fil = smoothstep(0.025, 0.0, abs(r.x - 0.5)) * smoothstep(0.3, 0.6, d);
  col = mix(col, uC3, fil * (0.5 + uBass * 0.5));
  col *= 0.95 + 0.05 * noise(p * 260.0);
  return mix(uBg, col, 0.75 + 0.25 * uIntensity);
}`,
};

export function sceneFragment(type: SceneType): string {
  return `${COMMON}
${SCENES[type]}
void main(){
  vec2 p = camUV();
  gl_FragColor = vec4(finish(scene(p), p), 1.0);
}`;
}

/** Scenes drawn on a light background need dark, normally-blended particles. */
export const LIGHT_SCENES: ReadonlySet<SceneType> = new Set(["ink_in_water"]);
