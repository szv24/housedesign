import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MatKey, MaterialRegistry } from "../scene/Materials";

export type FaceMats = MatKey | [MatKey, MatKey, MatKey, MatKey, MatKey, MatKey];

export interface BoxOptions {
  /** UV origin offsets (meters) so textures line up across neighbouring pieces. */
  uOffset?: number;
  vOffset?: number;
  /** Skip faces by index (+x, -x, +y, -y, +z, -z). */
  skip?: number[];
}

const FACES: Array<{ n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; du: "x" | "y" | "z"; dv: "x" | "y" | "z" }> = [
  { n: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0), du: "z", dv: "y" },
  { n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0), du: "z", dv: "y" },
  { n: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1), du: "x", dv: "z" },
  { n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1), du: "x", dv: "z" },
  { n: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), du: "x", dv: "y" },
  { n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0), du: "x", dv: "y" }
];

/**
 * Accumulates geometry per material and emits one merged mesh per material.
 * Box UVs are in meters (1 texture tile = 1 m).
 */
export class MeshBuilder {
  private readonly buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  /** Applied to everything added while set (lets local-space builders write into a shared batch). */
  transform: THREE.Matrix4 | null = null;

  constructor(private readonly mats: MaterialRegistry) {}

  private push(key: MatKey, g: THREE.BufferGeometry): void {
    if (this.transform) g.applyMatrix4(this.transform);
    const list = this.buckets.get(key) ?? [];
    list.push(g);
    this.buckets.set(key, list);
  }

  add(key: MatKey, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (matrix) g.applyMatrix4(matrix);
    this.push(key, g);
  }

  /** Box centered at (cx, cy, cz) in 3D, sized (sx, sy, sz), rotated about Y. */
  box(mats: FaceMats, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY = 0, opts: BoxOptions = {}): void {
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    this.boxMatrix(mats, m, sx, sy, sz, opts);
  }

  boxMatrix(mats: FaceMats, matrix: THREE.Matrix4, sx: number, sy: number, sz: number, opts: BoxOptions = {}): void {
    const half = { x: sx / 2, y: sy / 2, z: sz / 2 };
    const size = { x: sx, y: sy, z: sz };
    const uo = opts.uOffset ?? 0;
    const vo = opts.vOffset ?? 0;
    FACES.forEach((f, i) => {
      if (opts.skip?.includes(i)) return;
      const key = typeof mats === "string" ? mats : mats[i];
      const center = f.n.clone().multiply(new THREE.Vector3(half.x, half.y, half.z));
      const hu = size[f.du] / 2;
      const hv = size[f.dv] / 2;
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ].map(([a, b]) => center.clone().addScaledVector(f.u, a * hu).addScaledVector(f.v, b * hv));
      const order = [0, 1, 2, 0, 2, 3];
      const pos = new Float32Array(18);
      const nor = new Float32Array(18);
      const uv = new Float32Array(12);
      order.forEach((ci, k) => {
        const c = corners[ci];
        pos.set([c.x, c.y, c.z], k * 3);
        nor.set([f.n.x, f.n.y, f.n.z], k * 3);
        const [a, b] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][ci];
        uv.set([uo + a * hu, vo + b * hv], k * 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.applyMatrix4(matrix);
      this.push(key, g);
    });
  }

  cylinder(key: MatKey, x: number, y: number, z: number, rTop: number, rBottom: number, height: number, segments = 16): void {
    const g = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    this.add(key, g, new THREE.Matrix4().makeTranslation(x, y, z));
    g.dispose();
  }

  sphere(key: MatKey, x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1, segments = 16): void {
    const g = new THREE.SphereGeometry(r, segments, Math.max(8, segments / 2));
    const m = new THREE.Matrix4().makeScale(sx, sy, sz).premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
    this.add(key, g, m);
    g.dispose();
  }

  /**
   * Rectangular bar from p0 to p1. `up` orients the cross-section: the bar's height axis is
   * the component of `up` perpendicular to the bar.
   */
  bar(mats: FaceMats, p0: THREE.Vector3, p1: THREE.Vector3, height: number, depth: number, up = new THREE.Vector3(0, 1, 0)): void {
    const dir = p1.clone().sub(p0);
    const len = dir.length();
    if (len < 1e-5) return;
    dir.divideScalar(len);
    let yAxis = up.clone().addScaledVector(dir, -up.dot(dir));
    if (yAxis.lengthSq() < 1e-8) yAxis = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z);
    yAxis.normalize();
    const zAxis = new THREE.Vector3().crossVectors(dir, yAxis).normalize();
    const m = new THREE.Matrix4().makeBasis(dir, yAxis, zAxis).setPosition(p0.clone().add(p1).multiplyScalar(0.5));
    this.boxMatrix(mats, m, len, height, depth);
  }

  /** Planar convex polygon facing `normal`. UVs: u along `uAxis` from `origin`, v = world height. */
  polygon(key: MatKey, pts: THREE.Vector3[], normal: THREE.Vector3, origin: THREE.Vector3, uAxis: THREE.Vector3): void {
    if (pts.length < 3) return;
    const a = pts[1].clone().sub(pts[0]);
    const b = pts[2].clone().sub(pts[0]);
    const facing = new THREE.Vector3().crossVectors(a, b).dot(normal) >= 0;
    const ordered = facing ? pts : [...pts].reverse();
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 1; i < ordered.length - 1; i += 1) {
      for (const p of [ordered[0], ordered[i], ordered[i + 1]]) {
        pos.push(p.x, p.y, p.z);
        nor.push(normal.x, normal.y, normal.z);
        uv.push(p.clone().sub(origin).dot(uAxis), p.y);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    this.push(key, g);
  }

  isEmpty(): boolean {
    return this.buckets.size === 0;
  }

  build(name: string, opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mat = this.mats[key];
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${name}:${key}`;
      mesh.userData.matKey = key;
      const noShadow = Boolean(mat.userData.noShadow);
      mesh.castShadow = !noShadow && (opts.castShadow ?? true);
      mesh.receiveShadow = opts.receiveShadow ?? true;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

/** Plan (x, y) and floor-relative height to a 3D vector. */
export function planTo3D(x: number, y: number, h = 0): THREE.Vector3 {
  return new THREE.Vector3(x, h, -y);
}
