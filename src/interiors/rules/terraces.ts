import type { HouseSpec } from "../../data/houseSpec";
import type { HouseModel, Rect, Side, Terrace } from "../../model/types";
import { pointAlongWall } from "../../model/WallResolver";
import { pergolaPosts, PERGOLA_TOP } from "../../architecture/TerraceGenerator";
import {
  R,
  addLight,
  check,
  commit,
  frontDir,
  makePlacement,
  placeAgainst,
  placeRequired,
  stringLights,
  tryPlace,
  widthDir,
  zoneAlongSide,
  type RoomContext,
  type SideOpening
} from "../FurniturePlacer";

/** A terrace behaves like a room whose house-side edge carries the facade's openings. */
export function createTerraceContext(model: HouseModel, spec: HouseSpec, t: Terrace): RoomContext {
  const r = t.rect;
  const openings: SideOpening[] = [];
  for (const wall of model.walls.filter((w) => w.kind === "exterior")) {
    for (const o of wall.openings) {
      const a = pointAlongWall(wall, o.center - o.width / 2);
      const b = pointAlongWall(wall, o.center + o.width / 2);
      const horizontal = Math.abs(a.y - b.y) < 1e-6;
      if (horizontal && Math.abs(a.y - (r.y + r.h)) < 0.45) {
        const from = Math.max(r.x, Math.min(a.x, b.x));
        const to = Math.min(r.x + r.w, Math.max(a.x, b.x));
        if (to - from > 0.2) openings.push({ id: o.id, kind: o.kind, side: "north", from, to, sill: o.sill, head: o.head, swingsIn: false });
      }
      if (!horizontal && Math.abs(a.x - r.x) < 0.45) {
        const from = Math.max(r.y, Math.min(a.y, b.y));
        const to = Math.min(r.y + r.h, Math.max(a.y, b.y));
        if (to - from > 0.2) openings.push({ id: o.id, kind: o.kind, side: "west", from, to, sill: o.sill, head: o.head, swingsIn: false });
      }
      if (!horizontal && Math.abs(a.x - (r.x + r.w)) < 0.45) {
        const from = Math.max(r.y, Math.min(a.y, b.y));
        const to = Math.min(r.y + r.h, Math.max(a.y, b.y));
        if (to - from > 0.2) openings.push({ id: o.id, kind: o.kind, side: "east", from, to, sill: o.sill, head: o.head, swingsIn: false });
      }
    }
  }
  const keepClear: RoomContext["keepClear"] = [];
  for (const o of openings) {
    if (o.kind === "window") continue;
    keepClear.push({ rect: zoneAlongSide(r, o.side, o.from - 0.05, o.to + 0.05, R.clearance.terracePath), reason: `${o.id} approach` });
  }
  for (const p of pergolaPosts(t)) keepClear.push({ rect: { x: p.x - 0.1, y: p.y - 0.1, w: 0.2, h: 0.2 }, reason: "pergola post" });
  for (const s of t.privacyScreens) {
    const minX = Math.min(s.start.x, s.end.x);
    const minY = Math.min(s.start.y, s.end.y);
    keepClear.push({ rect: { x: minX - 0.08, y: minY - 0.08, w: Math.abs(s.end.x - s.start.x) + 0.16, h: Math.abs(s.end.y - s.start.y) + 0.16 }, reason: "privacy screen" });
  }
  return {
    id: t.id,
    name: t.name,
    room: null,
    rect: r,
    base: t.deckHeight,
    ceiling: t.pergola ? PERGOLA_TOP : t.deckHeight + 2.6,
    openings,
    keepClear,
    placed: [],
    lights: [],
    checks: [],
    model,
    spec
  };
}

/**
 * Main terrace: a 10-seat table under the pergola near the kitchen, a clear path from the
 * dining doors to the garden steps, a lounge group facing the garden, and the outdoor kitchen
 * against the house next to the indoor kitchen.
 */
