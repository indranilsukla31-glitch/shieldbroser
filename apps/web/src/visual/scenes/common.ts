/** Shared GLSL: uniforms, noise, camera transform and the finishing pass. */
export const COMMON = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;      // wall clock seconds
uniform float uT;         // motion time (integrated speed)
uniform vec2 uRes;
uniform vec3 uBg, uC1, uC2, uC3, uC4, uEmph;
uniform float uIntensity, uComplexity, uGlow, uGrain, uTurb;
uniform float uBass, uMids, uHighs, uBeat;
uniform float uColorShift, uDistort, uBloom, uFade, uOctaves, uFlash;
uniform vec2 uCam;
uniform float uZoom, uRoll;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n){ return fract(sin(n) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uOctaves) break;
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
vec2 camUV(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float c = cos(uRoll), s = sin(uRoll);
  p = mat2(c, -s, s, c) * p;
  return p / uZoom + uCam;
}
vec3 hueShift(vec3 col, float a){
  const vec3 k = vec3(0.57735);
  float c = cos(a);
  return col * c + cross(k, col) * sin(a) + k * dot(k, col) * (1.0 - c);
}
vec3 finish(vec3 col, vec2 p){
  col = hueShift(col, uColorShift);
  col += uEmph * 0.08 * uIntensity;
  col += uC4 * uFlash * 0.06;
  // gentle filmic curve keeps glows from clipping harshly
  col = col / (1.0 + col * 0.35) * 1.2;
  float vig = smoothstep(1.25, 0.2, length(p * vec2(0.85, 1.0)));
  col *= mix(0.55, 1.0, vig);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * uGrain * 0.09;
  return col * uFade;
}
`;

export const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
