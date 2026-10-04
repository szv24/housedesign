import type { HouseSpec } from "../data/houseSpec";
import { designRules } from "../data/designRules";
import type { FurniturePlacement, HouseModel, LightFixture, LightKind, OpeningKind, Rect, Room, Side, Vec2 } from "../model/types";
import { rectInside, rectsOverlap, round } from "../model/geometry2d";
import { openSegments, pointAlongWall, wallDirection } from "../model/WallResolver";
import { catalogById, type FurnitureCatalogItem } from "./FurnitureLibrary";
import { OccupancyGrid } from "./OccupancyGrid";
import type { RuleCheck } from "./DesignReport";

export interface SideOpening {
  id: string;
  kind: OpeningKind;
  side: Side;
  /** Absolute plan coordinates along the side. */
  from: number;
  to: number;
  sill: number;
  head: number;
  swingsIn: boolean;
}

export interface RoomContext {
  id: string;
  name: string;
  room: Room | null;
  /** Usable rectangle (single-part rooms and terraces). */
  rect: Rect;
  /** Absolute height of the floor the furniture stands on. */
  base: number;
  /** Absolute ceiling height at the room center (flat or vaulted). */
  ceiling: number;
  openings: SideOpening[];
  keepClear: Array<{ rect: Rect; reason: string }>;
  placed: FurniturePlacement[];
  lights: LightFixture[];
  checks: RuleCheck[];
  model: HouseModel;
  spec: HouseSpec;
}

export const R = designRules;
const WALKABLE: OpeningKind[] = ["door", "front_door", "glazed_door", "sliding_door", "cased_opening", "open"];

// ------------------------------------------------------------------ geometry helpers

/** Item front direction in plan for a rotation (0 = facing south). */
export function frontDir(rot: number): Vec2 {
  return { x: Math.sin(rot), y: -Math.cos(rot) };
}

/** Item width axis in plan. */
export function widthDir(rot: number): Vec2 {
  return { x: Math.cos(rot), y: Math.sin(rot) };
}

/** Rotation that makes an item backed against `side` face into the room. */
export function rotationFacingAwayFrom(side: Side): number {
  return { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 }[side];
}

