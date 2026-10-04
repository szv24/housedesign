import type { HouseSpec, SplitNode } from "../data/houseSpec";
import type { Rect, Room, RoomId } from "./types";
import { boundsOfRects, rectArea, round, unionOutline } from "./geometry2d";

export interface LayoutLeaf {
  room: RoomId;
  rect: Rect;
}

export interface LayoutIssue {
  message: string;
}

/** Interior zones the split trees fill. Courtyard stacks the wings; the gable cottage places them side by side. */
export function wingZones(spec: HouseSpec): { privateWing: Rect; socialWing: Rect } {
  const b = spec.building;
  const t = b.exteriorWallThickness;
  if (spec.massing === "gable") {
    const h = b.socialWingDepth - 2 * t;
    return {
      privateWing: { x: t, y: t, w: b.privateWingWidth - t, h },
      socialWing: { x: b.privateWingWidth, y: t, w: b.overallWidth - b.privateWingWidth - t, h }
    };
  }
  return {
    privateWing: { x: t, y: t, w: b.privateWingWidth - 2 * t, h: b.privateWingLength },
    socialWing: { x: t, y: b.privateWingLength + t, w: b.overallWidth - 2 * t, h: b.socialWingDepth - 2 * t }
  };
}

function solveNode(node: SplitNode, zone: Rect, leaves: LayoutLeaf[], issues: LayoutIssue[]): void {
  const total = node.split === "x" ? zone.w : zone.h;
  const fixed = node.children.reduce((s, c) => s + (c.size === "flex" ? 0 : c.size), 0);
  const flexCount = node.children.filter((c) => c.size === "flex").length;
  const flexSize = flexCount > 0 ? (total - fixed) / flexCount : 0;
  if (flexCount === 0 && Math.abs(total - fixed) > 0.01) {
    issues.push({ message: `Split sizes (${fixed.toFixed(2)} m) do not fill the zone (${total.toFixed(2)} m)` });
  }

  let cursor = node.split === "x" ? zone.x : zone.y;
  node.children.forEach((child, index) => {
    const size = child.size === "flex" ? flexSize : child.size;
    const label = "room" in child ? child.room : "group";
    if (child.min !== undefined && size < child.min - 1e-6) {
      issues.push({ message: `${label} is ${size.toFixed(2)} m, below its minimum of ${child.min} m` });
    }
    if (size <= 0.3) {
      issues.push({ message: `${label} collapsed to ${size.toFixed(2)} m` });
    }
    const last = index === node.children.length - 1;
    const end = node.split === "x" ? zone.x + zone.w : zone.y + zone.h;
    const r: Rect =
      node.split === "x"
        ? { x: round(cursor), y: zone.y, w: round(last ? end - cursor : size), h: zone.h }
        : { x: zone.x, y: round(cursor), w: zone.w, h: round(last ? end - cursor : size) };
    // Advance from the rounded edge so the next room shares a wall instead of leaving a gap.
    cursor = node.split === "x" ? r.x + r.w : r.y + r.h;
    if ("room" in child) leaves.push({ room: child.room, rect: r });
    else solveNode(child.node, r, leaves, issues);
  });
}

export function solveLayout(spec: HouseSpec): { leaves: LayoutLeaf[]; issues: LayoutIssue[] } {
  const zones = wingZones(spec);
  const leaves: LayoutLeaf[] = [];
  const issues: LayoutIssue[] = [];
  solveNode(spec.layout.privateWing, zones.privateWing, leaves, issues);
  solveNode(spec.layout.socialWing, zones.socialWing, leaves, issues);
  return { leaves, issues };
}

/** Merges leaves per room id into Room objects. */
export function solveRooms(spec: HouseSpec): { rooms: Room[]; issues: LayoutIssue[] } {
  const { leaves, issues } = solveLayout(spec);
  const byRoom = new Map<RoomId, Rect[]>();
  for (const leaf of leaves) {
    const list = byRoom.get(leaf.room) ?? [];
    list.push(leaf.rect);
    byRoom.set(leaf.room, list);
  }

  const rooms: Room[] = [];
  for (const roomSpec of spec.rooms) {
    const parts = byRoom.get(roomSpec.id);
    if (!parts) {
      issues.push({ message: `Room ${roomSpec.id} is defined but not placed in the layout` });
      continue;
    }
    const bounds = boundsOfRects(parts);
    rooms.push({
      id: roomSpec.id,
      name: roomSpec.name,
      parts,
      polygon: unionOutline(parts),
      bounds,
      width: bounds.w,
      length: bounds.h,
      area: round(parts.reduce((s, p) => s + rectArea(p), 0), 2),
      ceilingHeight: spec.building.wallHeight,
      ceilingType: roomSpec.ceiling,
      floorMaterial: roomSpec.floorMaterial,
      preferredFurnitureLayout: roomSpec.preferredFurnitureLayout
    });
  }
  for (const id of byRoom.keys()) {
    if (!spec.rooms.some((r) => r.id === id)) issues.push({ message: `Layout uses undefined room ${id}` });
  }
  return { rooms, issues };
}
