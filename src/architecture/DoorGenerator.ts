import * as THREE from "three";
import type { HouseModel, WallOpening } from "../model/types";
import type { MaterialRegistry } from "../scene/Materials";
import { MeshBuilder } from "./MeshBuilder";
import { addGlazedPanel } from "./WindowGenerator";
import { sideOfRoom, wallFrame, type WallFrame } from "./wallFrame";

export interface DoorRecord {
  id: string;
  wallId: string;
  /** Rotating pivot; rotation.y = 0 is closed. */
  pivot: THREE.Object3D;
  openAngle: number;
  open: boolean;
  /** Current animated angle. */
  angle: number;
  hinge: { x: number; y: number };
  width: number;
  /** Plan direction from hinge to the latch side when closed. */
  closedDir: { x: number; y: number };
  /** Plan direction of the leaf when fully open. */
  openDir: { x: number; y: number };
  sideSign: 1 | -1;
}

const ARCHITRAVE = 0.07;

function addCasing(mb: MeshBuilder, f: WallFrame, o: WallOpening, sides: Array<1 | -1>): void {
  const t = f.wall.thickness;
  const s0 = o.center - o.width / 2;
  const s1 = o.center + o.width / 2;
  for (const sign of sides) {
    const n = sign * (t / 2 + 0.01);
    const put = (s: number, h: number, sx: number, sy: number) => {
      const p = f.P(s, h, n);
      mb.box("trim", p.x, p.y, p.z, sx, sy, 0.02, f.rotY);
    };
    put(s0 - ARCHITRAVE / 2, o.head / 2, ARCHITRAVE, o.head);
    put(s1 + ARCHITRAVE / 2, o.head / 2, ARCHITRAVE, o.head);
    if (o.head < f.wall.height - 0.02) put(o.center, o.head + ARCHITRAVE / 2, o.width + 2 * ARCHITRAVE, ARCHITRAVE);
  }
  // Jamb linings
  const lining = (s: number) => {
    const p = f.P(s, o.head / 2, 0);
    mb.box("trim", p.x, p.y, p.z, 0.02, o.head, t, f.rotY);
  };
  lining(s0 + 0.01);
  lining(s1 - 0.01);
  if (o.head < f.wall.height - 0.02) {
    const p = f.P(o.center, o.head - 0.01, 0);
    mb.box("trim", p.x, p.y, p.z, o.width, 0.02, t, f.rotY);
  }
}

function buildLeaf(mats: MaterialRegistry, kind: WallOpening["kind"], width: number, height: number, hingeSign: number): THREE.Group {
  const mb = new MeshBuilder(mats);
  const x = (hingeSign * width) / 2;
  if (kind === "glazed_door") {
    const fr = 0.08;
    mb.box("windowFrame", x, height / 2, 0, width, fr, 0.06);
    mb.box("windowFrame", x, height - fr / 2, 0, width, fr, 0.06);
    mb.box("windowFrame", x, fr / 2, 0, width, fr, 0.06);
    mb.box("windowFrame", hingeSign * fr * 0.5, height / 2, 0, fr, height, 0.06);
    mb.box("windowFrame", hingeSign * (width - fr * 0.5), height / 2, 0, fr, height, 0.06);
    mb.box("glass", x, height / 2, 0, width - fr, height - fr, 0.012);
  } else {
    const mat = kind === "front_door" ? "oakDark" : "whiteLacquer";
    mb.box(mat, x, height / 2, 0, width, height, 0.045);
    if (kind === "front_door") mb.box("glass", hingeSign * width * 0.78, height * 0.55, 0, 0.1, height * 0.7, 0.05);
  }
  // Handle on both faces, at the latch side.
  const hx = hingeSign * (width - 0.08);
  mb.box("metalBlack", hx, 1.0, 0.05, 0.14, 0.02, 0.02);
  mb.box("metalBlack", hx, 1.0, -0.05, 0.14, 0.02, 0.02);
  return mb.build("leaf");
}