/** Axis-aligned plan rect of a local box: lw = along width, lf = along front. */
export function localRect(cx: number, cy: number, rot: number, lw0: number, lw1: number, lf0: number, lf1: number): Rect {
  const W = widthDir(rot);
  const F = frontDir(rot);
  const pts = [
    [lw0, lf0],
    [lw1, lf0],
    [lw1, lf1],
    [lw0, lf1]
  ].map(([a, b]) => ({ x: cx + W.x * a + F.x * b, y: cy + W.y * a + F.y * b }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x: round(x), y: round(y), w: round(Math.max(...xs) - x), h: round(Math.max(...ys) - y) };
}

export function sideGeometry(rect: Rect, side: Side) {
  switch (side) {
    case "north":
      return { lo: rect.x, hi: rect.x + rect.w, wall: rect.y + rect.h, inward: -1, alongX: true };
    case "south":
      return { lo: rect.x, hi: rect.x + rect.w, wall: rect.y, inward: 1, alongX: true };
    case "east":
      return { lo: rect.y, hi: rect.y + rect.h, wall: rect.x + rect.w, inward: -1, alongX: false };
    default:
      return { lo: rect.y, hi: rect.y + rect.h, wall: rect.x, inward: 1, alongX: false };
  }
}

/** Rectangle inside the room along a side: [from, to] along it, `depth` into the room. */
export function zoneAlongSide(rect: Rect, side: Side, from: number, to: number, depth: number): Rect {
  const g = sideGeometry(rect, side);
  const near = g.wall;
  const far = g.wall + g.inward * depth;
  const a = Math.min(near, far);
  const b = Math.max(near, far);
  return g.alongX ? { x: from, y: a, w: to - from, h: b - a } : { x: a, y: from, w: b - a, h: to - from };
}

export function clearanceZones(p: FurniturePlacement, item: FurnitureCatalogItem): Rect[] {
  const c = item.clearance;
  if (!c) return [];
  const w = p.width;
  const d = p.depth;
  const zones: Rect[] = [];
  if (c.front) zones.push(localRect(p.x, p.y, p.rotation, -w / 2, w / 2, d / 2, d / 2 + c.front));
  if (c.back) zones.push(localRect(p.x, p.y, p.rotation, -w / 2, w / 2, -d / 2 - c.back, -d / 2));
  // Side zones skip the head area (nightstands) and run past the front to keep the corners walkable.
  const sideFrom = Math.min(-d / 2 + 0.45, 0);
  const sideTo = d / 2 + (c.front ?? 0);
  if (c.left) zones.push(localRect(p.x, p.y, p.rotation, -w / 2 - c.left, -w / 2, sideFrom, sideTo));
  if (c.right) zones.push(localRect(p.x, p.y, p.rotation, w / 2, w / 2 + c.right, sideFrom, sideTo));
  return zones;
}

export function accessPoints(p: FurniturePlacement, item: FurnitureCatalogItem): Vec2[] {
  const F = frontDir(p.rotation);
  const W = widthDir(p.rotation);
  const off = 0.3;
  return (item.access ?? []).map((a) => {
    if (a === "front") return { x: p.x + F.x * (p.depth / 2 + off), y: p.y + F.y * (p.depth / 2 + off) };
    const s = a === "right" ? 1 : -1;
    const fwd = p.depth * 0.15;
    return { x: p.x + W.x * s * (p.width / 2 + off) + F.x * fwd, y: p.y + W.y * s * (p.width / 2 + off) + F.y * fwd };
  });
}

// ------------------------------------------------------------------ context

function sideOfRectForWall(rect: Rect, wallStart: Vec2, wallEnd: Vec2, probe: Vec2): Side | null {
  const horizontal = Math.abs(wallStart.y - wallEnd.y) < 1e-6;
  if (horizontal) {
    if (probe.y > wallStart.y && Math.abs(rect.y - wallStart.y) < 0.35) return "south";
    if (probe.y < wallStart.y && Math.abs(rect.y + rect.h - wallStart.y) < 0.35) return "north";
  } else {
    if (probe.x > wallStart.x && Math.abs(rect.x - wallStart.x) < 0.35) return "west";
    if (probe.x < wallStart.x && Math.abs(rect.x + rect.w - wallStart.x) < 0.35) return "east";
  }
  return null;
}

/** Largest axis-aligned rectangle fully covered by the union of the parts. */
function largestCoveredRect(parts: Rect[]): Rect {
  if (parts.length === 1) return parts[0];
  const axis = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) if (out.length === 0 || v - out[out.length - 1] > 0.005) out.push(v);
    return out;
  };
  const xs = axis(parts.flatMap((p) => [p.x, p.x + p.w]));
  const ys = axis(parts.flatMap((p) => [p.y, p.y + p.h]));
  const covered = (x0: number, x1: number, y0: number, y1: number) => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return parts.some((p) => cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h);
  };
  let best = parts.reduce((b, p) => (p.w * p.h > b.w * b.h ? p : b));
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      for (let k = 0; k < ys.length - 1; k += 1) {
        for (let l = k + 1; l < ys.length; l += 1) {
          const area = (xs[j] - xs[i]) * (ys[l] - ys[k]);
          if (area <= best.w * best.h + 1e-6) continue;
          let ok = true;
          for (let a = i; a < j && ok; a += 1) for (let b = k; b < l && ok; b += 1) ok = covered(xs[a], xs[a + 1], ys[b], ys[b + 1]);
          if (ok) best = { x: xs[i], y: ys[k], w: round(xs[j] - xs[i]), h: round(ys[l] - ys[k]) };
        }
      }
    }
  }
  return best;
}

/** Runs along a side of `rect` where the room continues into another of its own parts. */
function internalEdges(room: Room, rect: Rect): Array<{ side: Side; from: number; to: number }> {
  if (room.parts.length < 2) return [];
  const out: Array<{ side: Side; from: number; to: number }> = [];
  const step = 0.05;
  for (const side of ["north", "south", "east", "west"] as Side[]) {
    const g = sideGeometry(rect, side);
    const perp = g.wall - g.inward * 0.02;
    let start: number | null = null;
    for (let s = g.lo; s <= g.hi + step / 2 + 1e-9; s += step) {
      const at = Math.min(s, g.hi);
      const p = g.alongX ? { x: at, y: perp } : { x: perp, y: at };
      const inside = at < g.hi && room.parts.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
      if (inside && start === null) start = at;
      if (!inside && start !== null) {
        if (at - start > 0.3) out.push({ side, from: round(start), to: round(at) });
        start = null;
      }
    }
  }
  return out;
}

