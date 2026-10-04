import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

/** Bloom (for lamps, candles and string lights), optional ambient occlusion, tone-mapped output. */
export class PostProcessing {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly gtao: GTAOPass;
  enabled = true;

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.enabled = false;
    this.gtao.blendIntensity = 0.8;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(size, 0.3, 0.4, 1.25);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setBloom(strength: number): void {
    this.bloom.strength = strength;
    this.bloom.enabled = strength > 0.01;
  }

  setAmbientOcclusion(on: boolean): void {
    this.gtao.enabled = on;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.enabled) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
