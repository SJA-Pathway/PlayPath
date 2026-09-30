import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** WebGL renderer + HDR bloom pipeline with an adaptive-quality fallback. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private slowFrames = 0;
  quality: 'high' | 'low' = 'high';

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.5, 60000);
    this.composer = new EffectComposer(this.gl);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.82);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.gl.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(scene: THREE.Scene, dt: number) {
    this.renderPass.scene = scene;
    this.composer.render(dt);
    // Drop pixel ratio once if the device can't keep up (keeps phones playable).
    if (dt > 1 / 38) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.quality === 'high' && this.slowFrames > 120) {
      this.quality = 'low';
      this.gl.setPixelRatio(1);
      this.bloom.resolution.set(128, 128);
      this.resize();
    }
  }
}