export function createRoomContext(model: HouseModel, spec: HouseSpec, room: Room, ceiling: number): RoomContext {
  // Multi-part rooms (an L around a vestibule) keep furniture in the largest rectangle they fully cover.
  const rect = largestCoveredRect(room.parts);
  const openings: SideOpening[] = [];
  for (const wall of model.walls) {
    for (const o of wall.openings) {
      if (!o.rooms.includes(room.id)) continue;
      const dir = wallDirection(wall);
      const c = pointAlongWall(wall, o.center);
      const probeN = wall.thickness / 2 + 0.1;
      const left = { x: c.x - dir.y * probeN, y: c.y + dir.x * probeN };
      const right = { x: c.x + dir.y * probeN, y: c.y - dir.x * probeN };
      const inRoom = (p: Vec2) => room.parts.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      const probe = inRoom(left) ? left : inRoom(right) ? right : null;
      if (!probe) continue;
      const side = sideOfRectForWall(rect, wall.start, wall.end, probe);
      if (!side) continue;
      const a = pointAlongWall(wall, o.center - o.width / 2);
      const b = pointAlongWall(wall, o.center + o.width / 2);
      const along = side === "north" || side === "south" ? [a.x, b.x] : [a.y, b.y];
      // Openings on another part of the room do not touch this rectangle's edge.
      const g = sideGeometry(rect, side);
      if (Math.max(...along) <= g.lo + 0.01 || Math.min(...along) >= g.hi - 0.01) continue;
      openings.push({
        id: o.id,
        kind: o.kind,
        side,
        from: Math.min(...along),
        to: Math.max(...along),
        sill: o.sill,
        head: o.head,
        swingsIn: o.swingInto === room.id
      });
    }
  }
  // Removed walls ("open" connections) behave like full-width openings along the removed segment.
  for (const { connection: c, segment: s } of openSegments(spec, model.rooms)) {
    if (!c.rooms.includes(room.id)) continue;
    for (const side of ["north", "south", "east", "west"] as Side[]) {
      const g = sideGeometry(rect, side);
      if (g.alongX !== (s.axis === "x") || Math.abs(g.wall - s.coord) > 0.01) continue;
      const from = Math.max(g.lo, s.from);
      const to = Math.min(g.hi, s.to);
      if (to - from > 0.3) openings.push({ id: c.id, kind: "open", side, from, to, sill: 0, head: model.wallHeight, swingsIn: false });
    }
  }

  const keepClear = openings
    .filter((o) => WALKABLE.includes(o.kind))
    .map((o) => {
      const width = o.to - o.from;
      const depth = o.swingsIn ? Math.max(width + 0.05, R.clearance.doorApproach) : R.clearance.doorApproach;
      return { rect: zoneAlongSide(rect, o.side, o.from - 0.05, o.to + 0.05, depth), reason: `${o.id} approach` };
    });

  // Edges where the room continues into its other parts: not walls, but no approach zone either.
  for (const e of internalEdges(room, rect)) {
    openings.push({ id: `${room.id}:continues`, kind: "open", side: e.side, from: e.from, to: e.to, sill: 0, head: model.wallHeight, swingsIn: false });
  }

  return {
    id: room.id,
    name: room.name,
    room,
    rect,
    base: model.floorLevel,
    ceiling,
    openings,
    keepClear,
    placed: [],
    lights: [],
    checks: [],
    model,
    spec
  };
}

// ------------------------------------------------------------------ placement

export interface PlaceOptions {
  elevation?: number;
  /** Placement ids whose clearance zones this item may occupy (e.g. chairs inside a table's pull-back zone). */
  allowIn?: string[];
  rationale?: string;
  /** Skip the tall-furniture-in-front-of-windows rule (e.g. kitchen tall units on a window-free wall are already filtered). */
  ignoreWindows?: boolean;
  /** Skip door keep-clear checks (used for flat items). */
  ignoreKeepClear?: boolean;
  /** Extra height override (e.g. stove flue length). */
  height?: number;
  idSuffix?: string;
}