export function furnishMainTerrace(ctx: RoomContext, t: Terrace): void {
  const r = ctx.rect;
  const doors = ctx.openings.filter((o) => o.kind === "sliding_door").sort((a, b) => a.from - b.from);
  const diningDoor = doors[0];
  // Keep a straight path from the dining doors to the steps.
  let path: Rect | null = null;
  if (diningDoor) {
    const c = (diningDoor.from + diningDoor.to) / 2;
    path = { x: c - R.clearance.terracePath / 2, y: r.y, w: R.clearance.terracePath, h: r.h };
    ctx.keepClear.push({ rect: path, reason: "garden path" });
  }
  const westEnd = path ? path.x : r.x + r.w / 2;

  // Outdoor kitchen against the house, west of the dining doors.
  const kitchen = placeAgainst(ctx, "outdoor_kitchen", "north", { range: [r.x + 1.0, westEnd], at: "end", rationale: "grill against the house, close to the indoor kitchen, away from the bedroom wing" });
  check(ctx, "grill position", Boolean(kitchen), kitchen ? `${R.clearance.grillSafety} m free in front of the grill` : "no grill position");

  // Dining table for 10 under the pergola.
  const pergola = t.pergola ?? r;
  const tableX = (r.x + 0.3 + westEnd) / 2;
  let table = null;
  for (let dy = 0; dy <= 1.2 && !table; dy += 0.05) {
    for (const s of [-1, 1]) {
      table = tryPlace(ctx, "outdoor_table_10", tableX, r.y + r.h / 2 + s * dy - 0.7, 0, { rationale: "long table under the pergola for two families" });
      if (table) break;
    }
  }
  let seats = 0;
  if (table) {
    const reach = table.depth / 2 + 0.29;
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      for (const s of [1, -1]) {
        if (tryPlace(ctx, "outdoor_chair", table.x + k * 0.62, table.y + s * reach, s > 0 ? Math.PI : 0, { allowIn: [table.id] })) seats += 1;
      }
    }
    for (const s of [1, -1]) if (tryPlace(ctx, "outdoor_chair", table.x + s * (table.width / 2 + 0.29), table.y, s > 0 ? -Math.PI / 2 : Math.PI / 2, { allowIn: [table.id] })) seats += 1;
    addLight(ctx, "candle", table.x, table.y, ctx.base + 0.85, 5, 0xff9a4a);
    // String lights in loose catenaries under the pergola rafters.
    for (const fy of [0.3, 0.7]) {
      const y = pergola.y + pergola.h * fy;
      const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => ({ x: pergola.x + 0.2 + (pergola.w - 0.4) * f, y, z: PERGOLA_TOP - 0.12 - Math.sin(f * Math.PI * 2.5) ** 2 * 0.25 }));
      stringLights(ctx, pts, 30, 28);
    }
  }
  check(ctx, "seats for two families", seats >= 8, `${seats} seats at the outdoor table`);

  // Lounge east of the path, facing the garden.
  const eastStart = path ? path.x + path.w : r.x + r.w / 2;
  const loungeX = (eastStart + r.x + r.w) / 2;
  let sofa = null;
  for (let dy = 0; dy <= 1.5 && !sofa; dy += 0.05) sofa = tryPlace(ctx, "outdoor_sofa", loungeX, r.y + r.h - R.clearance.terracePath - 0.5 - dy, 0, { rationale: "sofa faces the garden, back to the house" });
  if (sofa) {
    const F = frontDir(sofa.rotation);
    const ct = tryPlace(ctx, "outdoor_coffee_table", sofa.x, sofa.y + F.y * (sofa.depth / 2 + 0.75), 0);
    const chairY = (ct?.y ?? sofa.y - 1.2) + F.y * 1.15;
    for (const dx of [-0.55, 0.55]) tryPlace(ctx, "outdoor_lounge_chair", sofa.x + dx, chairY, Math.PI, { rationale: "lounge chairs close the conversation circle" });
  }
  check(ctx, "lounge area", Boolean(sofa), sofa ? "lounge group separated from dining by the garden path" : "no lounge position");
  check(ctx, "path to the garden", Boolean(path), path ? `${R.clearance.terracePath} m path from the terrace doors to the steps` : "no clear path");

  // Planters and lanterns: restrained decoration at the edges.
  for (const [x, y] of [
    [r.x + r.w - 0.4, r.y + r.h - 1.6],
    [r.x + 0.45, r.y + r.h - 0.45],
    [r.x + r.w - 0.4, r.y + 0.4]
  ]) tryPlace(ctx, "planter", x, y, 0);
  for (const [x, y] of [
    [r.x + 0.35, r.y + 0.3],
    [eastStart + 0.15, r.y + 0.2]
  ]) {
    const lp = makePlacement(ctx, "lantern", x, y, 0);
    if (lp) commit(ctx, lp);
    addLight(ctx, "candle", x, y, ctx.base + 0.3, 3, 0xff9a4a);
  }
}

