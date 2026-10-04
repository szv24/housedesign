import * as THREE from "three";
import type { Vec2 } from "../model/types";
import type { CollisionSystem } from "./CollisionSystem";
import type { WalkableSurfaces } from "./WalkableSurfaces";

export const EYE_HEIGHT = 1.65;
const WALK_SPEED = 1.7;
const RUN_SPEED = 3.4;
const DRAG_SENSITIVITY = 0.0042;
const LOCK_SENSITIVITY = 0.0022;

/**
 * First-person walking. Look around by dragging with the mouse (no pointer lock needed) or
 * double-click to capture the mouse. WASD / arrow keys move, Shift runs.
 */
export class FirstPersonController {
  enabled = false;
  yaw = 0;
  pitch = 0;
  position: Vec2 = { x: 0, y: 0 };
  private footHeight = 0;
  private velocity = new THREE.Vector2();
  private keys = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private bob = 0;
  collision: CollisionSystem | null = null;
  surfaces: WalkableSurfaces | null = null;
  onLockChange: (locked: boolean) => void = () => {};

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly dom: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => this.keys.clear());
    dom.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    dom.addEventListener("dblclick", () => {
      if (this.enabled && !this.locked) dom.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => this.onLockChange(this.locked));
  }

  get locked(): boolean {
    return document.pointerLockElement === this.dom;
  }

  get moving(): boolean {
    return this.velocity.lengthSq() > 0.01;
  }

  setPose(x: number, y: number, yaw: number, pitch = -0.05): void {
    this.position = { x, y };
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0);
    this.footHeight = this.surfaces?.heightAt(this.position) ?? 0;
    if (this.enabled) this.apply();
  }

  /** Camera pose for the current state (used by transitions). */
  eye(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.footHeight + EYE_HEIGHT, -this.position.y);
  }

  lookTarget(): THREE.Vector3 {
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    return this.eye().add(dir);
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const f = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const r = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    // Plan-space basis from yaw: forward = north at yaw 0.
    const fwd = { x: -Math.sin(this.yaw), y: Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), y: Math.sin(this.yaw) };
    const wish = new THREE.Vector2(fwd.x * f + right.x * r, fwd.y * f + right.y * r);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    const accel = wish.lengthSq() > 0 ? 9 : 12;
    this.velocity.lerp(wish, 1 - Math.exp(-accel * dt));

    const delta = { x: this.velocity.x * dt, y: this.velocity.y * dt };
    if (Math.abs(delta.x) + Math.abs(delta.y) > 1e-5) {
      this.position = this.collision ? this.collision.move(this.position, delta) : { x: this.position.x + delta.x, y: this.position.y + delta.y };
    }
    const target = this.surfaces?.heightAt(this.position) ?? 0;
    this.footHeight += (target - this.footHeight) * (1 - Math.exp(-14 * dt));
    this.bob += this.velocity.length() * dt * 6.2;
    this.apply();
  }

  private apply(): void {
    const amp = Math.min(1, this.velocity.length() / WALK_SPEED) * 0.012;
    this.camera.position.set(this.position.x, this.footHeight + EYE_HEIGHT + Math.sin(this.bob) * amp, -this.position.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private look(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.45, 1.45);
    if (this.enabled) this.apply();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.locked || e.button !== 0) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    if (this.locked) {
      this.look(e.movementX, e.movementY, LOCK_SENSITIVITY);
      return;
    }
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.look(dx, dy, DRAG_SENSITIVITY);
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    this.keys.add(e.code);
    if (this.enabled && e.code.startsWith("Arrow")) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
}