export function makePlacement(ctx: RoomContext, catalogId: string, x: number, y: number, rot: number, opts: PlaceOptions = {}): FurniturePlacement | null {
  const item = catalogById(catalogId);
  if (!item) return null;
  const footprint = localRect(x, y, rot, -item.width / 2, item.width / 2, -item.depth / 2, item.depth / 2);
  return {
    id: `${ctx.id}:${catalogId}${opts.idSuffix ? `:${opts.idSuffix}` : ""}:${ctx.placed.length}`,
    catalogId,
    roomId: ctx.id,
    x: round(x),
    y: round(y),
    elevation: ctx.base + (opts.elevation ?? 0),
    rotation: rot,
    footprint,
    width: item.width,
    depth: item.depth,
    height: opts.height ?? item.height,
    blocksMovement: item.blocksMovement,
    rationale: opts.rationale ? [opts.rationale] : []
  };
}

export function windowZones(ctx: RoomContext): Rect[] {
  return ctx.openings
    .filter((o) => o.kind === "window" || o.kind === "sliding_door" || o.kind === "glazed_door")
    .map((o) => zoneAlongSide(ctx.rect, o.side, o.from, o.to, R.window.frontZoneDepth));
}

/** Validates a placement against every rule. Returns null when valid, otherwise the reason. */
export function violation(ctx: RoomContext, p: FurniturePlacement, opts: PlaceOptions = {}): string | null {
  const item = catalogById(p.catalogId)!;
  if (item.mounted) return null;
  if (!rectInside(p.footprint, ctx.rect)) return "outside the room";
  if (item.flat) return null;
  const allow = new Set(opts.allowIn ?? []);

  if (!opts.ignoreKeepClear) for (const k of ctx.keepClear) if (rectsOverlap(p.footprint, k.rect)) return `blocks ${k.reason}`;

  if (!opts.ignoreWindows && p.height > R.window.maxTallFurnitureInFront) {
    for (const z of windowZones(ctx)) if (rectsOverlap(p.footprint, z)) return "tall furniture in front of a window";
  }

  for (const q of ctx.placed) {
    const qi = catalogById(q.catalogId)!;
    if (qi.flat || qi.mounted) continue;
    if (rectsOverlap(p.footprint, q.footprint)) return `overlaps ${qi.name.toLowerCase()}`;
    if (!allow.has(q.id)) for (const z of clearanceZones(q, qi)) if (rectsOverlap(p.footprint, z)) return `inside the clearance of ${qi.name.toLowerCase()}`;
  }

  for (const z of clearanceZones(p, item)) {
    if (!rectInside(z, ctx.rect, 0.02)) return "required clearance leaves the room";
    for (const q of ctx.placed) {
      const qi = catalogById(q.catalogId)!;
      if (qi.flat || qi.mounted || !qi.blocksMovement) continue;
      if (allow.has(q.id)) continue;
      if (rectsOverlap(z, q.footprint)) return `clearance blocked by ${qi.name.toLowerCase()}`;
    }
  }
  return null;
}

export function commit(ctx: RoomContext, p: FurniturePlacement): FurniturePlacement {
  ctx.placed.push(p);
  return p;
}

/** Places at an exact position if valid. */
export function tryPlace(ctx: RoomContext, catalogId: string, x: number, y: number, rot: number, opts: PlaceOptions = {}): FurniturePlacement | null {
  const p = makePlacement(ctx, catalogId, x, y, rot, opts);
  if (!p) return null;
  return violation(ctx, p, opts) ? null : commit(ctx, p);
}

export interface WallPlaceOptions extends PlaceOptions {
  /** Preferred center along the side: absolute coordinate, or relative keyword. */
  at?: number | "center" | "start" | "end";
  /** Gap between wall and item back. */
  gap?: number;
  /** Restrict the search to this absolute along-range. */
  range?: [number, number];
  step?: number;
}

