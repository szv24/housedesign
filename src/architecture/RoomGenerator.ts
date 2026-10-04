import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel } from "../model/types";
import { rectCenter } from "../model/geometry2d";
import type { MatKey, MaterialRegistry } from "../scene/Materials";
import { MeshBuilder } from "./MeshBuilder";

const FLOOR_MATS: Record<string, MatKey> = {
  oak: "oakFloor",
  tile: "tileFloor",
  slate: "slateFloor"
};

/** Floors and flat ceilings per room part. Vaulted rooms show the roof underside instead of a ceiling. */
export function generateRooms(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry): { floors: THREE.Group; ceilings: THREE.Group } {
  const floorMb = new MeshBuilder(mats);
  const ceilMb = new MeshBuilder(mats);
  const pt = spec.building.partitionThickness;
  const floor = model.floorLevel;

  for (const room of model.rooms) {
    const key = FLOOR_MATS[room.floorMaterial] ?? "oakFloor";
    for (const p of room.parts) {
      const c = rectCenter(p);
      // Extend under half the partition so floors meet beneath door thresholds.
      floorMb.box(key, c.x, floor + 0.001, -c.y, p.w + pt, 0.002, p.h + pt, 0, { skip: [0, 1, 3, 4, 5], uOffset: c.x, vOffset: -c.y });
      if (room.ceilingType === "flat") {
        ceilMb.box("ceiling", c.x, floor + room.ceilingHeight + 0.005, -c.y, p.w + pt, 0.01, p.h + pt, 0, { skip: [0, 1, 2, 4, 5] });
      }
    }
  }

  for (const s of spec.skylights) {
    const room = model.rooms.find((r) => r.id === s.room);
    if (!room) continue;
    const c = rectCenter(room.bounds);
    ceilMb.box("skylight", c.x, floor + room.ceilingHeight - 0.004, -c.y, s.width, 0.004, s.length, 0, { skip: [0, 1, 2, 4, 5] });
  }

  const floors = floorMb.build("floors", { castShadow: false });
  const ceilings = ceilMb.build("ceilings");
  return { floors, ceilings };
}
