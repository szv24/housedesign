import type { HouseSpec, SplitChild, SplitNode } from "./houseSpec";
import type { RoomId } from "../model/types";

/**
 * Parameters exposed in the Design panel. Each reads and writes the house specification, so
 * live edits and LLM edits go through the same source of truth.
 */
export interface DesignParameter {
  id: string;
  label: string;
  group: "Building" | "Rooms" | "Terrace";
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Hidden when this returns false (for example a courtyard-only dimension). */
  applies?(spec: HouseSpec): boolean;
  labelFor?(spec: HouseSpec): string;
  get(spec: HouseSpec): number;
  set(spec: HouseSpec, value: number): void;
}

function findChild(node: SplitNode, room: RoomId): SplitChild | null {
  for (const c of node.children) {
    if ("room" in c && c.room === room && c.size !== "flex") return c;
    if ("node" in c) {
      const hit = findChild(c.node, room);
      if (hit) return hit;
    }
  }
  return null;
}

/** The fixed split-tree size of a room (its depth or width along the split axis). */
function roomSize(room: RoomId, label: string, min: number, max: number): DesignParameter {
  const child = (spec: HouseSpec) => findChild(spec.layout.privateWing, room) ?? findChild(spec.layout.socialWing, room);
  return {
    id: `room:${room}`,
    label,
    group: "Rooms",
    unit: "m",
    min,
    max,
    step: 0.05,
    applies: (spec) => {
      const c = child(spec);
      return !!c && c.size !== "flex";
    },
    get: (spec) => Number(child(spec)?.size ?? 0),
    set: (spec, v) => {
      const c = child(spec);
      if (c) c.size = v;
    }
  };
}

function building(key: keyof HouseSpec["building"], label: string, group: DesignParameter["group"], unit: string, min: number, max: number, step: number): DesignParameter {
  return {
    id: `building:${key}`,
    label,
    group,
    unit,
    min,
    max,
    step,
    get: (spec) => spec.building[key],
    set: (spec, v) => {
      spec.building[key] = v;
    }
  };
}

export const designParameters: DesignParameter[] = [
  {
    ...building("overallWidth", "Living wing length", "Building", "m", 12, 26, 0.1),
    labelFor: (spec) => (spec.massing === "gable" ? "House length" : "Living wing length")
  },
  {
    ...building("socialWingDepth", "Living wing depth", "Building", "m", 6.4, 10, 0.1),
    labelFor: (spec) => (spec.massing === "gable" ? "House depth" : "Living wing depth")
  },
  {
    ...building("privateWingLength", "Bedroom wing length", "Building", "m", 9.6, 14, 0.1),
    applies: (spec) => spec.massing !== "gable"
  },
  building("wallHeight", "Wall height", "Building", "m", 2.5, 3.2, 0.05),
  building("roofPitchDeg", "Roof pitch", "Building", "°", 18, 42, 1),
  building("roofOverhang", "Eave overhang", "Building", "m", 0.2, 1.0, 0.05),
  roomSize("master_bedroom", "Master bedroom depth", 3.4, 5.4),
  roomSize("kids_bedroom_1", "Children's room 1 depth", 2.8, 4.4),
  roomSize("office", "Office width", 2.4, 3.8),
  roomSize("utility", "Utility width", 1.6, 2.6),
  {
    ...building("terraceDepth", "Main terrace depth", "Terrace", "m", 2.0, 6.0, 0.1),
    applies: (spec) => spec.terraces.main.side !== "east"
  },
  {
    ...building("terraceLength", "Main terrace length", "Terrace", "m", 3.0, 12.0, 0.1),
    applies: (spec) => spec.terraces.main.side !== "east"
  },
  {
    ...building("terraceBedroomBuffer", "Planted buffer", "Terrace", "m", 0.6, 2.4, 0.1),
    applies: (spec) => spec.terraces.main.side !== "east"
  }
];
