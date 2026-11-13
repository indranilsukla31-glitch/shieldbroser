import * as THREE from "three";
import type { SceneType, VisualDna } from "@artei/shared";
import type { AudioFrame } from "../audio/analyser";
import { sceneFragment, LIGHT_SCENES } from "./scenes";
import { VERT } from "./scenes/common";
import { Particles } from "./particles";
import { AdaptiveResolution, detectTier, TIERS, type Tier } from "./quality";
import { DnaMapper, type FrameParams } from "./dnaMapper";

export interface EngineFrame {
  audio: AudioFrame;
  params: FrameParams;
  dt: number;
  time: number;
}

export interface EngineOptions {
  /** Pull the current audio frame (called once per rendered frame). */
  getAudio: (dt: number) => AudioFrame;
  /** Song position as 0..1 (drives Visual DNA moments). */
  getProgress: () => number;
  /** Whether audio is currently playing (idle frames are throttled). */
  isPlaying: () => boolean;
  calm: boolean;
  onFrame?: (f: EngineFrame) => void;
  /** Force a tier (testing). */
  tier?: Tier;
}

const SCENE_UNIFORMS = () => ({
  uTime: { value: 0 },
  uT: { value: 0 },
  uRes: { value: new THREE.Vector2(1, 1) },
  uBg: { value: new THREE.Color() },
  uC1: { value: new THREE.Color() },
  uC2: { value: new THREE.Color() },
  uC3: { value: new THREE.Color() },
  uC4: { value: new THREE.Color() },
  uEmph: { value: new THREE.Color() },
  uIntensity: { value: 0.5 },
  uComplexity: { value: 0.5 },
  uGlow: { value: 0.5 },
  uGrain: { value: 0.2 },
  uTurb: { value: 0.3 },
  uBass: { value: 0 },
  uMids: { value: 0 },
  uHighs: { value: 0 },
  uBeat: { value: 0 },
  uColorShift: { value: 0 },
  uDistort: { value: 0 },
  uBloom: { value: 0 },
  uFade: { value: 0 },
  uOctaves: { value: 4 },
  uFlash: { value: 0 },
  uCam: { value: new THREE.Vector2() },
  uZoom: { value: 1 },
  uRoll: { value: 0 },
});

/**
 * The renderer: a full-screen scene shader plus a 3D particle field, both
 * parameterized by Visual DNA. Claude never supplies code — only the DNA
 * numbers/enums that feed these uniforms.
 */
