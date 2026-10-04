import type { HouseModel, Rect, RoomId } from "../model/types";
import { pointAlongWall, wallDirection } from "../model/WallResolver";
import { wallPieces } from "../architecture/WallGenerator";
import { sideOfRoom, wallFrame } from "../architecture/wallFrame";
import { catalogById } from "../interiors/FurnitureLibrary";

const ROOM_FILL: Record<RoomId, string> = {
  living_kitchen: "#efe4d2",
  master_bedroom: "#e4e9e6",
  kids_bedroom_1: "#e6ebe2",
  kids_bedroom_2: "#e6ebe2",
  office: "#e9e5dc",
  bathroom: "#dfe7ec",
  guest_wc: "#dfe7ec",
  utility: "#e7e4de",
  entrance: "#e4e1db",
  circulation: "#f1eee8",
  bedroom_sw: "#e7efe4",
  bedroom_nw: "#e7efe4",
  bedroom_ne: "#e7efe4",
  kitchen: "#f4efe4",
  living: "#f7f3ea",
  wardrobe: "#efe6d8"
};

const PAPER = "#f6f3ec";
const WALL = "#2d2f31";
const INK = "#3a3d40";

export interface PlanView {
  scale: number;
  ox: number;
  oy: number;
  bounds: Rect;
}

/** Pure renderer: HouseModel -> 2D architectural plan on a canvas. */
export class FloorPlanRenderer {
  private staticLayer: HTMLCanvasElement | null = null;
  private key = "";
  view: PlanView = { scale: 1, ox: 0, oy: 0, bounds: { x: 0, y: 0, w: 1, h: 1 } };

  toCanvas(x: number, y: number): [number, number] {
    const v = this.view;
    return [v.ox + (x - v.bounds.x) * v.scale, v.oy + (v.bounds.y + v.bounds.h - y) * v.scale];
  }

  toPlan(cx: number, cy: number): { x: number; y: number } {
    const v = this.view;
    return { x: v.bounds.x + (cx - v.ox) / v.scale, y: v.bounds.y + v.bounds.h - (cy - v.oy) / v.scale };
  }

  private layout(model: HouseModel, w: number, h: number): void {
    const pad = 1.2;
    const b = { x: model.bounds.x - pad, y: model.bounds.y - pad, w: model.bounds.w + 2 * pad, h: model.bounds.h + 2 * pad };
    const scale = Math.min(w / b.w, h / b.h);
    this.view = { scale, ox: (w - b.w * scale) / 2, oy: (h - b.h * scale) / 2, bounds: b };
  }

  invalidate(): void {
    this.key = "";
  }

  draw(ctx: CanvasRenderingContext2D, model: HouseModel, modelVersion: number, player: { x: number; y: number; yaw: number } | null, currentRoom: RoomId | null): void {
    const canvas = ctx.canvas;
    const key = `${modelVersion}:${canvas.width}x${canvas.height}:${currentRoom}`;
    if (key !== this.key || !this.staticLayer) {
      this.layout(model, canvas.width, canvas.height);
      this.staticLayer = this.renderStatic(model, canvas.width, canvas.height, currentRoom);
      this.key = key;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.staticLayer, 0, 0);
    if (player) this.drawPlayer(ctx, player);
  }