/** A 15 m² ceramic terrace: a sofa against the house and a pair of chairs, no ten-seat table. */
export function furnishCompactTerrace(ctx: RoomContext): void {
  const r = ctx.rect;
  const houseSide: Side = ctx.openings.some((o) => o.side === "west") || r.w < r.h ? "west" : "north";
  // Against the house first; when the terrace door takes that edge, along one of the side edges.
  const order: Side[] = houseSide === "west" ? ["west", "north", "south", "east"] : ["north", "west", "east", "south"];
  const sofa = placeRequired(
    ctx,
    order.map((side) => () => placeAgainst(ctx, "outdoor_sofa", side, { at: "center", rationale: side === houseSide ? "sofa against the house, facing the garden" : "sofa along the edge, clear of the terrace door" }))
  );
  check(ctx, "terrace seating", Boolean(sofa), sofa ? "sofa on the ceramic terrace" : "no sofa position");
  if (sofa) {
    const F = frontDir(sofa.rotation);
    const W = widthDir(sofa.rotation);
    tryPlace(ctx, "outdoor_coffee_table", sofa.x + F.x * (sofa.depth / 2 + 0.7), sofa.y + F.y * (sofa.depth / 2 + 0.7), sofa.rotation);
    for (const s of [-1, 1]) {
      tryPlace(ctx, "outdoor_lounge_chair", sofa.x + F.x * 1.6 + W.x * s * 0.9, sofa.y + F.y * 1.6 + W.y * s * 0.9, sofa.rotation + Math.PI);
    }
  }
  tryPlace(ctx, "planter", r.x + r.w - 0.4, r.y + 0.4, 0);
  tryPlace(ctx, "planter", r.x + 0.4, r.y + r.h - 0.4, 0);
}

/** Private terrace: two lounge chairs facing the sunset, a small round table between them. */
export function furnishPrivateTerrace(ctx: RoomContext): void {
  const r = ctx.rect;
  const cx = r.x + r.w * 0.42;
  const table = tryPlace(ctx, "bistro_table", cx, r.y + r.h / 2 + 0.1, 0, { rationale: "small table between the chairs" });
  let chairs = 0;
  for (const s of [-1, 1]) {
    const y = (table?.y ?? r.y + r.h / 2) + s * 0.85;
    if (tryPlace(ctx, "outdoor_lounge_chair", cx, y, -Math.PI / 2, { rationale: "chairs face west, toward the sunset" })) chairs += 1;
  }
  check(ctx, "romantic seating", chairs === 2 && Boolean(table), `${chairs} chairs and ${table ? "a" : "no"} table`);
  const lp = makePlacement(ctx, "lantern", r.x + 0.25, r.y + 0.3, 0);
  if (lp) commit(ctx, lp);
  addLight(ctx, "candle", r.x + 0.25, r.y + 0.3, ctx.base + 0.3, 3, 0xff9a4a);
  if (table) addLight(ctx, "candle", table.x, table.y, ctx.base + 0.85, 3, 0xff9a4a);
  // Fairy lights along the top of the south screen.
  const screen = ctx.spec.terraces.masterPrivate.screenHeight + ctx.base;
  const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ x: r.x + 0.1 + (r.w - 0.2) * f, y: r.y + 0.06, z: screen - 0.05 - Math.sin(f * Math.PI * 2) ** 2 * 0.12 }));
  stringLights(ctx, pts, 20, 12, { x: 0, y: 0.9 });
}

/** Exterior wall lights beside the front door and on the terrace facade. */
export function exteriorLights(model: HouseModel, ctx: RoomContext): void {
  for (const wall of model.walls.filter((w) => w.kind === "exterior")) {
    const dirLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    const dir = { x: (wall.end.x - wall.start.x) / dirLen, y: (wall.end.y - wall.start.y) / dirLen };
    const right = { x: dir.y, y: -dir.x };
    const rot = Math.atan2(right.x, -right.y);
    const put = (s: number, z: number) => {
      const c = pointAlongWall(wall, s);
      const x = c.x + right.x * (wall.thickness / 2 + 0.09);
      const y = c.y + right.y * (wall.thickness / 2 + 0.09);
      const p = makePlacement(ctx, "wall_light", x, y, rot, { elevation: z - ctx.base });
      if (p) commit(ctx, p);
      addLight(ctx, "wall", x + right.x * 0.5, y + right.y * 0.5, z - 0.35, 35);
    };
    for (const o of wall.openings) {
      if (o.kind === "front_door") for (const s of [-1, 1]) put(o.center + s * (o.width / 2 + 0.35), model.floorLevel + 2.0);
      if (o.kind === "glazed_door") put(o.center - o.width / 2 - 0.35, model.floorLevel + 2.0);
    }
    const slides = wall.openings.filter((o) => o.kind === "sliding_door");
    for (let i = 0; i < slides.length - 1; i += 1) put((slides[i].center + slides[i].width / 2 + slides[i + 1].center - slides[i + 1].width / 2) / 2, model.floorLevel + 2.15);
  }
}