export class VisualEngine {
  readonly canvas: HTMLCanvasElement;
  readonly tier: Tier;
  private renderer: THREE.WebGLRenderer;
  private bgScene = new THREE.Scene();
  private bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fxScene = new THREE.Scene();
  private fxCam = new THREE.PerspectiveCamera(55, 1, 0.1, 20);
  private quad: THREE.Mesh;
  private sceneMat?: THREE.ShaderMaterial;
  private sceneType?: SceneType;
  private uniforms = SCENE_UNIFORMS();
  private particles = new Particles();
  private mapper: DnaMapper;
  private dna: VisualDna;
  private adaptive = new AdaptiveResolution();
  private raf = 0;
  private running = false;
  private last = 0;
  private clock = 0;
  private motionT = 0;
  private camT = 0;
  private skip = false;
  private width = 1;
  private height = 1;
  private calm: boolean;
  private shake = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement, dna: VisualDna, private opts: EngineOptions) {
    this.canvas = canvas;
    this.calm = opts.calm;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.tier = opts.tier ?? detectTier(this.renderer.getContext());
    this.uniforms.uOctaves.value = TIERS[this.tier].octaves;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.bgScene.add(this.quad);
    this.fxScene.add(this.particles.points);
    this.fxCam.position.set(0, 0, 2.4);
    this.dna = dna;
    this.mapper = new DnaMapper(dna);
    this.applyDna(dna);
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
  }

  setCalm(calm: boolean) {
    this.calm = calm;
  }

  setDna(dna: VisualDna) {
    this.dna = dna;
    this.mapper.setDna(dna);
    this.applyDna(dna);
  }

  private applyDna(dna: VisualDna) {
    const u = this.uniforms;
    if (dna.scene.type !== this.sceneType) {
      this.sceneMat?.dispose();
      this.sceneMat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: sceneFragment(dna.scene.type),
        uniforms: u,
        depthTest: false,
        depthWrite: false,
      });
      this.quad.material = this.sceneMat;
      this.sceneType = dna.scene.type;
      u.uFade.value = 0; // fade the new world in
    }
    u.uBg.value.set(dna.palette.background);
    u.uC1.value.set(dna.palette.primary);
    u.uC2.value.set(dna.palette.secondary);
    u.uC3.value.set(dna.palette.accent);
    u.uC4.value.set(dna.palette.highlight);
    u.uComplexity.value = dna.scene.complexity;
    u.uGrain.value = dna.scene.grain;
    u.uTurb.value = dna.motion.turbulence;
    this.particles.configure(dna, TIERS[this.tier].particles, LIGHT_SCENES.has(dna.scene.type));
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.applyResolution();
  }

  private applyResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[this.tier].maxDpr) * this.adaptive.scale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.uniforms.uRes.value.set(this.width * dpr, this.height * dpr);
    this.fxCam.aspect = this.width / this.height;
    this.fxCam.updateProjectionMatrix();
    this.particles.material.uniforms.uPixelRatio!.value = dpr;
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => {
    // Never render (or burn battery) in a hidden tab.
    if (document.hidden) this.stop();
    else this.start();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
  };

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const frameMs = now - this.last;
    this.last = now;
    const playing = this.opts.isPlaying();
    // Idle (paused) → render at ~30 fps to save battery.
    if (!playing) {
      this.skip = !this.skip;
      if (this.skip) return;
    }
    const dt = Math.min(0.1, frameMs / 1000) * (playing ? 1 : 2);
    if (playing && this.adaptive.update(frameMs, dt)) this.applyResolution();
    this.render(dt);
  };

  /** Advance and draw one frame (also used directly by tests). */
  render(dt: number) {
    const audio = this.opts.getAudio(dt);
    const params = this.mapper.frame(audio, this.opts.getProgress(), dt, this.calm);
    const { dna } = this;
    const u = this.uniforms;
    const m = params.mods;

    this.clock += dt;
    this.motionT += dt * (0.25 + params.motionSpeed * 1.6) * (1 + m.motionSpeed);
    u.uTime.value = this.clock;
    u.uT.value = this.motionT;
    u.uIntensity.value = params.intensity;
    u.uGlow.value = Math.min(1.5, dna.scene.glow + m.glow * 0.6);
    u.uBass.value = audio.bass;
    u.uMids.value = audio.mids;
    u.uHighs.value = audio.highs;
    u.uBeat.value = audio.beat;
    u.uColorShift.value = m.colorShift * 0.5;
    u.uDistort.value = m.distortion;
    u.uBloom.value = m.bloom;
    u.uFlash.value = this.calm ? 0 : audio.beat * (0.4 + m.lyricScale * 0.3);
    u.uFade.value = Math.min(1, u.uFade.value + dt * 1.4);
    const emph = dna.palette[params.emphasis];
    u.uEmph.value.set(emph);

    this.updateCamera(dt, params, audio);

    const pu = this.particles.material.uniforms;
    pu.uT!.value = this.motionT;
    pu.uSpeed!.value = 0.5 + dna.motion.speed * 2;
    pu.uSpeedBoost!.value = m.particleSpeed;
    pu.uSizeBoost!.value = m.particleSize + params.burst * 0.6;
    pu.uBurst!.value = params.burst;
    pu.uHighs!.value = audio.highs;
    pu.uBass!.value = audio.bass;

    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCam);
    this.renderer.render(this.fxScene, this.fxCam);
    this.opts.onFrame?.({ audio, params, dt, time: this.clock });
  }

  private updateCamera(dt: number, params: FrameParams, audio: AudioFrame) {
    const { movement, speed } = this.dna.camera;
    const s = (0.2 + speed) * (this.calm ? 0.4 : 1);
    this.camT += dt * s;
    const t = this.camT;
    const u = this.uniforms;
    let cx = 0, cy = 0, zoom = 1, roll = 0;
    const cam = this.fxCam;
    cam.position.set(0, 0, 2.4);
    switch (movement) {
      case "slow_orbit":
        cx = Math.sin(t * 0.3) * 0.15;
        cy = Math.cos(t * 0.23) * 0.08;
        cam.position.set(Math.sin(t * 0.3) * 0.8, Math.sin(t * 0.2) * 0.2, 2.4 * Math.cos(t * 0.3 * 0.5) + 0.2);
        break;
      case "dolly_in":
        zoom = 1 + ((t * 0.05) % 1) * 0.35;
        cam.position.z = 2.4 - ((t * 0.12) % 1.2);
        break;
      case "drift":
        cx = Math.sin(t * 0.17) * 0.25;
        cy = Math.sin(t * 0.11) * 0.1;
        cam.position.x = cx;
        break;
      case "handheld":
        cx = (Math.sin(t * 1.3) + Math.sin(t * 2.1)) * 0.012;
        cy = (Math.cos(t * 1.7) + Math.sin(t * 2.9)) * 0.012;
        roll = Math.sin(t * 0.9) * 0.01;
        cam.position.x = cx * 4;
        break;
      case "spiral":
        roll = t * 0.05;
        zoom = 1 + Math.sin(t * 0.2) * 0.15;
        cam.position.set(Math.cos(t * 0.4) * 0.5, Math.sin(t * 0.4) * 0.5, 2.4);
        break;
      default:
        break;
    }
    // Beat-driven shake from the audio map.
    const shakeAmt = params.mods.cameraShake * audio.beat * 0.04;
    this.shake.set((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    u.uCam.value.set(cx + this.shake.x, cy + this.shake.y);
    u.uZoom.value = zoom;
    u.uRoll.value = roll;
    cam.position.x += this.shake.x * 3;
    cam.lookAt(0, 0, 0);
  }

  get fps() {
    return this.adaptive.fps;
  }

  get resolutionScale() {
    return this.adaptive.scale;
  }

  dispose() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.sceneMat?.dispose();
    this.quad.geometry.dispose();
    this.particles.dispose();
    this.renderer.dispose();
  }
}