/** Backs an item against a side and searches along it (nearest to the preferred position first). */
export function placeAgainst(ctx: RoomContext, catalogId: string, side: Side, opts: WallPlaceOptions = {}): FurniturePlacement | null {
  const item = catalogById(catalogId);
  if (!item) return null;
  const g = sideGeometry(ctx.rect, side);
  const rot = rotationFacingAwayFrom(side);
  const half = item.width / 2;
  const lo = Math.max(g.lo, opts.range?.[0] ?? g.lo) + half;
  const hi = Math.min(g.hi, opts.range?.[1] ?? g.hi) - half;
  if (hi < lo - 1e-6) return null;
  const pref = opts.at === undefined || opts.at === "center" ? (lo + hi) / 2 : opts.at === "start" ? lo : opts.at === "end" ? hi : opts.at;
  const step = opts.step ?? 0.05;
  const candidates: number[] = [];
  for (let s = lo; s <= hi + 1e-6; s += step) candidates.push(s);
  candidates.sort((a, b) => Math.abs(a - pref) - Math.abs(b - pref) || a - b);
  const depthOffset = (opts.gap ?? 0.01) + item.depth / 2;
  const perp = g.wall + g.inward * depthOffset;
  let lastReason = "no space along the wall";
  for (const s of candidates) {
    const x = g.alongX ? s : perp;
    const y = g.alongX ? perp : s;
    const p = makePlacement(ctx, catalogId, x, y, rot, opts);
    if (!p) return null;
    const v = violation(ctx, p, opts);
    if (!v) return commit(ctx, p);
    lastReason = v;
  }
  ctx.checks.push({ room: ctx.id, rule: `place ${item.name}`, ok: false, detail: `not placed against the ${side} wall: ${lastReason}` });
  return null;
}

/** Sides of the room with no opening at all. */
export function solidSides(ctx: RoomContext): Side[] {
  return (["north", "south", "east", "west"] as Side[]).filter((s) => !ctx.openings.some((o) => o.side === s));
}

export function sidesWithWindows(ctx: RoomContext): Side[] {
  return [...new Set(ctx.openings.filter((o) => o.kind === "window" || o.kind === "sliding_door" || o.kind === "glazed_door").map((o) => o.side))];
}

export function sideLength(ctx: RoomContext, side: Side): number {
  const g = sideGeometry(ctx.rect, side);
  return g.hi - g.lo;
}

export function opposite(side: Side): Side {
  return { north: "south", south: "north", east: "west", west: "east" }[side] as Side;
}

export function check(ctx: RoomContext, rule: string, ok: boolean, detail: string): void {
  ctx.checks.push({ room: ctx.id, rule, ok, detail });
}

export function addLight(ctx: RoomContext, kind: LightKind, x: number, y: number, z: number, intensity: number, color = 0xffc58f, extra: Partial<LightFixture> = {}): void {
  ctx.lights.push({ id: `${ctx.id}:light:${ctx.lights.length}`, roomId: ctx.id, kind, x, y, z, intensity, color, ...extra });
}

/** Hangs a pendant (visual + light) so its shade bottom sits `dropTo` above the floor. */
export function hangPendant(
  ctx: RoomContext,
  catalogId: "pendant" | "pendant_small",
  x: number,
  y: number,
  dropTo: number,
  intensity: number,
  opts: { ceiling?: number; light?: boolean } = {}
): void {
  const ceiling = opts.ceiling ?? ctx.ceiling;
  const cord = Math.max(0.1, ceiling - (ctx.base + dropTo) - 0.2);
  const p = makePlacement(ctx, catalogId, x, y, 0, { elevation: dropTo, height: cord, rationale: "pendant hung above the activity it lights" });
  if (p) commit(ctx, p);
  if (opts.light !== false) addLight(ctx, "pendant", x, y, ctx.base + dropTo - 0.1, intensity);
}

/**
 * String of fairy lights along a polyline (absolute heights). The light source representing the
 * string sits `away` from it (plan offset), so the wall behind it is not hit point-blank.
 */
export function stringLights(ctx: RoomContext, points: Array<{ x: number; y: number; z: number }>, bulbs: number, intensity: number, away: Vec2 = { x: 0, y: 0 }): void {
  const mid = points[Math.floor(points.length / 2)];
  addLight(ctx, "string", mid.x + away.x, mid.y + away.y, mid.z - 0.25, intensity, 0xffc27a, { path: points, bulbs });
}

