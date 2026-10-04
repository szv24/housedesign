import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FirstPersonController } from "./FirstPersonController";

export type ViewMode = "walk" | "orbit" | "plan" | "dollhouse";

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromFov: number;
  toFov: number;
  t: number;
  duration: number;
  done: () => void;
}

const FOV: Record<ViewMode, number> = { walk: 70, orbit: 45, plan: 40, dollhouse: 42 };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Owns the camera: orbit-style modes via OrbitControls, walking via the FirstPersonController. */
export class CameraModes {
  readonly orbit: OrbitControls;
  mode: ViewMode = "orbit";
  private tween: Tween | null = null;
  private center = new THREE.Vector3();
  private radius = 12;
  onModeApplied: (mode: ViewMode) => void = () => {};

  constructor(private readonly camera: THREE.PerspectiveCamera, dom: HTMLElement, private readonly fp: FirstPersonController) {
    this.orbit = new OrbitControls(camera, dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.rotateSpeed = 0.6;
    this.orbit.zoomSpeed = 0.9;
    this.orbit.panSpeed = 0.8;
    this.orbit.screenSpacePanning = true;
  }

  get transitioning(): boolean {
    return this.tween !== null;
  }

  setHouse(center: THREE.Vector3, radius: number): void {
    this.center.copy(center);
    this.radius = radius;
  }

  /** Initial framing without animation. */
  jumpTo(mode: ViewMode): void {
    const { pos, target } = this.pose(mode);
    this.camera.position.copy(pos);
    this.camera.fov = FOV[mode];
    this.camera.updateProjectionMatrix();
    this.apply(mode, target);
  }

  setMode(mode: ViewMode, walkPose?: { x: number; y: number; yaw: number }): void {
    if (mode === "walk" && walkPose) this.fp.setPose(walkPose.x, walkPose.y, walkPose.yaw);
    const from = this.camera.position.clone();
    const fromTarget = this.mode === "walk" ? this.fp.lookTarget() : this.orbit.target.clone();
    const { pos, target } = this.pose(mode);
    this.fp.enabled = false;
    this.fp.exitLock();
    this.orbit.enabled = false;
    const dist = from.distanceTo(pos);
    this.tween = {
      fromPos: from,
      toPos: pos,
      fromTarget,
      toTarget: target,
      fromFov: this.camera.fov,
      toFov: FOV[mode],
      t: 0,
      duration: THREE.MathUtils.clamp(0.6 + dist / 40, 0.7, 1.5),
      done: () => this.apply(mode, target)
    };
    this.mode = mode;
  }

  private pose(mode: ViewMode): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const c = this.center;
    const r = this.radius;
    switch (mode) {
      case "walk":
        return { pos: this.fp.eye(), target: this.fp.lookTarget() };
      case "plan":
        return { pos: new THREE.Vector3(c.x, r * 3.1, c.z + 0.01), target: new THREE.Vector3(c.x, 0, c.z) };
      case "dollhouse":
        return { pos: new THREE.Vector3(c.x - r * 0.9, r * 1.7, c.z + r * 1.5), target: new THREE.Vector3(c.x, 0.8, c.z) };
      default:
        return { pos: new THREE.Vector3(c.x + r * 1.2, r * 0.62, c.z + r * 1.75), target: new THREE.Vector3(c.x, 1.6, c.z) };
    }
  }

  private apply(mode: ViewMode, target: THREE.Vector3): void {
    this.tween = null;
    if (mode === "walk") {
      this.orbit.enabled = false;
      this.fp.enabled = true;
      this.fp.setPose(this.fp.position.x, this.fp.position.y, this.fp.yaw, this.fp.pitch);
      this.onModeApplied(mode);
      return;
    }
    const o = this.orbit;
    o.target.copy(target);
    o.enabled = true;
    o.minDistance = mode === "plan" ? 8 : 4;
    o.maxDistance = mode === "plan" ? 80 : 75;
    if (mode === "plan") {
      o.minPolarAngle = 0;
      o.maxPolarAngle = 0;
      o.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    } else {
      o.minPolarAngle = mode === "dollhouse" ? 0.15 : 0.05;
      o.maxPolarAngle = mode === "dollhouse" ? 1.25 : 1.47;
      o.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    }
    o.update();
    this.onModeApplied(mode);
  }

  update(dt: number): void {
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const k = ease(tw.t);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      // Lift the path a little so aerial-to-walk transitions don't clip through the roof edge.
      this.camera.position.y += Math.sin(k * Math.PI) * Math.min(4, tw.fromPos.distanceTo(tw.toPos) * 0.08);
      const target = tw.fromTarget.clone().lerp(tw.toTarget, k);
      this.camera.fov = THREE.MathUtils.lerp(tw.fromFov, tw.toFov, k);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(target);
      if (tw.t >= 1) tw.done();
      return;
    }
    if (this.mode !== "walk") {
      this.orbit.update();
      // Keep the orbit pivot within reach of the house and above ground.
      const t = this.orbit.target;
      t.y = THREE.MathUtils.clamp(t.y, 0, 6);
      t.x = THREE.MathUtils.clamp(t.x, this.center.x - 40, this.center.x + 40);
      t.z = THREE.MathUtils.clamp(t.z, this.center.z - 40, this.center.z + 40);
      if (this.camera.position.y < 0.6) this.camera.position.y = 0.6;
    }
  }
}
