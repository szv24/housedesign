import type { HouseModel, Rect, Vec2 } from "../model/types";
import { pointAlongWall, wallLength } from "../model/WallResolver";
import { catalogById } from "../interiors/FurnitureLibrary";
import { pergolaPosts } from "../architecture/TerraceGenerator";
import type { DoorRecord } from "../architecture/DoorGenerator";
import type { EnvironmentResult } from "../scene/Environment";

const PASSABLE = new Set(["door", "front_door", "glazed_door", "cased_opening", "open"]);

/** Plan-space collision: the player is a circle; obstacles are axis-aligned rects and circles. */
export class CollisionSystem {
  readonly radius = 0.22;
  private rects: Rect[] = [];
  private circles: Array<{ x: number; y: number; r: number }> = [];
  private doorRects = new Map<string, Rect>();
  private bounds: Rect;

  constructor(model: HouseModel, env: EnvironmentResult, private doors: DoorRecord[]) {
    this.bounds = env.plot;
    for (const wall of model.walls) {
      const L = wallLength(wall);
      const gaps: Array<[number, number]> = [];
      for (const o of wall.openings) {
        if (PASSABLE.has(o.kind)) gaps.push([o.center - o.width / 2, o.center + o.width / 2]);
        // Sliding doors: the fixed panel covers the start half; the end half is open.
        if (o.kind === "sliding_door") gaps.push([o.center + 0.1, o.center + o.width / 2]);
      }
      gaps.sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      const solid: Array<[number, number]> = [];
      for (const [a, b] of gaps) {
        if (a > cursor) solid.push([cursor, a]);
        cursor = Math.max(cursor, b);
      }
      if (cursor < L) solid.push([cursor, L]);
      for (const [a, b] of solid) this.rects.push(segmentRect(pointAlongWall(wall, a), pointAlongWall(wall, b), wall.thickness));
    }

    for (const p of model.furniture) {
      const item = catalogById(p.catalogId);
      if (!item || !p.blocksMovement || item.flat || item.mounted) continue;
      this.rects.push(p.footprint);
    }

    for (const t of model.terraces) {
      for (const post of pergolaPosts(t)) this.circles.push({ x: post.x, y: post.y, r: 0.09 });
      for (const s of t.privacyScreens) this.rects.push(segmentRect(s.start, s.end, 0.1));
    }
    this.rects.push(...env.rects);
    this.circles.push(...env.circles);
    this.updateDoors();
  }

  /** Door leaves block where they stand: open leaves along the wall face, closed leaves fill the opening. */
  updateDoors(): void {
    this.doorRects.clear();
    for (const d of this.doors) {
      const dir = d.open ? d.openDir : d.closedDir;
      const end = { x: d.hinge.x + dir.x * d.width, y: d.hinge.y + dir.y * d.width };
      this.doorRects.set(d.id, segmentRect(d.hinge, end, 0.06));
    }
  }

  private nearby(p: Vec2, reach: number): Rect[] {
    const out: Rect[] = [];
    for (const r of this.rects) if (p.x > r.x - reach && p.x < r.x + r.w + reach && p.y > r.y - reach && p.y < r.y + r.h + reach) out.push(r);
    for (const r of this.doorRects.values()) out.push(r);
    return out;
  }

  /** Moves from `from` by `delta`, sliding along obstacles. Returns the resolved position. */
  move(from: Vec2, delta: Vec2): Vec2 {
    const len = Math.hypot(delta.x, delta.y);
    const steps = Math.max(1, Math.ceil(len / 0.05));
    let p = { ...from };
    const candidates = this.nearby(from, len + 1);
    for (let s = 0; s < steps; s += 1) {
      p = { x: p.x + delta.x / steps, y: p.y + delta.y / steps };
      for (let iter = 0; iter < 3; iter += 1) {
        for (const r of candidates) p = pushOutRect(p, r, this.radius);
        for (const c of this.circles) p = pushOutCircle(p, c, this.radius);
      }
      const b = this.bounds;
      p.x = Math.min(Math.max(p.x, b.x + 1.2), b.x + b.w - 1.2);
      p.y = Math.min(Math.max(p.y, b.y + 1.2), b.y + b.h + 8);
    }
    return p;
  }

  /** True if the player circle would overlap something at p. */
  blocked(p: Vec2): boolean {
    for (const r of [...this.rects, ...this.doorRects.values()]) {
      const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
      const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
      if (Math.hypot(p.x - cx, p.y - cy) < this.radius) return true;
    }
    return this.circles.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < this.radius + c.r);
  }

  /** Nearest free spot to p (spiral search), used for teleports and after regeneration. */
  nearestFree(p: Vec2): Vec2 {
    if (!this.blocked(p)) return p;
    for (let r = 0.1; r < 4; r += 0.1) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        if (!this.blocked(q)) return q;
      }
    }
    return p;
  }
}

function segmentRect(a: Vec2, b: Vec2, thickness: number): Rect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const horizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
  return horizontal
    ? { x: minX, y: minY - thickness / 2, w: Math.abs(b.x - a.x), h: thickness }
    : { x: minX - thickness / 2, y: minY, w: thickness, h: Math.abs(b.y - a.y) };
}

function pushOutRect(p: Vec2, r: Rect, radius: number): Vec2 {
  const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= radius) return p;
  if (d > 1e-6) return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius };
  // Center inside the rect: push out along the shallowest axis.
  const left = p.x - r.x;
  const right = r.x + r.w - p.x;
  const down = p.y - r.y;
  const up = r.y + r.h - p.y;
  const m = Math.min(left, right, down, up);
  if (m === left) return { x: r.x - radius, y: p.y };
  if (m === right) return { x: r.x + r.w + radius, y: p.y };
  if (m === down) return { x: p.x, y: r.y - radius };
  return { x: p.x, y: r.y + r.h + radius };
}

function pushOutCircle(p: Vec2, c: { x: number; y: number; r: number }, radius: number): Vec2 {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  const min = radius + c.r;
  if (d >= min || d < 1e-6) return p;
  return { x: c.x + (dx / d) * min, y: c.y + (dy / d) * min };
}