export function ceilingLight(ctx: RoomContext, x: number, y: number, intensity: number): void {
  const p = makePlacement(ctx, "ceiling_light", x, y, 0, { elevation: ctx.ceiling - ctx.base });
  if (p) commit(ctx, p);
  addLight(ctx, "ceiling", x, y, ctx.ceiling - 0.45, intensity);
}

// ------------------------------------------------------------------ reachability

interface AccessResult {
  entryBlocked: boolean;
  doorsCutOff: number;
  unreachable: string[];
}

function computeAccess(ctx: RoomContext): AccessResult | null {
  const grid = new OccupancyGrid(ctx.rect, R.grid.cell);
  for (const p of ctx.placed) {
    const item = catalogById(p.catalogId)!;
    if (!p.blocksMovement || item.flat || item.mounted || item.movable) continue;
    grid.blockRect({ x: p.footprint.x - R.body.radius, y: p.footprint.y - R.body.radius, w: p.footprint.w + 2 * R.body.radius, h: p.footprint.h + 2 * R.body.radius });
  }
  const entries = ctx.openings
    .filter((o) => WALKABLE.includes(o.kind))
    .map((o) => {
      const g = sideGeometry(ctx.rect, o.side);
      const s = (o.from + o.to) / 2;
      const d = g.wall + g.inward * 0.35;
      return g.alongX ? { x: s, y: d } : { x: d, y: s };
    });
  if (entries.length === 0) return null;
  const seen = grid.flood(entries[0]);
  if (!seen) return { entryBlocked: true, doorsCutOff: 0, unreachable: [] };
  // An access point counts as reached if a free cell within reach of it is connected.
  const near = (a: Vec2) => {
    const r = R.access.tolerance;
    for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) if (grid.reached(seen, { x: a.x + dx, y: a.y + dy })) return true;
    return false;
  };
  const unreachable: string[] = [];
  for (const p of ctx.placed) {
    const item = catalogById(p.catalogId)!;
    const pts = accessPoints(p, item);
    if (pts.length === 0) continue;
    const ok = item.accessAny ? pts.some(near) : pts.every(near);
    if (!ok) unreachable.push(item.name.toLowerCase());
  }
  return { entryBlocked: false, doorsCutOff: entries.slice(1).filter((e) => !grid.reached(seen, e)).length, unreachable };
}

/** True when every door connects and every access point is reachable. */
export function accessOk(ctx: RoomContext): boolean {
  const a = computeAccess(ctx);
  return !a || (!a.entryBlocked && a.doorsCutOff === 0 && a.unreachable.length === 0);
}

/**
 * Tries optional placements in order; keeps the first that passes all placement rules AND keeps
 * the room fully accessible. Items that would make the layout dysfunctional are rejected.
 */
export function placeOptional(ctx: RoomContext, attempts: Array<() => FurniturePlacement | null>): FurniturePlacement | null {
  for (const attempt of attempts) {
    const checksBefore = ctx.checks.length;
    const p = attempt();
    ctx.checks.length = checksBefore;
    if (!p) continue;
    if (accessOk(ctx)) return p;
    ctx.placed.splice(ctx.placed.indexOf(p), 1);
  }
  return null;
}

/** Like placeOptional, but falls back to the first rule-valid position if none keeps full access. */
export function placeRequired(ctx: RoomContext, attempts: Array<() => FurniturePlacement | null>): FurniturePlacement | null {
  const best = placeOptional(ctx, attempts);
  if (best) return best;
  for (const attempt of attempts) {
    const before = ctx.checks.length;
    const p = attempt();
    ctx.checks.length = before;
    if (p) return p;
  }
  return null;
}

export function checkReachability(ctx: RoomContext): void {
  const a = computeAccess(ctx);
  if (!a) return;
  if (a.entryBlocked) {
    check(ctx, "door approach", false, "the entry point is blocked by furniture");
    return;
  }
  check(ctx, "door-to-door circulation", a.doorsCutOff === 0, a.doorsCutOff === 0 ? "all doors connect" : `${a.doorsCutOff} door(s) cut off by furniture`);
  check(ctx, "access to furniture", a.unreachable.length === 0, a.unreachable.length === 0 ? "every bed side, front and seat can be reached" : `cannot reach: ${a.unreachable.join(", ")}`);
}