function addSlidingDoor(mb: MeshBuilder, f: WallFrame, o: WallOpening): void {
  const t = f.wall.thickness;
  const s0 = o.center - o.width / 2;
  const s1 = o.center + o.width / 2;
  const outerTrack = t / 2 - 0.12;
  const innerTrack = t / 2 - 0.25;
  // Outer frame
  const top = f.P(o.center, o.head - 0.04, t / 2 - 0.18);
  mb.box("windowFrame", top.x, top.y, top.z, o.width, 0.08, 0.26, f.rotY);
  const bot = f.P(o.center, 0.015, t / 2 - 0.18);
  mb.box("windowFrame", bot.x, bot.y, bot.z, o.width, 0.03, 0.26, f.rotY);
  // Fixed panel on the start half; the sliding panel is parked over it, leaving the end half open.
  addGlazedPanel(mb, f, s0, o.center + 0.04, 0.03, o.head - 0.08, outerTrack, false);
  addGlazedPanel(mb, f, s0 + 0.04, o.center + 0.08, 0.03, o.head - 0.08, innerTrack, false);
}

export function generateDoors(model: HouseModel, mats: MaterialRegistry): { group: THREE.Group; doors: DoorRecord[] } {
  const mb = new MeshBuilder(mats);
  const group = new THREE.Group();
  group.name = "doors";
  const doors: DoorRecord[] = [];

  for (const wall of model.walls) {
    const f = wallFrame(wall, model.floorLevel);
    for (const o of wall.openings) {
      if (o.kind === "sliding_door") {
        addSlidingDoor(mb, f, o);
        continue;
      }
      if (o.kind === "cased_opening") {
        addCasing(mb, f, o, [1, -1]);
        continue;
      }
      if (o.kind !== "door" && o.kind !== "front_door" && o.kind !== "glazed_door") continue;

      const exterior = wall.kind === "exterior";
      addCasing(mb, f, o, exterior ? [-1] : [1, -1]);
      if (exterior) {
        // Threshold and, for the front door, a slim metal canopy.
        const th = f.P(o.center, 0.01, 0);
        mb.box("windowFrame", th.x, th.y, th.z, o.width, 0.02, wall.thickness, f.rotY);
        if (o.kind === "front_door") {
          const c = f.P(o.center, o.head + 0.35, wall.thickness / 2 + 0.55);
          mb.box("fascia", c.x, c.y, c.z, o.width + 1.0, 0.06, 1.1, f.rotY);
        }
      }

      const swingRoom = o.swingInto ?? o.rooms[0];
      let sideSign = sideOfRoom(f, o.center, model.rooms, swingRoom);
      if (sideSign === 0) sideSign = -1;
      const hingeSign = o.hinge === "end" ? -1 : 1;
      const hingeS = hingeSign === 1 ? o.center - o.width / 2 : o.center + o.width / 2;
      const leafWidth = o.width - 0.02;
      const height = o.head - 0.01;
      const hingeN = sideSign * (wall.thickness / 2 - 0.03);
      const pivotPos = f.P(hingeS + hingeSign * 0.01, 0, hingeN);

      const base = new THREE.Group();
      base.position.copy(pivotPos);
      base.rotation.y = f.rotY;
      const pivot = new THREE.Group();
      pivot.add(buildLeaf(mats, o.kind, leafWidth, height, hingeSign));
      base.add(pivot);
      group.add(base);

      const openAngle = -sideSign * hingeSign * (Math.PI / 2) * 0.97;
      pivot.rotation.y = openAngle;
      const closedDir = { x: f.dir.x * hingeSign, y: f.dir.y * hingeSign };
      const openDir = { x: f.right.x * sideSign, y: f.right.y * sideSign };
      const hingePlan = f.plan(hingeS, hingeN);
      doors.push({
        id: o.id,
        wallId: wall.id,
        pivot,
        openAngle,
        open: true,
        angle: openAngle,
        hinge: hingePlan,
        width: leafWidth,
        closedDir,
        openDir,
        sideSign
      });
    }
  }
  group.add(mb.build("doorFrames"));
  return { group, doors };
}
