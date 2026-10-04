import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel, Room, RoomId, Wall } from "../model/types";
import { pointAlongWall, wallDirection, wallLength } from "../model/WallResolver";
import { rectContains } from "../model/geometry2d";
import type { MatKey, MaterialRegistry } from "../scene/Materials";
import { MeshBuilder, type FaceMats } from "./MeshBuilder";
import { undersideAt, wingRoof } from "./roofMath";

const WET_ROOMS: RoomId[] = ["bathroom", "guest_wc"];

function roomAt(rooms: Room[], x: number, y: number): Room | undefined {
  return rooms.find((r) => r.parts.some((p) => rectContains(p, { x, y })));
}

function faceMaterialFor(room: Room | undefined, exterior: boolean): MatKey {
  if (room && WET_ROOMS.includes(room.id)) return "tileWall";
  return exterior ? "plaster" : "partition";
}

/** Splits a wall into solid pieces around its openings: [s0, s1, z0, z1] in wall-local meters. */
export function wallPieces(wall: Wall): Array<[number, number, number, number]> {
  const pieces: Array<[number, number, number, number]> = [];
  const L = wallLength(wall);
  const H = wall.height;
  let cursor = 0;
  for (const o of wall.openings) {
    const s0 = Math.max(0, o.center - o.width / 2);
    const s1 = Math.min(L, o.center + o.width / 2);
    if (s0 > cursor + 1e-4) pieces.push([cursor, s0, 0, H]);
    if (o.sill > 1e-4) pieces.push([s0, s1, 0, o.sill]);
    if (o.head < H - 1e-4) pieces.push([s0, s1, o.head, H]);
    cursor = Math.max(cursor, s1);
  }
  if (cursor < L - 1e-4) pieces.push([cursor, L, 0, H]);
  return pieces;
}

