import * as THREE from "three";
import type { HouseModel, LightFixture } from "../model/types";
import type { MaterialRegistry } from "./Materials";

const RANGE: Record<LightFixture["kind"], number> = {
  pendant: 6.5,
  ceiling: 5.5,
  floor_lamp: 5,
  table_lamp: 3.6,
  wall: 6,
  string: 3.6,
  candle: 2.4,
  spot: 5
};

const EXTERIOR_ROOMS = new Set(["site"]);

/**
 * Fixtures are specified in real candela. The scene's daylight is in renderer units (sun ≈ 3),
 * so lamp output is scaled to keep the daylight-to-lamp balance believable.
 */
const CANDELA_TO_SCENE = 0.2;

/**
 * A fixed pool of point lights (so shaders never recompile) assigned each frame to the fixtures
 * that matter most from the current camera. Every fixture also has an emissive visual, so
 * unassigned lamps still glow.
 */
export class InteriorLights {
  readonly group = new THREE.Group();
  private pool: THREE.PointLight[] = [];
  private fixtures: LightFixture[] = [];
  private assigned: Array<LightFixture | null> = [];
  private interiorLevel = 1;
  private exteriorLevel = 0;
  private timer = 0;
  private stringGroup = new THREE.Group();

  constructor(private readonly mats: MaterialRegistry, poolSize = 14) {
    this.group.name = "interiorLights";
    this.group.add(this.stringGroup);
    this.setPoolSize(poolSize);
  }

  setPoolSize(n: number): void {
    for (const l of this.pool) this.group.remove(l);
    this.pool = Array.from({ length: n }, () => {
      const l = new THREE.PointLight(0xffc58f, 0, 5, 2);
      l.castShadow = false;
      this.group.add(l);
      return l;
    });
    this.assigned = new Array(n).fill(null);
  }

  setFixtures(model: HouseModel): void {
    this.fixtures = model.lights;
    this.assigned.fill(null);
    this.buildStrings(model.lights.filter((l) => l.kind === "string" && l.path));
  }

  setLevels(interior: number, exterior: number): void {
    this.interiorLevel = interior;
    this.exteriorLevel = exterior;
  }

  private levelOf(f: LightFixture): number {
    if (EXTERIOR_ROOMS.has(String(f.roomId))) return this.exteriorLevel;
    if (f.kind === "candle" || f.kind === "string") return 0.45 + 0.55 * this.interiorLevel;
    return this.interiorLevel;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2;
      this.reassign(camera.position);
    }
    // Ease intensities toward their targets to avoid popping.
    const k = 1 - Math.exp(-dt * 8);
    this.pool.forEach((light, i) => {
      const f = this.assigned[i];
      const target = f ? f.intensity * CANDELA_TO_SCENE * this.levelOf(f) : 0;
      light.intensity += (target - light.intensity) * k;
      if (f && f.kind === "candle") light.intensity *= 0.97 + Math.random() * 0.06;
    });
  }

  private reassign(cam: THREE.Vector3): void {
    const scored = this.fixtures
      .map((f) => {
        const level = this.levelOf(f);
        const d2 = (f.x - cam.x) ** 2 + (f.z - cam.y) ** 2 + (-f.y - cam.z) ** 2;
        return { f, score: (f.intensity * level) / (1 + d2 / 9) };
      })
      .filter((s) => s.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.pool.length)
      .map((s) => s.f);

    const keep = new Set(scored);
    // Keep lights that are still selected where they are; fill the rest.
    const free: number[] = [];
    this.assigned.forEach((f, i) => {
      if (!f || !keep.has(f)) free.push(i);
      else keep.delete(f);
    });
    for (const f of keep) {
      const i = free.shift();
      if (i === undefined) break;
      this.assigned[i] = f;
      const light = this.pool[i];
      light.position.set(f.x, f.z, -f.y);
      light.color.setHex(f.color);
      light.distance = RANGE[f.kind];
      light.intensity = 0;
    }
    for (const i of free) if (this.assigned[i] && !scored.includes(this.assigned[i]!)) this.assigned[i] = null;
  }

  /** Instanced warm bulbs along sagging cords. */
  private buildStrings(strings: LightFixture[]): void {
    for (const c of [...this.stringGroup.children]) {
      this.stringGroup.remove(c);
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
    }
    const bulbGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const total = strings.reduce((s, f) => s + (f.bulbs ?? 20), 0);
    if (total === 0) return;
    const bulbs = new THREE.InstancedMesh(bulbGeo, this.mats.bulb, total);
    bulbs.name = "stringLightBulbs";
    const m = new THREE.Matrix4();
    let idx = 0;
    const cordMat = new THREE.LineBasicMaterial({ color: 0x1c1c1c });
    for (const f of strings) {
      const pts = f.path!.map((p) => new THREE.Vector3(p.x, p.z, -p.y));
      const curve = new THREE.CatmullRomCurve3(pts);
      const n = f.bulbs ?? 20;
      for (let i = 0; i < n; i += 1) {
        const p = curve.getPoint(i / (n - 1));
        m.makeTranslation(p.x, p.y - 0.03, p.z);
        bulbs.setMatrixAt(idx++, m);
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(n * 3)), cordMat);
      this.stringGroup.add(line);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    this.stringGroup.add(bulbs);
  }
}
