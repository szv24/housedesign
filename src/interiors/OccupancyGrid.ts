import type { Rect, Vec2 } from "../model/types";

/** Boolean grid over a rectangle, used for reachability (BFS) checks. */
export class OccupancyGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(readonly area: Rect, readonly cell = 0.1) {
    this.cols = Math.max(1, Math.ceil(area.w / cell));
    this.rows = Math.max(1, Math.ceil(area.h / cell));
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  private index(p: Vec2): [number, number] {
    return [Math.floor((p.x - this.area.x) / this.cell), Math.floor((p.y - this.area.y) / this.cell)];
  }

  blockRect(r: Rect): void {
    const [c0, r0] = this.index({ x: r.x, y: r.y });
    const [c1, r1] = this.index({ x: r.x + r.w, y: r.y + r.h });
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c += 1)
      for (let rr = Math.max(0, r0); rr <= Math.min(this.rows - 1, r1); rr += 1) this.blocked[rr * this.cols + c] = 1;
  }

  /** Blocks a one-cell border, so paths cannot run along the walls' inside faces. */
  blockBorder(width: number): void {
    const n = Math.ceil(width / this.cell);
    for (let c = 0; c < this.cols; c += 1)
      for (let r = 0; r < this.rows; r += 1)
        if (c < n || r < n || c >= this.cols - n || r >= this.rows - n) this.blocked[r * this.cols + c] = 1;
  }

  isBlocked(p: Vec2): boolean {
    const [c, r] = this.index(p);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.blocked[r * this.cols + c] === 1;
  }

  /** Cells reachable from `start` (4-connected). Returns null if the start cell is blocked. */
  flood(start: Vec2): Uint8Array | null {
    const [sc, sr] = this.index(start);
    if (sc < 0 || sr < 0 || sc >= this.cols || sr >= this.rows || this.blocked[sr * this.cols + sc]) return null;
    const seen = new Uint8Array(this.cols * this.rows);
    const queue = [sr * this.cols + sc];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const i = queue[head];
      const c = i % this.cols;
      const r = (i - c) / this.cols;
      const next = [c > 0 ? i - 1 : -1, c < this.cols - 1 ? i + 1 : -1, r > 0 ? i - this.cols : -1, r < this.rows - 1 ? i + this.cols : -1];
      for (const n of next) {
        if (n < 0 || seen[n] || this.blocked[n]) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return seen;
  }

  reached(seen: Uint8Array, p: Vec2): boolean {
    const [c, r] = this.index(p);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return seen[r * this.cols + c] === 1;
  }

  hasPath(from: Vec2, to: Vec2): boolean {
    const seen = this.flood(from);
    return seen ? this.reached(seen, to) : false;
  }
}
