import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel, Rect } from "../model/types";
import { pointAlongWall } from "../model/WallResolver";
import { pointInPolygon, rectContains } from "../model/geometry2d";
import { MeshBuilder } from "../architecture/MeshBuilder";
import type { MaterialRegistry } from "./Materials";

export interface EnvironmentResult {
  group: THREE.Group;
  /** Circle colliders (tree trunks, boulders). */
  circles: Array<{ x: number; y: number; r: number }>;
  /** Rect colliders (hedges). */
  rects: Rect[];
  /** Extra walkable surfaces (entrance landing). */
  surfaces: Array<{ rect: Rect; height: number }>;
  plot: Rect;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type TreeKind = "birch" | "spruce" | "apple";

export function createEnvironment(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry): EnvironmentResult {
  const group = new THREE.Group();
  group.name = "environment";
  const plot = spec.site.plot;
  const circles: EnvironmentResult["circles"] = [];
  const rects: Rect[] = [];
  const surfaces: EnvironmentResult["surfaces"] = [];
  const mb = new MeshBuilder(mats);
  const rand = rng(7);

  // Ground: lawn everywhere, with soft hills on the horizon.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mats.grass);
  const uv = ground.geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 600, uv.getY(i) * 600);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);
  const hillMat = new THREE.MeshStandardMaterial({ color: "#7d8f68", roughness: 1 });
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const d = 140 + rand() * 60;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillMat);
    hill.scale.set(50 + rand() * 40, 8 + rand() * 10, 40 + rand() * 30);
    hill.position.set(Math.cos(a) * d + 8, -2, Math.sin(a) * d - 8);
    group.add(hill);
  }

  // Street along the north boundary.
  const street = { x: plot.x - 40, y: plot.y + plot.h + 1.5, w: plot.w + 80, h: 6 };
  mb.box("asphalt", street.x + street.w / 2, 0.01, -(street.y + street.h / 2), street.w, 0.02, street.h, 0, { skip: [0, 1, 3, 4, 5] });

  // Front door: landing, step and a paver path to the street.
  const fd = model.walls.flatMap((w) => w.openings.filter((o) => o.kind === "front_door").map((o) => ({ w, o })))[0];
  let pathX = 6;
  if (fd) {
    const p = pointAlongWall(fd.w, fd.o.center);
    pathX = p.x;
    const yWall = p.y + fd.w.thickness / 2;
    const landing = { x: p.x - 0.9, y: yWall, w: 1.8, h: 1.2 };
    const step = { x: p.x - 0.9, y: yWall + 1.2, w: 1.8, h: 0.4 };
    const lh = model.floorLevel - 0.02;
    mb.box("concrete", landing.x + landing.w / 2, lh / 2, -(landing.y + landing.h / 2), landing.w, lh, landing.h);
    mb.box("concrete", step.x + step.w / 2, lh / 4, -(step.y + step.h / 2), step.w, lh / 2, step.h);
    surfaces.push({ rect: landing, height: lh }, { rect: step, height: lh / 2 });
    for (let y = step.y + step.h + 0.15; y < street.y - 0.3; y += 0.75) {
      mb.box("paver", p.x + (rand() - 0.5) * 0.06, 0.025, -(y + 0.25), 1.2, 0.05, 0.55);
    }
  }
  // Gravel parking beside the path.
  const gravel = { x: pathX - 9.5, y: model.bounds.y + model.bounds.h + 2.0, w: 6.5, h: street.y - (model.bounds.y + model.bounds.h + 2.0) };
  mb.box("gravel", gravel.x + gravel.w / 2, 0.012, -(gravel.y + gravel.h / 2), gravel.w, 0.024, gravel.h, 0, { skip: [0, 1, 3, 4, 5], uOffset: 0, vOffset: 0 });

  // Stepping stones from the main terrace into the garden.
  const terrace = model.terraces.find((t) => t.id === "main_terrace");
  const stepRect = terrace?.steps[0];
  if (terrace && stepRect) {
    const sx = terrace.rect.x + terrace.rect.w * 0.56;
    for (let i = 0; i < 8; i += 1) {
      const y = stepRect.y - 0.6 - i * 0.8;
      mb.box("paver", sx + Math.sin(i * 0.9) * 0.5, 0.02, -y, 0.75, 0.04, 0.5, (rand() - 0.5) * 0.3);
    }
  }

  // Boundary hedges with gaps for the path and the parking.
  const hedgeH = 1.6;
  const hedgeD = 0.9;
  const addHedge = (r: Rect) => {
    if (r.w <= 0.2 || r.h <= 0.2) return;
    mb.box("hedge", r.x + r.w / 2, hedgeH / 2, -(r.y + r.h / 2), r.w, hedgeH, r.h, 0, { uOffset: r.x, vOffset: 0 });
    rects.push(r);
  };
  addHedge({ x: plot.x, y: plot.y, w: plot.w, h: hedgeD });
  addHedge({ x: plot.x, y: plot.y, w: hedgeD, h: plot.h });
  addHedge({ x: plot.x + plot.w - hedgeD, y: plot.y, w: hedgeD, h: plot.h });
  const northY = plot.y + plot.h - hedgeD;
  addHedge({ x: plot.x, y: northY, w: gravel.x - plot.x, h: hedgeD });
  addHedge({ x: gravel.x + gravel.w, y: northY, w: pathX - 0.9 - (gravel.x + gravel.w), h: hedgeD });
  addHedge({ x: pathX + 0.9, y: northY, w: plot.x + plot.w - (pathX + 0.9), h: hedgeD });

  // Granite boulders: a quiet Nordic note.
  const insideHouse = (x: number, y: number) =>
    pointInPolygon({ x, y }, model.footprint) || model.terraces.some((t) => rectContains(t.rect, { x, y }, 0.8));
  for (const [x, y, s] of [
    [21, 4, 0.9],
    [23.5, -7, 0.7],
    [-6, -4, 0.8],
    [-5.2, -3.1, 0.45]
  ]) {
    if (insideHouse(x, y)) continue;
    mb.sphere("boulder", x, s * 0.35, -y, s, 1.3, 0.75, 1, 7);
    circles.push({ x, y, r: s * 1.1 });
  }
  group.add(mb.build("landscape"));

  // Trees (instanced).
  const trees: Array<{ kind: TreeKind; x: number; y: number; s: number }> = [
    { kind: "spruce", x: -11, y: 24, s: 1.1 },
    { kind: "spruce", x: -12.2, y: 19.5, s: 0.95 },
    { kind: "spruce", x: -10.6, y: 14.8, s: 1.05 },
    { kind: "spruce", x: -12, y: 10.2, s: 0.9 },
    { kind: "spruce", x: 28.5, y: 24.5, s: 1.0 },
    { kind: "birch", x: 28.4, y: 7.2, s: 1 },
    { kind: "birch", x: 29.6, y: 10.6, s: 0.9 },
    { kind: "birch", x: 26.8, y: 12.8, s: 0.85 },
    { kind: "birch", x: 29.2, y: 3.4, s: 1.05 },
    { kind: "birch", x: -9.5, y: 6.5, s: 0.95 },
    { kind: "birch", x: -10.5, y: -2.5, s: 1.0 },
    { kind: "apple", x: 4.5, y: -8.5, s: 1 },
    { kind: "apple", x: 12.5, y: -10.5, s: 0.9 },
    { kind: "apple", x: 19, y: -11.5, s: 0.95 }
  ];
  if (terrace?.plantingBuffer) {
    const b = terrace.plantingBuffer;
    trees.push({ kind: "birch", x: b.x + b.w / 2, y: b.y + b.h * 0.3, s: 0.5 });
  }
  const planted = trees.filter((tr) => !insideHouse(tr.x, tr.y));
  group.add(buildTrees(planted, mats, rand));
  for (const t of planted) circles.push({ x: t.x, y: t.y, r: 0.25 * t.s });

  // Ornamental grasses along the terrace, the buffer and the house edges.
  const clumps: Array<{ x: number; y: number; s: number }> = [];
  if (terrace?.plantingBuffer) {
    const b = terrace.plantingBuffer;
    for (let i = 0; i < 14; i += 1) clumps.push({ x: b.x + 0.2 + rand() * (b.w - 0.4), y: b.y + 0.2 + rand() * (b.h - 0.4), s: 0.8 + rand() * 0.4 });
  }
  if (terrace) {
    const r = terrace.rect;
    for (let i = 0; i < 18; i += 1) clumps.push({ x: r.x + r.w + 0.9 + rand() * 1.2, y: r.y + rand() * r.h, s: 0.6 + rand() * 0.5 });
  }
  for (let i = 0; i < 26; i += 1) clumps.push({ x: -2.8 - rand() * 2.5, y: 4 + rand() * 12, s: 0.6 + rand() * 0.5 });
  group.add(buildGrasses(clumps, mats));

  return { group, circles, rects, surfaces, plot };
}

