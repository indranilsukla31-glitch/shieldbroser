import * as THREE from "three";
import { PARTICLE_BEHAVIORS, PARTICLE_SHAPES, type VisualDna } from "@artei/shared/client";

const VERT = /* glsl */ `
uniform float uT, uSize, uSpeed, uBehavior, uBurst, uHighs, uBass, uPixelRatio, uSizeBoost, uSpeedBoost, uCount;
attribute vec4 aSeed;
varying float vAlpha;
varying float vSeed;
varying float vRot;
void main(){
  vec3 pos = position;
  float sp = uSpeed * (0.4 + aSeed.y) * (1.0 + uSpeedBoost);
  float t = uT;
  if (uBehavior < 0.5) {            // float
    pos += vec3(sin(t * 0.3 * sp + aSeed.x * 6.28), cos(t * 0.25 * sp + aSeed.z * 6.28), sin(t * 0.2 + aSeed.w * 6.28)) * 0.12;
  } else if (uBehavior < 1.5) {     // rise
    pos.y = mod(pos.y + 1.2 + t * sp * 0.25, 2.4) - 1.2;
    pos.x += sin(t * 0.5 + aSeed.w * 6.28) * 0.05;
  } else if (uBehavior < 2.5) {     // fall
    pos.y = mod(pos.y + 1.2 - t * sp * 0.3, 2.4) - 1.2;
    pos.x += sin(t * 0.4 + aSeed.w * 6.28) * 0.06;
  } else if (uBehavior < 3.5) {     // orbit
    float a = t * sp * 0.15;
    float c = cos(a), s = sin(a);
    pos.xz = mat2(c, -s, s, c) * pos.xz;
  } else {                          // burst: stream outward from the centre
    float r = fract(aSeed.x + t * sp * 0.08);
    vec3 dir = normalize(position + 0.0001);
    pos = dir * r * 1.8;
  }
  pos *= 1.0 + uBurst * 0.35 * aSeed.z;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.35 + aSeed.w) * (1.0 + uSizeBoost + uHighs * 0.6);
  gl_PointSize = size * uPixelRatio * (2.4 / -mv.z);
  vAlpha = smoothstep(4.5, 1.2, -mv.z) * (0.45 + 0.55 * aSeed.y);
  // hide the tail of the buffer when density is lowered
  if (aSeed.x * 6000.0 > uCount) { gl_PointSize = 0.0; }
  vSeed = aSeed.x;
  vRot = aSeed.z * 6.28 + uT * (aSeed.y - 0.5);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uShape, uOpacity;
varying float vAlpha;
varying float vSeed;
varying float vRot;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a;
  if (uShape < 0.5) {               // dot
    a = smoothstep(0.5, 0.2, length(c));
  } else if (uShape < 1.5) {        // spark: four-point star
    vec2 q = abs(c);
    a = smoothstep(0.06, 0.0, min(q.x, q.y) * (0.5 + length(c) * 3.0)) * smoothstep(0.5, 0.0, length(c));
  } else if (uShape < 2.5) {        // dust
    a = smoothstep(0.5, 0.0, length(c)) * 0.6;
  } else if (uShape < 3.5) {        // droplet: vertical streak
    a = smoothstep(0.5, 0.0, length(c * vec2(4.0, 1.0)));
  } else {
    float cs = cos(vRot), sn = sin(vRot);
    vec2 r = mat2(cs, -sn, sn, cs) * c;
    if (uShape < 4.5) a = smoothstep(0.5, 0.42, length(r * vec2(1.0, 2.2)));        // petal
    else a = smoothstep(0.02, 0.0, abs(r.x) + abs(r.y) * 2.2 - 0.45);              // shard
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColA, uColB, vSeed), a * vAlpha * uOpacity);
}`;

export const MAX_PARTICLES = 6000;

export class Particles {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const seed = new Float32Array(MAX_PARTICLES * 4);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 1.8;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 1.2;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 1.2;
      // aSeed.x doubles as a stable sort key for density culling
      seed[i * 4] = i / MAX_PARTICLES;
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 0 },
        uSize: { value: 6 },
        uSpeed: { value: 1 },
        uBehavior: { value: 0 },
        uBurst: { value: 0 },
        uHighs: { value: 0 },
        uBass: { value: 0 },
        uPixelRatio: { value: 1 },
        uSizeBoost: { value: 0 },
        uSpeedBoost: { value: 0 },
        uCount: { value: 2000 },
        uColA: { value: new THREE.Color() },
        uColB: { value: new THREE.Color() },
        uShape: { value: 0 },
        uOpacity: { value: 1 },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  configure(dna: VisualDna, maxCount: number, lightScene: boolean) {
    const u = this.material.uniforms;
    u.uShape!.value = PARTICLE_SHAPES.indexOf(dna.particles.shape);
    u.uBehavior!.value = PARTICLE_BEHAVIORS.indexOf(dna.particles.behavior);
    u.uSize!.value = 4 + dna.particles.size * 22;
    u.uCount!.value = Math.round(maxCount * (0.15 + 0.85 * dna.particles.density));
    (u.uColA!.value as THREE.Color).set(lightScene ? dna.palette.primary : dna.palette.highlight);
    (u.uColB!.value as THREE.Color).set(dna.palette.accent);
    this.material.blending = lightScene ? THREE.NormalBlending : THREE.AdditiveBlending;
    u.uOpacity!.value = lightScene ? 0.55 : 0.85;
    this.material.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
