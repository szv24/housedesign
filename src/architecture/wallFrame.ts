import * as THREE from "three";
import type { Room, Wall } from "../model/types";
import { wallDirection } from "../model/WallResolver";
import { rectContains } from "../model/geometry2d";

/** Local frame of a wall: s along the wall, h above the floor, n across (positive = right-hand side). */
export interface WallFrame {
  wall: Wall;
  rotY: number;
  dir: { x: number; y: number };
  right: { x: number; y: number };
  floor: number;
  P(s: number, h: number, n: number): THREE.Vector3;
  plan(s: number, n: number): { x: number; y: number };
}

export function wallFrame(wall: Wall, floor: number): WallFrame {
  const dir = wallDirection(wall);
  const right = { x: dir.y, y: -dir.x };
  const plan = (s: number, n: number) => ({ x: wall.start.x + dir.x * s + right.x * n, y: wall.start.y + dir.y * s + right.y * n });
  return {
    wall,
    rotY: Math.atan2(dir.y, dir.x),
    dir,
    right,
    floor,
    plan,
    P(s, h, n) {
      const p = plan(s, n);
      return new THREE.Vector3(p.x, floor + h, -p.y);
    }
  };
}

/** +1 if `roomId` lies on the right-hand side of the wall at distance s, -1 if on the left, 0 if neither. */
export function sideOfRoom(f: WallFrame, s: number, rooms: Room[], roomId: string): 1 | -1 | 0 {
  const probe = f.wall.thickness / 2 + 0.3;
  for (const sign of [1, -1] as const) {
    const p = f.plan(s, sign * probe);
    const room = rooms.find((r) => r.parts.some((part) => rectContains(part, p)));
    if (room?.id === roomId) return sign;
  }
  return 0;
}