function buildTrees(trees: Array<{ kind: TreeKind; x: number; y: number; s: number }>, mats: MaterialRegistry, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.name = "trees";
  const cyl = new THREE.CylinderGeometry(0.5, 1, 1, 8);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 9);
  const parts: Record<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[] }> = {
    birchTrunk: { geo: cyl, mat: mats.birchBark, mats: [] },
    birchCrown: { geo: ico, mat: mats.birchLeaf, mats: [] },
    trunk: { geo: cyl, mat: mats.bark, mats: [] },
    spruce: { geo: cone, mat: mats.spruce, mats: [] },
    appleCrown: { geo: ico, mat: mats.appleLeaf, mats: [] }
  };
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

  for (const t of trees) {
    const X = t.x;
    const Z = -t.y;
    const s = t.s;
    if (t.kind === "birch") {
      for (let k = 0; k < 3; k += 1) {
        const a = k * 2.1 + rand();
        const ox = Math.cos(a) * 0.25 * s;
        const oz = Math.sin(a) * 0.25 * s;
        const h = (5.5 + rand() * 2) * s;
        parts.birchTrunk.mats.push(M(X + ox, h / 2, Z + oz, 0.14 * s, h, 0.14 * s));
        for (let c = 0; c < 3; c += 1) {
          const r = (1.0 + rand() * 0.6) * s;
          parts.birchCrown.mats.push(M(X + ox * 3 + (rand() - 0.5) * 1.2 * s, h - 0.6 * s + c * 0.7 * s, Z + oz * 3 + (rand() - 0.5) * 1.2 * s, r, r * 1.25, r, rand() * 6));
        }
      }
    } else if (t.kind === "spruce") {
      const h = 9 * s;
      parts.trunk.mats.push(M(X, 1, Z, 0.35 * s, 2, 0.35 * s));
      for (let c = 0; c < 4; c += 1) {
        const r = (2.4 - c * 0.5) * s;
        parts.spruce.mats.push(M(X, 1.4 * s + c * 1.75 * s + (h * 0.18) / 2, Z, r, h * 0.36, r, rand() * 6));
      }
    } else {
      const h = 2.0 * s;
      parts.trunk.mats.push(M(X, h / 2, Z, 0.22 * s, h, 0.22 * s));
      for (let c = 0; c < 4; c += 1) parts.appleCrown.mats.push(M(X + (rand() - 0.5) * 1.4 * s, h + 0.8 * s + rand() * 0.5 * s, Z + (rand() - 0.5) * 1.4 * s, 1.3 * s, 1.0 * s, 1.3 * s, rand() * 6));
    }
  }
  for (const [name, p] of Object.entries(parts)) {
    if (!p.mats.length) continue;
    const mesh = new THREE.InstancedMesh(p.geo, p.mat, p.mats.length);
    p.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    g.add(mesh);
  }
  return g;
}

function buildGrasses(clumps: Array<{ x: number; y: number; s: number }>, mats: MaterialRegistry): THREE.InstancedMesh {
  const blade = new THREE.ConeGeometry(0.035, 1, 4);
  blade.translate(0, 0.5, 0);
  const perClump = 9;
  const mesh = new THREE.InstancedMesh(blade, mats.birchLeaf, clumps.length * perClump);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const c of clumps) {
    for (let k = 0; k < perClump; k += 1) {
      const a = (k / perClump) * Math.PI * 2;
      const tilt = 0.25 + (k % 3) * 0.08;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, Math.cos(a) * tilt));
      m.compose(new THREE.Vector3(c.x + Math.cos(a) * 0.05, 0, -c.y + Math.sin(a) * 0.05), q, new THREE.Vector3(c.s, c.s * (0.55 + (k % 4) * 0.08), c.s));
      mesh.setMatrixAt(i++, m);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = "grasses";
  return mesh;
}
