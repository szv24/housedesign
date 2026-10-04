import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel, RoofWing } from "../model/types";
import { rectCenter } from "../model/geometry2d";
import type { MaterialRegistry } from "../scene/Materials";
import { MeshBuilder } from "./MeshBuilder";
import { undersideAt, wingRoof, type WingRoofGeometry } from "./roofMath";

interface SlopeFrame {
  origin: THREE.Vector3;
  /** Maps plan distance from the ridge (u) to 3D (includes the drop). */
  uAxis: THREE.Vector3;
  rAxis: THREE.Vector3;
  normal: THREE.Vector3;
  downslope: THREE.Vector3;
  aSign: number;
}

function slopeFrame(g: WingRoofGeometry, floor: number, sgn: 1 | -1): SlopeFrame {
  const cos = Math.cos(Math.atan(g.tan));
  const sin = Math.sin(Math.atan(g.tan));
  const up = new THREE.Vector3(0, 1, 0);
  const alongX = g.wing.ridgeAxis === "x";
  const horizontal = alongX ? new THREE.Vector3(0, 0, -sgn) : new THREE.Vector3(sgn, 0, 0);
  const origin = alongX ? new THREE.Vector3(0, floor + g.ridgeUnderside, -g.ridgeCoord) : new THREE.Vector3(g.ridgeCoord, floor + g.ridgeUnderside, 0);
  let rAxis = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1);
  const uAxis = horizontal.clone().addScaledVector(up, -g.tan);
  const normal = horizontal.clone().multiplyScalar(sin).addScaledVector(up, cos);
  const downslope = horizontal.clone().multiplyScalar(cos).addScaledVector(up, -sin);
  const det = new THREE.Matrix3().set(uAxis.x, rAxis.x, normal.x, uAxis.y, rAxis.y, normal.y, uAxis.z, rAxis.z, normal.z).determinant();
  let aSign = 1;
  if (det < 0) {
    aSign = -1;
    rAxis = rAxis.negate();
  }
  return { origin, uAxis, rAxis, normal, downslope, aSign };
}

function frameMatrix(f: SlopeFrame, w = 0): THREE.Matrix4 {
  const o = f.origin.clone().addScaledVector(f.normal, w);
  return new THREE.Matrix4().makeBasis(f.uAxis, f.rAxis, f.normal).setPosition(o);
}

/** Slope outline in (u, a) plan coordinates, clipped along valleys where the wings meet. */
function slopeOutline(model: HouseModel, g: WingRoofGeometry, sgn: 1 | -1, t: number): Array<[number, number]> {
  const U = g.halfSpan + model.roofOverhang;
  const [a0, a1] = g.along;
  const primary = model.roofWings.find((w) => w.ridgeAxis !== g.wing.ridgeAxis && w.id !== g.wing.id);
  const secondaryAttached = g.wing.ridgeEndExtension > 0 && primary;

  if (secondaryAttached && primary) {
    // Secondary wing: its roof runs into the primary roof; valley at a = attach + halfSpan - u.
    const attach = primary.rect.y;
    const aMax = (u: number) => Math.min(a1, attach + g.halfSpan - u);
    return [
      [0, a0],
      [U, a0],
      [U, aMax(U)],
      [0, aMax(0)]
    ];
  }

  // Primary wing: cut a V-shaped notch where a secondary wing joins on this slope's side.
  const secondary = model.roofWings.find((w) => w.id !== g.wing.id && w.ridgeEndExtension > 0);
  const facesSecondary = secondary && g.wing.ridgeAxis === "x" && sgn === -1 && secondary.rect.y + secondary.rect.h <= g.wing.rect.y + 1e-6;
  if (!secondary || !facesSecondary) {
    return [
      [0, a0],
      [0, a1],
      [U, a1],
      [U, a0]
    ];
  }
  const sg = wingRoof(model, secondary, t);
  const c = sg.ridgeCoord;
  const offset = g.halfSpan - sg.halfSpan;
  const upper = (a: number) => Math.min(U, offset + Math.abs(a - c));
  const k = U - offset;
  const breaks = [a0, c - k, c, c + k, a1].filter((a) => a >= a0 && a <= a1).sort((p, q) => p - q);
  const pts: Array<[number, number]> = [
    [0, a0],
    [0, a1]
  ];
  for (let i = breaks.length - 1; i >= 0; i -= 1) pts.push([upper(breaks[i]), breaks[i]]);
  return pts;
}

