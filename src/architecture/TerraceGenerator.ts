import * as THREE from "three";
import type { HouseModel, Terrace, Vec2 } from "../model/types";
import type { MaterialRegistry } from "../scene/Materials";
import { MeshBuilder } from "./MeshBuilder";

export const PERGOLA_TOP = 2.62;
const POST = 0.12;

/** Plan positions of pergola posts (shared with the collision system). */
export function pergolaPosts(t: Terrace): Vec2[] {
  if (!t.pergola) return [];
  const p = t.pergola;
  const count = Math.max(2, Math.ceil(p.w / 2.8) + 1);
  return Array.from({ length: count }, (_, i) => ({ x: p.x + POST / 2 + ((p.w - POST) * i) / (count - 1), y: p.y + POST / 2 + 0.05 }));
}

function slatScreen(mb: MeshBuilder, base: number, a: Vec2, b: Vec2, height: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const rot = Math.atan2(dir.y, dir.x);
  const pitch = 0.11;
  const n = Math.floor(len / pitch);
  for (let i = 0; i <= n; i += 1) {
    const s = Math.min(len, i * pitch + 0.03);
    const x = a.x + dir.x * s;
    const y = a.y + dir.y * s;
    mb.box("screenTimber", x, base + height / 2, -y, 0.045, height, 0.07, rot);
  }
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  mb.box("screenTimber", m.x, base + height + 0.02, -m.y, len, 0.04, 0.1, rot);
  for (const p of [a, b]) mb.box("metalBlack", p.x, base + height / 2, -p.y, 0.08, height + 0.06, 0.08);
}

export function generateTerraces(model: HouseModel, mats: MaterialRegistry): THREE.Group {
  const mb = new MeshBuilder(mats);
  for (const t of model.terraces) {
    const r = t.rect;
    const h = t.deckHeight;
    mb.box(["screenTimber", "screenTimber", "deck", "screenTimber", "screenTimber", "screenTimber"], r.x + r.w / 2, h / 2, -(r.y + r.h / 2), r.w, h, r.h, 0, {
      uOffset: r.x + r.w / 2,
      vOffset: -(r.y + r.h / 2)
    });
    for (const s of t.steps) {
      const sh = h / 2;
      mb.box(["screenTimber", "screenTimber", "deck", "screenTimber", "screenTimber", "screenTimber"], s.x + s.w / 2, sh / 2, -(s.y + s.h / 2), s.w, sh, s.h);
    }
    for (const sc of t.privacyScreens) slatScreen(mb, h, sc.start, sc.end, sc.height);

    if (t.pergola) {
      const p = t.pergola;
      const posts = pergolaPosts(t);
      for (const q of posts) mb.box("screenTimber", q.x, (h + PERGOLA_TOP) / 2, -q.y, POST, PERGOLA_TOP - h, POST);
      const beamY = posts[0].y;
      mb.box("screenTimber", p.x + p.w / 2, PERGOLA_TOP - 0.1, -beamY, p.w, 0.2, 0.08);
      const houseEdge = p.y + p.h - model.roofOverhang - 0.05;
      mb.box("screenTimber", p.x + p.w / 2, PERGOLA_TOP - 0.1, -houseEdge, p.w, 0.2, 0.08);
      const rafters = Math.floor(p.w / 0.6);
      for (let i = 0; i <= rafters; i += 1) {
        const x = p.x + 0.05 + ((p.w - 0.1) * i) / rafters;
        mb.box("screenTimber", x, PERGOLA_TOP + 0.04, -(beamY + houseEdge) / 2, 0.05, 0.14, houseEdge - beamY + 0.3);
      }
    }

    if (t.plantingBuffer) {
      const b = t.plantingBuffer;
      mb.box(["screenTimber", "screenTimber", "soil", "soil", "screenTimber", "screenTimber"], b.x + b.w / 2, 0.12, -(b.y + b.h / 2), b.w - 0.1, 0.24, b.h);
    }
  }
  return mb.build("terraces");
}
