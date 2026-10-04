import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import { EMISSIVE_KEYS, type MaterialRegistry } from "./Materials";
import { SkyDome } from "./SkyDome";
import { skyState, type SkyState } from "./TimeOfDay";

/**
 * Daylight rig: sun (with soft shadows fitted to the house), sky dome, hemisphere fill and an
 * environment map rendered from the sky, all driven by one time-of-day value.
 */
export class LightingController {
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly hemi = new THREE.HemisphereLight(0xdfeaf5, 0x5a5648, 1);
  readonly sky = new SkyDome();
  state!: SkyState;
  private readonly envScene = new THREE.Scene();
  private readonly envSky = new SkyDome(50);
  private readonly pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private center = new THREE.Vector3();

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, private readonly mats: MaterialRegistry) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.envScene.add(this.envSky.mesh);
    scene.add(this.sun, this.sun.target, this.hemi, this.sky.mesh);
    scene.fog = new THREE.FogExp2(0xdfe8ef, 0.0045);
  }

  /** Fit the shadow frustum around the house. */
  fitShadow(center: THREE.Vector3, radius: number): void {
    this.center.copy(center);
    const cam = this.sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 1;
    cam.far = radius * 4;
    cam.updateProjectionMatrix();
  }

  setShadowQuality(size: number): void {
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  setTime(spec: HouseSpec, hour: number): SkyState {
    const s = skyState(spec.site.latitude, spec.site.dayOfYear, hour, spec.site.northAngleDeg);
    this.state = s;
    const dist = 60;
    const lightDir = s.direction.clone();
    if (lightDir.y < 0.05) lightDir.y = 0.05;
    this.sun.position.copy(this.center).addScaledVector(lightDir.normalize(), dist);
    this.sun.target.position.copy(this.center);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.sun.visible = s.sunIntensity > 0.01;
    this.hemi.color.copy(s.zenith).lerp(new THREE.Color(0xffffff), 0.45);
    this.hemi.groundColor.copy(s.ground);
    this.hemi.intensity = s.hemiIntensity;
    this.sky.set(s.zenith, s.horizon, s.ground, s.direction, s.sunColor, s.sunIntensity > 0 ? 1 : 0);
    this.envSky.set(s.zenith, s.horizon, s.ground, s.direction, s.sunColor, 0.3);
    (this.scene.fog as THREE.FogExp2).color.copy(s.horizon);
    this.renderer.toneMappingExposure = s.exposure;

    this.envTarget?.dispose();
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = s.envIntensity;

    // Lamp shades and bulbs glow with the interior lighting level.
    const level = s.interiorLevel;
    for (const key of EMISSIVE_KEYS) {
      const m = this.mats[key];
      if (key === "lampShade") m.emissiveIntensity = 0.15 + 0.9 * level;
      if (key === "bulb") m.emissiveIntensity = 1.2 + 3.2 * level;
    }
    this.mats.skylight.emissiveIntensity = 0.3 + 1.4 * THREE.MathUtils.clamp(s.sunIntensity / 3, 0, 1);
    return s;
  }
}