function splitGroups(geo: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const src = geo.index ? geo.toNonIndexed() : geo;
  for (const grp of geo.groups) {
    const g = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      const attr = src.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!attr) continue;
      const arr = (attr.array as Float32Array).slice(grp.start * attr.itemSize, (grp.start + grp.count) * attr.itemSize);
      g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
    }
    out[grp.materialIndex ?? 0] = g;
  }
  return out;
}

function flip(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of [pos, uv]) {
      if (!attr) continue;
      const s = attr.itemSize;
      const arr = attr.array as Float32Array;
      for (let k = 0; k < s; k += 1) {
        const tmp = arr[(i + 1) * s + k];
        arr[(i + 1) * s + k] = arr[(i + 2) * s + k];
        arr[(i + 2) * s + k] = tmp;
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

export function generateRoof(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry): THREE.Group {
  const mb = new MeshBuilder(mats);
  const t = spec.building.exteriorWallThickness;
  const T = spec.building.roofThickness;
  const floor = model.floorLevel;

  for (const wing of model.roofWings) {
    const g = wingRoof(model, wing, t);
    for (const sgn of [1, -1] as const) {
      const f = slopeFrame(g, floor, sgn);
      const outline = slopeOutline(model, g, sgn, t);
      const shape = new THREE.Shape(outline.map(([u, a]) => new THREE.Vector2(u, a * f.aSign)));
      const slab = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
      const [caps, sides] = splitGroups(slab);
      const m = frameMatrix(f);
      if (caps) mb.add("roofMetal", caps, m);
      if (sides) mb.add("fascia", sides, m);
      slab.dispose();

      const under = flip(new THREE.ShapeGeometry(shape));
      mb.add("timberCeiling", under, frameMatrix(f, -0.004));
      under.dispose();
    }

    // Ridge cap
    const ridgeTop = floor + g.ridgeUnderside + T / Math.cos(Math.atan(g.tan));
    const aEnd = wing.ridgeEndExtension > 0 ? g.along[1] - 0.05 : g.along[1];
    const p0 = wing.ridgeAxis === "x" ? new THREE.Vector3(g.along[0], ridgeTop, -g.ridgeCoord) : new THREE.Vector3(g.ridgeCoord, ridgeTop, -g.along[0]);
    const p1 = wing.ridgeAxis === "x" ? new THREE.Vector3(aEnd, ridgeTop, -g.ridgeCoord) : new THREE.Vector3(g.ridgeCoord, ridgeTop, -aEnd);
    mb.bar("fascia", p0, p1, 0.08, 0.22);
  }

  addSkylights(mb, model, spec, t, T);
  addChimney(mb, model, spec, t, T, floor);
  return mb.build("roof");
}

function addChimney(mb: MeshBuilder, model: HouseModel, spec: HouseSpec, t: number, roofThickness: number, floor: number): void {
  if (!spec.chimney) return;
  const wing = model.roofWings.find((w) => w.id === "main") ?? model.roofWings.find((w) => w.ridgeAxis === "x");
  if (!wing) return;
  const g = wingRoof(model, wing, t);
  const cx = wing.ridgeAxis === "x" ? spec.chimney.x : g.ridgeCoord;
  const cz = wing.ridgeAxis === "x" ? -g.ridgeCoord : -spec.chimney.x;
  const top = floor + undersideAt(g, 0) + roofThickness;
  mb.box("brick", cx, top + 0.75, cz, 0.62, 1.5, 0.62);
  mb.box("brick", cx, top + 1.58, cz, 0.8, 0.18, 0.8);
}

function wingCovering(model: HouseModel, x: number, y: number, t: number): { wing: RoofWing; g: WingRoofGeometry; u: number; sgn: 1 | -1 } | null {
  let best: { wing: RoofWing; g: WingRoofGeometry; u: number; sgn: 1 | -1; h: number } | null = null;
  for (const wing of model.roofWings) {
    const g = wingRoof(model, wing, t);
    const along = wing.ridgeAxis === "x" ? x : y;
    const across = wing.ridgeAxis === "x" ? y : x;
    if (along < g.along[0] || along > g.along[1]) continue;
    const u = Math.abs(across - g.ridgeCoord);
    if (u > g.halfSpan) continue;
    const h = undersideAt(g, u);
    if (!best || h > best.h) best = { wing, g, u, sgn: across >= g.ridgeCoord ? 1 : -1, h };
  }
  return best;
}

function addSkylights(mb: MeshBuilder, model: HouseModel, spec: HouseSpec, t: number, T: number): void {
  for (const s of spec.skylights) {
    const room = model.rooms.find((r) => r.id === s.room);
    if (!room) continue;
    const c = rectCenter(room.bounds);
    const cover = wingCovering(model, c.x, c.y, t);
    if (!cover) continue;
    const f = slopeFrame(cover.g, model.floorLevel, cover.sgn);
    const a = cover.wing.ridgeAxis === "x" ? c.x : c.y;
    const p = f.origin.clone().addScaledVector(f.uAxis, cover.u).addScaledVector(f.rAxis, a * f.aSign).addScaledVector(f.normal, T + 0.03);
    const m = new THREE.Matrix4().makeBasis(f.downslope, f.normal, f.rAxis.clone().normalize()).setPosition(p);
    mb.boxMatrix("windowFrame", m, s.length + 0.12, 0.06, s.width + 0.12);
    const glassM = m.clone().setPosition(p.clone().addScaledVector(f.normal, 0.035));
    mb.boxMatrix("glass", glassM, s.length, 0.01, s.width);
  }
}

/** Exposed collar ties in vaulted rooms, derived from the same roof geometry. */
export function generateCollarTies(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry): THREE.Group {
  const mb = new MeshBuilder(mats);
  const t = spec.building.exteriorWallThickness;
  const floor = model.floorLevel;
  const tieHeight = model.wallHeight + 0.9;
  for (const room of model.rooms.filter((r) => r.ceilingType === "vaulted")) {
    const c = rectCenter(room.bounds);
    const cover = wingCovering(model, c.x, c.y, t);
    if (!cover) continue;
    const g = cover.g;
    const uTie = g.halfSpan - t - (tieHeight - g.wallTop) / g.tan;
    if (uTie <= 0.3) continue;
    const alongX = cover.wing.ridgeAxis === "x";
    const [lo, hi] = alongX ? [room.bounds.x, room.bounds.x + room.bounds.w] : [room.bounds.y, room.bounds.y + room.bounds.h];
    const spacing = 2.4;
    const count = Math.max(1, Math.floor((hi - lo) / spacing));
    for (let i = 0; i < count; i += 1) {
      const a = lo + ((i + 0.5) * (hi - lo)) / count;
      const p0 = alongX ? new THREE.Vector3(a, floor + tieHeight, -(g.ridgeCoord - uTie)) : new THREE.Vector3(g.ridgeCoord - uTie, floor + tieHeight, -a);
      const p1 = alongX ? new THREE.Vector3(a, floor + tieHeight, -(g.ridgeCoord + uTie)) : new THREE.Vector3(g.ridgeCoord + uTie, floor + tieHeight, -a);
      mb.bar("oakDark", p0, p1, 0.2, 0.1);
    }
  }
  return mb.build("collarTies");
}
