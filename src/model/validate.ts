import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel, RoomId } from "./types";
import { pointAlongWall } from "./WallResolver";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
}

const WALKABLE_KINDS = new Set(["door", "cased_opening", "open", "front_door", "glazed_door", "sliding_door"]);

/** Rooms reachable from the entrance through interior doors, openings and removed (open) walls. */
export function reachableRooms(model: HouseModel, spec: HouseSpec): Set<RoomId> {
  const adj = new Map<RoomId, Set<RoomId>>();
  const link = (a: RoomId, b: RoomId) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const w of model.walls) {
    for (const o of w.openings) {
      if (w.kind === "partition" && WALKABLE_KINDS.has(o.kind) && o.rooms.length === 2) link(o.rooms[0], o.rooms[1]);
    }
  }
  for (const c of spec.connections) if (c.kind === "open") link(c.rooms[0], c.rooms[1]);

  const seen = new Set<RoomId>(["entrance"]);
  const queue: RoomId[] = ["entrance"];
  while (queue.length) {
    const r = queue.shift()!;
    for (const n of adj.get(r) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

export function validateHouseModel(model: HouseModel, spec: HouseSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const b = spec.building;

  for (const room of model.rooms) {
    const rs = spec.rooms.find((r) => r.id === room.id);
    if (!rs) continue;
    if (room.area < rs.minArea) issues.push({ severity: "error", message: `${room.name}: ${room.area.toFixed(1)} m² is below the minimum ${rs.minArea} m²` });
    if (room.area > rs.maxArea) issues.push({ severity: "warning", message: `${room.name}: ${room.area.toFixed(1)} m² is above the target ${rs.maxArea} m²` });
  }

  const reach = reachableRooms(model, spec);
  for (const room of model.rooms) {
    if (!reach.has(room.id)) issues.push({ severity: "error", message: `${room.name} cannot be reached from the entrance` });
  }

  const front = model.walls.some((w) => w.openings.some((o) => o.kind === "front_door"));
  if (!front) issues.push({ severity: "error", message: "The house has no front door" });

  if (spec.massing !== "gable" && b.privateWingWidth > b.socialWingDepth) {
    issues.push({ severity: "error", message: "The private wing is wider than the social wing; the roof valley generator requires the secondary span to be smaller" });
  }
  if (spec.frontGable && spec.frontGable.width > b.socialWingDepth - 0.4) {
    issues.push({ severity: "warning", message: "The garden cross-gable is wider than the main roof can valley against" });
  }

  const area = model.meta.interiorArea;
  const [lo, hi] = spec.areaRange ?? (spec.massing === "gable" ? [140, 190] : [130, 170]);
  if (area < lo || area > hi) issues.push({ severity: "warning", message: `Net interior area ${area.toFixed(1)} m² is outside the ${lo}–${hi} m² target` });

  // Bedroom windows should not open directly onto the main terrace.
  const terrace = model.terraces.find((t) => t.id === "main_terrace");
  if (terrace) {
    for (const w of model.walls) {
      for (const o of w.openings) {
        if (o.kind !== "window" || !o.rooms.some((r) => r.startsWith("kids") || r === "master_bedroom")) continue;
        const p = pointAlongWall(w, o.center);
        const dx = Math.max(terrace.rect.x - p.x, 0, p.x - (terrace.rect.x + terrace.rect.w));
        const dy = Math.max(terrace.rect.y - p.y, 0, p.y - (terrace.rect.y + terrace.rect.h));
        if (Math.hypot(dx, dy) < b.terraceBedroomBuffer - 0.01) {
          issues.push({ severity: "warning", message: `Bedroom window ${o.id} is closer than ${b.terraceBedroomBuffer} m to the main terrace` });
        }
      }
    }
  }

  for (const t of model.terraces) {
    if (t.id === "main_terrace" && spec.terraces.main.side !== "east" && (t.area < 30 || t.area > 48)) issues.push({ severity: "warning", message: `Main terrace is ${t.area.toFixed(1)} m² (target 30–45 m²)` });
    if (t.id === "main_terrace" && spec.terraces.main.side === "east" && Math.abs(t.area - 15) > 0.05) issues.push({ severity: "warning", message: `Terrace is ${t.area.toFixed(2)} m² (the plan is 15.00 m²)` });
    if (t.id === "master_private_terrace" && (t.area < 5 || t.area > 9)) issues.push({ severity: "warning", message: `Private terrace is ${t.area.toFixed(1)} m² (target 5–8 m²)` });
  }
  return issues;
}