export function generateWalls(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry): THREE.Group {
  const mb = new MeshBuilder(mats);
  const floor = model.floorLevel;

  for (const wall of model.walls) {
    const dir = wallDirection(wall);
    const rotY = Math.atan2(dir.y, dir.x);
    const exterior = wall.kind === "exterior";
    const leftNormal = { x: -dir.y, y: dir.x };

    for (const [s0, s1, z0, z1] of wallPieces(wall)) {
      const sMid = (s0 + s1) / 2;
      const zMid = (z0 + z1) / 2;
      const c = pointAlongWall(wall, sMid);
      const probe = wall.thickness / 2 + 0.05;
      const leftRoom = roomAt(model.rooms, c.x + leftNormal.x * probe, c.y + leftNormal.y * probe);
      const rightRoom = roomAt(model.rooms, c.x - leftNormal.x * probe, c.y - leftNormal.y * probe);
      // Local +z faces the right-hand side of the wall direction (outside for exterior walls).
      const plusZ: MatKey = exterior ? "cladding" : faceMaterialFor(rightRoom, false);
      const minusZ: MatKey = faceMaterialFor(leftRoom, exterior);
      const reveal: MatKey = exterior ? "trim" : "partition";
      const faces: FaceMats = [reveal, reveal, reveal, reveal, plusZ, minusZ];
      mb.box(faces, c.x, floor + zMid, -c.y, s1 - s0, z1 - z0, wall.thickness, rotY, { uOffset: sMid, vOffset: zMid });
    }
  }

  // Plinth: the house sits on a low concrete base, so cladding starts above the ground.
  const shape = new THREE.Shape(model.footprint.map((p) => new THREE.Vector2(p.x, p.y)));
  const plinth = new THREE.ExtrudeGeometry(shape, { depth: floor, bevelEnabled: false });
  mb.add("plinth", plinth, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  plinth.dispose();

  // Dark corner boards at every footprint corner.
  for (const v of model.footprint) mb.box("cornerBoard", v.x, floor + model.wallHeight / 2, -v.y, 0.1, model.wallHeight, 0.1);

  addGables(mb, model, spec);
  return mb.build("walls");
}

/** Gable triangle in plan-across / height, with a circular hole, mapped onto the gable plane. */
function addPiercedGable(
  mb: MeshBuilder,
  key: MatKey,
  P: (across: number, h: number, off: number) => THREE.Vector3,
  a0: number,
  a1: number,
  base: number,
  apex: number,
  ridge: number,
  cx: number,
  cy: number,
  radius: number,
  off: number
): void {
  const shape = new THREE.Shape();
  shape.moveTo(a0, base);
  shape.lineTo(a1, base);
  shape.lineTo(ridge, apex);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(cx, cy, radius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.getAttribute("position");
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i += 1) {
    const p = P(arr[i * 3], arr[i * 3 + 1], off);
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  mb.add(key, geo);
  geo.dispose();
}

function addGables(mb: MeshBuilder, model: HouseModel, spec: HouseSpec): void {
  const t = spec.building.exteriorWallThickness;
  const floor = model.floorLevel;
  const up = new THREE.Vector3(0, 1, 0);

  for (const wing of model.roofWings) {
    const g = wingRoof(model, wing, t);
    const r = wing.rect;
    const ends: Array<{ end: "start" | "end"; coord: number; outward: number }> = [];
    if (wing.gableAtStart) ends.push({ end: "start", coord: (wing.ridgeAxis === "x" ? r.x : r.y) + t / 2, outward: -1 });
    if (wing.gableAtEnd) ends.push({ end: "end", coord: (wing.ridgeAxis === "x" ? r.x + r.w : r.y + r.h) - t / 2, outward: 1 });

    for (const e of ends) {
      const base = floor + undersideAt(g, g.halfSpan);
      const apex = floor + g.ridgeUnderside;
      const a0 = g.ridgeCoord - g.halfSpan;
      const a1 = g.ridgeCoord + g.halfSpan;
      // 3D helper: plan "across" coordinate + height -> point on the gable plane offset by `off` along the ridge.
      const P = (across: number, h: number, off: number) =>
        wing.ridgeAxis === "x" ? new THREE.Vector3(e.coord + off, h, -across) : new THREE.Vector3(across, h, -(e.coord + off));
      const outwardN = wing.ridgeAxis === "x" ? new THREE.Vector3(e.outward, 0, 0) : new THREE.Vector3(0, 0, -e.outward);
      const uAxis = new THREE.Vector3().crossVectors(up, outwardN);
      const glazed = spec.gableGlazing.some((gg) => gg.wing === wing.id && gg.end === e.end);
      const half = t / 2;

      const oculus = spec.gableOculi?.find((o) => o.wing === wing.id && o.end === e.end);
      if (!glazed && oculus) {
        const radius = oculus.radius ?? 0.4;
        const cx = g.ridgeCoord;
        const cy = base + (apex - base) * 0.52;
        addPiercedGable(mb, "cladding", P, a0, a1, base, apex, g.ridgeCoord, cx, cy, radius, e.outward * half);
        addPiercedGable(mb, "plaster", P, a0 + t, a1 - t, base, apex, g.ridgeCoord, cx, cy, radius * 0.92, -e.outward * half);
        const center = P(cx, cy, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), outwardN.clone().normalize());
        const glass = new THREE.CircleGeometry(radius - 0.04, 40);
        mb.add("glass", glass, new THREE.Matrix4().compose(center, q, new THREE.Vector3(1, 1, 1)));
        glass.dispose();
        const ring = new THREE.RingGeometry(radius - 0.05, radius + 0.07, 40);
        mb.add("windowFrame", ring, new THREE.Matrix4().compose(center.clone().addScaledVector(outwardN, 0.02), q, new THREE.Vector3(1, 1, 1)));
        ring.dispose();
        const proud = (across: number, h: number) => P(across, h, 0).addScaledVector(outwardN, 0.04);
        mb.bar("windowFrame", proud(cx - radius + 0.06, cy), proud(cx + radius - 0.06, cy), 0.035, 0.045, outwardN);
        mb.bar("windowFrame", proud(cx, cy - radius + 0.06), proud(cx, cy + radius - 0.06), 0.035, 0.045, outwardN);
        continue;
      }

      if (!glazed) {
        const outer = [P(a0, base, e.outward * half), P(a1, base, e.outward * half), P(g.ridgeCoord, apex, e.outward * half)];
        const inner = [P(a0 + t, base, -e.outward * half), P(a1 - t, base, -e.outward * half), P(g.ridgeCoord, apex, -e.outward * half)];
        mb.polygon("cladding", outer, outwardN, outer[0], uAxis);
        mb.polygon("plaster", inner, outwardN.clone().negate(), inner[0], uAxis.clone().negate());
        continue;
      }

      // Glazed gable: framed glass triangle above the wall head.
      const wallTopH = floor + model.wallHeight;
      const tri = [P(a0 + t, wallTopH, 0), P(a1 - t, wallTopH, 0), P(g.ridgeCoord, apex - 0.05, 0)];
      mb.polygon("glass", tri, outwardN, tri[0], uAxis);
      // Frame bars: thickness through the wall along the gable normal, 10 cm face width.
      mb.bar("windowFrame", tri[0], tri[1], t * 0.6, 0.1, outwardN);
      mb.bar("windowFrame", tri[0], tri[2], t * 0.6, 0.1, outwardN);
      mb.bar("windowFrame", tri[1], tri[2], t * 0.6, 0.1, outwardN);
      const span = a1 - a0 - 2 * t;
      for (const f of [-0.25, 0, 0.25]) {
        const across = g.ridgeCoord + f * span;
        const top = floor + undersideAt(g, Math.abs(across - g.ridgeCoord));
        mb.bar("windowFrame", P(across, wallTopH, 0), P(across, top, 0), t * 0.5, 0.07, outwardN);
      }
      // Wall band between the wall top and the roof underside at the outer face.
      const outer = [P(a0, base, e.outward * half), P(a1, base, e.outward * half), P(a1, wallTopH, e.outward * half), P(a0, wallTopH, e.outward * half)];
      if (wallTopH > base + 1e-3) mb.polygon("cladding", outer, outwardN, outer[0], uAxis);
    }
  }

  // Interior gables: partitions that bound a vaulted room and run across a wing's ridge.
  const done = new Set<string>();
  for (const room of model.rooms.filter((r) => r.ceilingType === "vaulted")) {
    for (const wall of model.walls.filter((w) => w.kind === "partition" && w.rooms.includes(room.id))) {
      const vertical = Math.abs(wall.start.x - wall.end.x) < 1e-6;
      const wing = model.roofWings.find((w) => (w.ridgeAxis === "x") === vertical && rectContains(w.rect, { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }));
      if (!wing) continue;
      const g = wingRoof(model, wing, t);
      const coord = vertical ? wall.start.x : wall.start.y;
      const key = `${wing.id}:${vertical}:${coord.toFixed(3)}`;
      if (done.has(key)) continue;
      done.add(key);
      const a0 = g.ridgeCoord - g.halfSpan + t;
      const a1 = g.ridgeCoord + g.halfSpan - t;
      const H = floor + model.wallHeight;
      const apex = floor + g.ridgeUnderside;
      for (const sgn of [1, -1]) {
        const off = (sgn * wall.thickness) / 2;
        const P = (across: number, h: number) => (vertical ? new THREE.Vector3(coord + off, h, -across) : new THREE.Vector3(across, h, -(coord + off)));
        const n = vertical ? new THREE.Vector3(sgn, 0, 0) : new THREE.Vector3(0, 0, -sgn);
        const pts = [P(a0, H), P(a1, H), P(g.ridgeCoord, apex)];
        mb.polygon("partition", pts, n, pts[0], new THREE.Vector3().crossVectors(up, n));
      }
    }
  }
}
