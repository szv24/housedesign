import type { ConnectionSpec, HouseSpec } from "../data/houseSpec";
import type { Polygon2, Room, RoomId, Side, Vec2, Wall, WallOpening } from "./types";
import { offsetOrthogonalPolygon, round } from "./geometry2d";

export interface WallIssue {
  message: string;
}

/** Outer footprint, counter-clockwise. Courtyard is an L; the gable cottage is a rectangle. */
export function buildFootprint(spec: HouseSpec): Polygon2 {
  const b = spec.building;
  if (spec.massing === "gable") {
    return [
      { x: 0, y: 0 },
      { x: b.overallWidth, y: 0 },
      { x: b.overallWidth, y: b.socialWingDepth },
      { x: 0, y: b.socialWingDepth }
    ];
  }
  const pw = b.privateWingWidth;
  const pl = b.privateWingLength;
  const totalL = pl + b.socialWingDepth;
  return [
    { x: 0, y: 0 },
    { x: pw, y: 0 },
    { x: pw, y: pl },
    { x: b.overallWidth, y: pl },
    { x: b.overallWidth, y: totalL },
    { x: 0, y: totalL }
  ];
}

export function wallLength(w: { start: Vec2; end: Vec2 }): number {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

export function wallDirection(w: { start: Vec2; end: Vec2 }): Vec2 {
  const l = wallLength(w) || 1;
  return { x: (w.end.x - w.start.x) / l, y: (w.end.y - w.start.y) / l };
}

/** Point on the wall centerline at a distance along it. */
export function pointAlongWall(w: { start: Vec2; end: Vec2 }, s: number): Vec2 {
  const d = wallDirection(w);
  return { x: w.start.x + d.x * s, y: w.start.y + d.y * s };
}

/** Outward side of an exterior wall running counter-clockwise. */
function exteriorSide(dir: Vec2): Side {
  if (dir.x > 0.5) return "south";
  if (dir.x < -0.5) return "north";
  if (dir.y > 0.5) return "east";
  return "west";
}

function buildExteriorWalls(spec: HouseSpec): Wall[] {
  const b = spec.building;
  const t = b.exteriorWallThickness;
  const center = offsetOrthogonalPolygon(buildFootprint(spec), t / 2);
  const counts: Record<Side, number> = { north: 0, south: 0, east: 0, west: 0 };
  return center.map((a, i) => {
    const c = center[(i + 1) % center.length];
    const dir = wallDirection({ start: a, end: c });
    const side = exteriorSide(dir);
    counts[side] += 1;
    // Each wall extends back over its starting corner, so every corner is filled exactly once.
    return {
      id: `ext_${side}_${counts[side]}`,
      kind: "exterior" as const,
      start: { x: round(a.x - dir.x * t / 2), y: round(a.y - dir.y * t / 2) },
      end: { x: round(c.x - dir.x * t / 2), y: round(c.y - dir.y * t / 2) },
      thickness: t,
      height: b.wallHeight,
      openings: [],
      rooms: []
    };
  });
}

export interface SharedSegment {
  axis: "x" | "y";
  coord: number;
  from: number;
  to: number;
  /** [west|south room, east|north room] */
  rooms: [RoomId, RoomId];
}

function sharedSegments(rooms: Room[]): SharedSegment[] {
  const segs: SharedSegment[] = [];
  const eps = 0.005;
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      for (const a of rooms[i].parts) {
        for (const b of rooms[j].parts) {
          const pairs: Array<[typeof a, typeof b, RoomId, RoomId]> = [
            [a, b, rooms[i].id, rooms[j].id],
            [b, a, rooms[j].id, rooms[i].id]
          ];
          for (const [p, q, pid, qid] of pairs) {
            // p west of q
            if (Math.abs(p.x + p.w - q.x) < eps) {
              const from = Math.max(p.y, q.y);
              const to = Math.min(p.y + p.h, q.y + q.h);
              if (to - from > 0.05) segs.push({ axis: "y", coord: q.x, from, to, rooms: [pid, qid] });
            }
            // p south of q
            if (Math.abs(p.y + p.h - q.y) < eps) {
              const from = Math.max(p.x, q.x);
              const to = Math.min(p.x + p.w, q.x + q.w);
              if (to - from > 0.05) segs.push({ axis: "x", coord: q.y, from, to, rooms: [pid, qid] });
            }
          }
        }
      }
    }
  }
  // Merge collinear touching segments between the same pair of rooms.
  segs.sort((s1, s2) => (s1.axis + s1.coord + s1.rooms.join()).localeCompare(s2.axis + s2.coord + s2.rooms.join()) || s1.from - s2.from);
  const merged: SharedSegment[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.axis === s.axis && Math.abs(last.coord - s.coord) < eps && last.rooms.join() === s.rooms.join() && s.from <= last.to + eps) {
      last.to = Math.max(last.to, s.to);
    } else merged.push({ ...s });
  }
  return merged;
}