  private renderStatic(model: HouseModel, w: number, h: number, currentRoom: RoomId | null): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const s = this.view.scale;
    const P = (x: number, y: number) => this.toCanvas(x, y);
    const rectPath = (r: Rect) => {
      const [x0, y0] = P(r.x, r.y + r.h);
      ctx.rect(x0, y0, r.w * s, r.h * s);
    };
    const dpr = Math.max(1, w / 400);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    // Terraces: deck boards, planting buffer, pergola outline.
    for (const t of model.terraces) {
      ctx.fillStyle = "#e3d2b8";
      ctx.beginPath();
      rectPath(t.rect);
      for (const st of t.steps) rectPath(st);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      rectPath(t.rect);
      ctx.clip();
      ctx.strokeStyle = "rgba(140,105,70,0.25)";
      ctx.lineWidth = 1;
      for (let x = t.rect.x; x < t.rect.x + t.rect.w; x += 0.14) {
        const [cx] = P(x, 0);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
      }
      ctx.restore();
      if (t.pergola) {
        ctx.setLineDash([4 * dpr, 3 * dpr]);
        ctx.strokeStyle = "rgba(110,80,50,0.6)";
        ctx.lineWidth = dpr;
        ctx.beginPath();
        rectPath(t.pergola);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (t.plantingBuffer) {
        ctx.fillStyle = "#c9d6b8";
        ctx.beginPath();
        rectPath(t.plantingBuffer);
        ctx.fill();
      }
      ctx.strokeStyle = "#7a5d3f";
      ctx.lineWidth = 2 * dpr;
      for (const sc of t.privacyScreens) {
        const [a0, a1] = P(sc.start.x, sc.start.y);
        const [b0, b1] = P(sc.end.x, sc.end.y);
        ctx.beginPath();
        ctx.moveTo(a0, a1);
        ctx.lineTo(b0, b1);
        ctx.stroke();
      }
    }

    // Rooms
    for (const room of model.rooms) {
      ctx.fillStyle = ROOM_FILL[room.id];
      ctx.beginPath();
      for (const p of room.parts) rectPath(p);
      ctx.fill();
      if (room.id === currentRoom) {
        ctx.fillStyle = "rgba(93,117,134,0.14)";
        ctx.fill();
      }
    }

    // Furniture footprints
    for (const f of model.furniture) {
      const item = catalogById(f.catalogId);
      if (!item || item.mounted) continue;
      ctx.beginPath();
      rectPath(f.footprint);
      if (item.flat) {
        ctx.fillStyle = "rgba(120,100,80,0.07)";
        ctx.fill();
        continue;
      }
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(60,55,50,0.55)";
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
    }

    // Walls: solid pieces at full height; windows as glazing lines.
    ctx.fillStyle = WALL;
    for (const wall of model.walls) {
      const d = wallDirection(wall);
      const n = { x: -d.y * wall.thickness / 2, y: d.x * wall.thickness / 2 };
      const quad = (s0: number, s1: number) => {
        const a = pointAlongWall(wall, s0);
        const b = pointAlongWall(wall, s1);
        const pts = [
          P(a.x + n.x, a.y + n.y),
          P(b.x + n.x, b.y + n.y),
          P(b.x - n.x, b.y - n.y),
          P(a.x - n.x, a.y - n.y)
        ];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
      };
      for (const [s0, s1, z0, z1] of wallPieces(wall)) {
        if (z0 > 0.01 || z1 < wall.height - 0.01) continue;
        quad(s0, s1);
        ctx.fill();
      }
      for (const o of wall.openings) {
        if (o.kind !== "window" && o.kind !== "sliding_door") continue;
        const s0 = o.center - o.width / 2;
        const s1 = o.center + o.width / 2;
        quad(s0, s1);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = WALL;
        ctx.lineWidth = 0.8 * dpr;
        ctx.stroke();
        const a = pointAlongWall(wall, s0);
        const b = pointAlongWall(wall, s1);
        ctx.strokeStyle = "#5b8fb0";
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        const [ax, ay] = P(a.x, a.y);
        const [bx, by] = P(b.x, b.y);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = WALL;
      }
    }
    // Doors: leaf + swing arc.
    ctx.strokeStyle = INK;
    for (const wall of model.walls) {
      const f = wallFrame(wall, 0);
      for (const o of wall.openings) {
        if (o.kind !== "door" && o.kind !== "front_door" && o.kind !== "glazed_door") continue;
        const swing = o.swingInto ?? o.rooms[0];
        const side = sideOfRoom(f, o.center, model.rooms, swing) || -1;
        const hingeSign = o.hinge === "end" ? -1 : 1;
        const hs = hingeSign === 1 ? o.center - o.width / 2 : o.center + o.width / 2;
        const hinge = f.plan(hs, (side * wall.thickness) / 2);
        const tip = { x: hinge.x + f.right.x * side * o.width, y: hinge.y + f.right.y * side * o.width };
        const closed = { x: hinge.x + f.dir.x * hingeSign * o.width, y: hinge.y + f.dir.y * hingeSign * o.width };
        const [hx, hy] = P(hinge.x, hinge.y);
        const [tx, ty] = P(tip.x, tip.y);
        const [cx, cy] = P(closed.x, closed.y);
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.lineWidth = 0.7 * dpr;
        ctx.setLineDash([2 * dpr, 2 * dpr]);
        ctx.beginPath();
        const a0 = Math.atan2(ty - hy, tx - hx);
        const a1 = Math.atan2(cy - hy, cx - hx);
        let delta = a1 - a0;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        ctx.arc(hx, hy, o.width * s, a0, a1, delta < 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Labels
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const room of model.rooms) {
      const part = [...room.parts].sort((a, b) => b.w * b.h - a.w * a.h)[0];
      const [cx, cy] = P(part.x + part.w / 2, part.y + part.h / 2);
      const small = part.w * s < 70 * dpr || part.h * s < 40 * dpr;
      const name = room.name.replace("Living / Dining / Kitchen", "Living · Dining · Kitchen");
      ctx.fillStyle = "rgba(246,243,236,0.8)";
      ctx.font = `600 ${(small ? 8.5 : 10) * dpr}px Inter, system-ui, sans-serif`;
      const label = small ? name.split(" ")[0] : name;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(cx - tw / 2 - 3 * dpr, cy - 9 * dpr, tw + 6 * dpr, 20 * dpr);
      ctx.fillStyle = INK;
      ctx.fillText(label, cx, cy - 2 * dpr);
      ctx.font = `${8.5 * dpr}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(58,61,64,0.7)";
      ctx.fillText(`${room.area.toFixed(1)} m²`, cx, cy + 7 * dpr);
    }
    for (const t of model.terraces) {
      const [cx, cy] = P(t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h * (t.id === "main_terrace" ? 0.12 : 0.85));
      ctx.font = `600 ${8.5 * dpr}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#7a5d3f";
      ctx.fillText(`${t.name} · ${t.area.toFixed(0)} m²`, cx, cy);
    }

    // North arrow, rotated by the site's north angle (plan +y is up on the canvas).
    const nx = w - 18 * dpr;
    const ny = 22 * dpr;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate((model.northAngleDeg * Math.PI) / 180);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, -10 * dpr);
    ctx.lineTo(6 * dpr, 6 * dpr);
    ctx.lineTo(0, 2 * dpr);
    ctx.lineTo(-6 * dpr, 6 * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = `700 ${9 * dpr}px Inter, system-ui, sans-serif`;
    ctx.fillText("N", nx, ny + 20 * dpr);
    return c;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: { x: number; y: number; yaw: number }): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const dpr = Math.max(1, w / 400);
    let [x, y] = this.toCanvas(p.x, p.y);
    const margin = 10 * dpr;
    const outside = x < margin || y < margin || x > w - margin || y > h - margin;
    x = Math.min(Math.max(x, margin), w - margin);
    y = Math.min(Math.max(y, margin), h - margin);
    // Canvas angle of the view direction: plan forward = (-sin yaw, cos yaw), canvas y is flipped.
    const ang = Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw));
    const r = 42 * dpr;
    const fov = 0.6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(214,120,72,0.55)");
    g.addColorStop(1, "rgba(214,120,72,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, ang - fov, ang + fov);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 6.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outside ? "#8a8f94" : "#d6784a";
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}
