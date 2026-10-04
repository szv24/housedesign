import polygonClipping from "polygon-clipping";
import type { Polygon2, Rect, Vec2 } from "./types";

export const EPS = 1e-4;

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function rectToPolygon(r: Rect): Polygon2 {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h }
  ];
}

export function rectCenter(r: Rect): Vec2 {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectArea(r: Rect): number {
  return r.w * r.h;
}

export function rectContains(r: Rect, p: Vec2, margin = 0): boolean {
  return p.x >= r.x - margin && p.x <= r.x + r.w + margin && p.y >= r.y - margin && p.y <= r.y + r.h + margin;
}

export function rectInside(inner: Rect, outer: Rect, tol = 0.005): boolean {
  return (
    inner.x >= outer.x - tol &&
    inner.y >= outer.y - tol &&
    inner.x + inner.w <= outer.x + outer.w + tol &&
    inner.y + inner.h <= outer.y + outer.h + tol
  );
}

/** Strict overlap (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect, tol = 0.005): boolean {
  return a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.h - tol && b.y < a.y + a.h - tol;
}

export function expandRect(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

export function boundsOfRects(rects: Rect[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfPoints(points: Vec2[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function polygonArea(polygon: Polygon2): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

export function pointInPolygon(p: Vec2, poly: Polygon2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Outline of the union of rectangles (outer ring of the largest polygon). */
export function unionOutline(rects: Rect[]): Polygon2 {
  if (rects.length === 1) return rectToPolygon(rects[0]);
  const geoms = rects.map((r) => [rectToPolygon(r).map((p) => [p.x, p.y] as [number, number])]);
  const [first, ...rest] = geoms;
  const result = polygonClipping.union(first, ...rest);
  let best: Array<[number, number]> = [];
  let bestArea = -1;
  for (const poly of result) {
    const ring = poly[0].slice(0, -1);
    const a = polygonArea(ring.map(([x, y]) => ({ x, y })));
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  return best.map(([x, y]) => ({ x: round(x), y: round(y) }));
}

export function round(v: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Offset an orthogonal, counter-clockwise polygon inward by d. */
export function offsetOrthogonalPolygon(poly: Polygon2, d: number): Polygon2 {
  const n = poly.length;
  return poly.map((v, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const d1 = normalize({ x: v.x - prev.x, y: v.y - prev.y });
    const d2 = normalize({ x: next.x - v.x, y: next.y - v.y });
    // Left normals point inward for a CCW polygon.
    const n1 = { x: -d1.y, y: d1.x };
    const n2 = { x: -d2.y, y: d2.x };
    return { x: round(v.x + d * (n1.x + n2.x)), y: round(v.y + d * (n1.y + n2.y)) };
  });
}

export function normalize(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}