function buildPartitions(spec: HouseSpec, rooms: Room[]): Array<Wall & { segment: SharedSegment }> {
  const pt = spec.building.partitionThickness;
  return sharedSegments(rooms).map((s) => {
    const start = s.axis === "y" ? { x: s.coord, y: s.from - pt / 2 } : { x: s.from - pt / 2, y: s.coord };
    const end = s.axis === "y" ? { x: s.coord, y: s.to + pt / 2 } : { x: s.to + pt / 2, y: s.coord };
    return {
      id: `part_${s.rooms[0]}__${s.rooms[1]}_${s.axis === "y" ? "v" : "h"}${round(s.coord, 2)}`,
      kind: "partition" as const,
      start,
      end,
      thickness: pt,
      height: spec.building.wallHeight,
      openings: [],
      rooms: [...s.rooms],
      segment: s
    };
  });
}

function sideMatches(seg: SharedSegment, target: RoomId, side: Side): boolean {
  if (side === "north") return seg.axis === "x" && seg.rooms[0] === target;
  if (side === "south") return seg.axis === "x" && seg.rooms[1] === target;
  if (side === "east") return seg.axis === "y" && seg.rooms[0] === target;
  return seg.axis === "y" && seg.rooms[1] === target;
}

/** The longest shared segment joining the connection's rooms (optionally restricted to one side). */
function pickSegment<T extends { segment: SharedSegment }>(c: ConnectionSpec, partitions: T[]): T | null {
  const candidates = partitions.filter((p) => {
    const set = p.segment.rooms;
    const joins = set.includes(c.rooms[0]) && set.includes(c.rooms[1]);
    return joins && (!c.sideOf || sideMatches(p.segment, c.rooms[1], c.sideOf));
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((best, p) => (p.segment.to - p.segment.from > best.segment.to - best.segment.from ? p : best));
}

/** Shared segments whose wall is removed by an "open" connection. */
export function openSegments(spec: HouseSpec, rooms: Room[]): Array<{ connection: ConnectionSpec; segment: SharedSegment }> {
  const segments = sharedSegments(rooms).map((segment) => ({ segment }));
  const out: Array<{ connection: ConnectionSpec; segment: SharedSegment }> = [];
  for (const c of spec.connections) {
    if (c.kind !== "open") continue;
    const picked = pickSegment(c, segments);
    if (picked) out.push({ connection: c, segment: picked.segment });
  }
  return out;
}

function resolveConnection(
  spec: HouseSpec,
  c: ConnectionSpec,
  partitions: Array<Wall & { segment: SharedSegment }>,
  issues: WallIssue[]
): { wall: Wall; opening: WallOpening } | null {
  const wall = pickSegment(c, partitions);
  if (!wall) {
    issues.push({ message: `Connection ${c.id}: rooms ${c.rooms.join(" / ")} do not share a wall` });
    return null;
  }
  const segLen = wall.segment.to - wall.segment.from;
  const pt = spec.building.partitionThickness;
  const b = spec.building;

  let width = c.width;
  let centerFromSegStart: number;
  if (c.at === "full") {
    width = segLen;
    centerFromSegStart = segLen / 2;
  } else if (c.at === "center") centerFromSegStart = segLen / 2;
  else if (c.at < 0) centerFromSegStart = segLen + c.at;
  else centerFromSegStart = c.at;

  if (width > segLen + 1e-6 || centerFromSegStart - width / 2 < -1e-6 || centerFromSegStart + width / 2 > segLen + 1e-6) {
    issues.push({ message: `Connection ${c.id}: opening of ${width.toFixed(2)} m does not fit the shared wall (${segLen.toFixed(2)} m)` });
    centerFromSegStart = Math.min(Math.max(centerFromSegStart, width / 2), segLen - width / 2);
  }

  const head = c.kind === "door" ? b.interiorDoorHeight : c.kind === "cased_opening" ? b.casedOpeningHeight : wall.height;
  return {
    wall,
    opening: {
      id: c.id,
      kind: c.kind,
      center: round(centerFromSegStart + pt / 2),
      width: round(width),
      sill: 0,
      head,
      rooms: [...c.rooms],
      swingInto: c.swingInto,
      hinge: c.hinge
    }
  };
}

function resolveExteriorOpenings(spec: HouseSpec, rooms: Room[], walls: Wall[], issues: WallIssue[]): void {
  const t = spec.building.exteriorWallThickness;
  for (const o of spec.openings) {
    const room = rooms.find((r) => r.id === o.room);
    if (!room) {
      issues.push({ message: `Opening ${o.id}: unknown room ${o.room}` });
      continue;
    }
    const b = room.bounds;
    const p: Vec2 =
      o.side === "south" ? { x: b.x + o.at, y: b.y } :
      o.side === "north" ? { x: b.x + o.at, y: b.y + b.h } :
      o.side === "west" ? { x: b.x, y: b.y + o.at } :
      { x: b.x + b.w, y: b.y + o.at };
    const wall = walls.find((w) => {
      if (w.kind !== "exterior" || !w.id.startsWith(`ext_${o.side}_`)) return false;
      const horizontal = Math.abs(w.start.y - w.end.y) < 1e-6;
      const offLine = horizontal ? Math.abs(w.start.y - p.y) : Math.abs(w.start.x - p.x);
      const lo = horizontal ? Math.min(w.start.x, w.end.x) : Math.min(w.start.y, w.end.y);
      const hi = horizontal ? Math.max(w.start.x, w.end.x) : Math.max(w.start.y, w.end.y);
      const along = horizontal ? p.x : p.y;
      return offLine <= t / 2 + 0.01 && along >= lo && along <= hi;
    });
    if (!wall) {
      issues.push({ message: `Opening ${o.id}: ${o.room} has no exterior wall on its ${o.side} side at that position` });
      continue;
    }
    const d = { x: p.x - wall.start.x, y: p.y - wall.start.y };
    const dir = wallDirection(wall);
    const center = round(d.x * dir.x + d.y * dir.y);
    wall.openings.push({
      id: o.id,
      kind: o.kind,
      center,
      width: o.width,
      sill: o.sill,
      head: Math.min(o.sill + o.height, wall.height),
      rooms: [o.room]
    });
    if (!wall.rooms.includes(o.room)) wall.rooms.push(o.room);
  }
}

export function resolveWalls(spec: HouseSpec, rooms: Room[]): { walls: Wall[]; issues: WallIssue[] } {
  const issues: WallIssue[] = [];
  const exterior = buildExteriorWalls(spec);
  const partitions = buildPartitions(spec, rooms);
  const removed = new Set<string>();

  for (const c of spec.connections) {
    const resolved = resolveConnection(spec, c, partitions, issues);
    if (!resolved) continue;
    if (c.kind === "open") removed.add(resolved.wall.id);
    else resolved.wall.openings.push(resolved.opening);
  }
  resolveExteriorOpenings(spec, rooms, exterior, issues);

  const walls: Wall[] = [
    ...exterior,
    ...partitions.filter((p) => !removed.has(p.id)).map(({ segment: _segment, ...w }) => w)
  ];

  for (const w of walls) {
    w.openings.sort((a, b) => a.center - b.center);
    const len = wallLength(w);
    for (let i = 0; i < w.openings.length; i += 1) {
      const o = w.openings[i];
      if (o.center - o.width / 2 < w.thickness / 2 - 1e-6 || o.center + o.width / 2 > len - w.thickness / 2 + 1e-6) {
        if (!(o.kind === "cased_opening")) issues.push({ message: `Opening ${o.id} runs past the end of wall ${w.id}` });
      }
      const next = w.openings[i + 1];
      if (next && o.center + o.width / 2 > next.center - next.width / 2 - 0.1) {
        issues.push({ message: `Openings ${o.id} and ${next.id} overlap or leave less than 10 cm of wall on ${w.id}` });
      }
    }
  }
  return { walls, issues };
}
