import * as THREE from "three";
import type { HouseModel, WallOpening } from "../model/types";
import type { MaterialRegistry } from "../scene/Materials";
import { MeshBuilder } from "./MeshBuilder";
import { wallFrame, type WallFrame } from "./wallFrame";

const FRAME = 0.07;
const FRAME_DEPTH = 0.12;
const MAX_PANE = 1.4;

/** Frame rectangle plus glass, set in the outer third of the wall (Scandinavian practice). */
export function addGlazedPanel(mb: MeshBuilder, f: WallFrame, s0: number, s1: number, h0: number, h1: number, n: number, mullions = true): void {
  const w = s1 - s0;
  const sm = (s0 + s1) / 2;
  const hm = (h0 + h1) / 2;
  const box = (s: number, h: number, sx: number, sy: number) => {
    const p = f.P(s, h, n);
    mb.box("windowFrame", p.x, p.y, p.z, sx, sy, FRAME_DEPTH, f.rotY);
  };
  box(sm, h1 - FRAME / 2, w, FRAME);
  box(sm, h0 + FRAME / 2, w, FRAME);
  box(s0 + FRAME / 2, hm, FRAME, h1 - h0 - 2 * FRAME);
  box(s1 - FRAME / 2, hm, FRAME, h1 - h0 - 2 * FRAME);
  if (mullions && w > MAX_PANE + 0.2) {
    const panes = Math.ceil(w / MAX_PANE);
    for (let i = 1; i < panes; i += 1) box(s0 + (w * i) / panes, hm, FRAME * 0.8, h1 - h0 - 2 * FRAME);
  }
  const g = f.P(sm, hm, n);
  mb.box("glass", g.x, g.y, g.z, w - FRAME, h1 - h0 - FRAME, 0.012, f.rotY);
}

function addWindow(mb: MeshBuilder, f: WallFrame, o: WallOpening): void {
  const s0 = o.center - o.width / 2;
  const s1 = o.center + o.width / 2;
  const t = f.wall.thickness;
  const n = t / 2 - 0.14;
  addGlazedPanel(mb, f, s0, s1, o.sill, o.head, n);
  if (o.sill > 0.05) {
    // Exterior metal sill and interior oak sill.
    const ext = f.P(o.center, o.sill - 0.015, t / 2 - 0.03);
    mb.box("windowFrame", ext.x, ext.y, ext.z, o.width + 0.06, 0.03, 0.18, f.rotY);
    const int = f.P(o.center, o.sill - 0.012, -t / 2 + 0.1);
    mb.box("oak", int.x, int.y, int.z, o.width + 0.08, 0.025, 0.28, f.rotY);
  }
}

export function generateWindows(model: HouseModel, mats: MaterialRegistry): THREE.Group {
  const mb = new MeshBuilder(mats);
  for (const wall of model.walls) {
    if (wall.kind !== "exterior") continue;
    const f = wallFrame(wall, model.floorLevel);
    for (const o of wall.openings) if (o.kind === "window") addWindow(mb, f, o);
  }
  return mb.build("windows");
}
