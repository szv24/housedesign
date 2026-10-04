import {
  R,
  addLight,
  check,
  commit,
  hangPendant,
  makePlacement,
  placeAgainst,
  placeOptional,
  sideGeometry,
  stringLights,
  tryPlace,
  type RoomContext
} from "../FurniturePlacer";
import { roofUndersideAt } from "../../architecture/roofMath";
import type { FurniturePlacement } from "../../model/types";
import { dist } from "../../model/geometry2d";

function ceilingAt(ctx: RoomContext, x: number, y: number): number {
  const t = ctx.spec.building.exteriorWallThickness;
  return ctx.base + (ctx.room?.ceilingType === "vaulted" ? roofUndersideAt(ctx.model, t, x, y) : ctx.model.wallHeight);
}

/**
 * Open-plan living / dining / kitchen. Zones run west to east along the wing:
 * kitchen next to the service core, dining in the middle on the terrace doors, living at the
 * glazed east gable with the wood stove as focal point.
 */
export function furnishLivingKitchen(ctx: RoomContext): void {
  const r = ctx.rect;
  const K = R.kitchen;
  const kitchenEnd = r.x + r.w * R.living.kitchenZoneFraction;
  const livingStart = r.x + r.w * (1 - R.living.livingZoneFraction);
  const north = sideGeometry(r, "north");

  // ---------- Kitchen: tall units on the west wall (north end), counter run along the north wall.
  const tallIds = ["tall_fridge", "tall_oven", "tall_pantry"];
  const tall: FurniturePlacement[] = [];
  let cursor = r.y + r.h - K.counterDepth - K.moduleWidth / 2 - 0.01;
  for (const id of tallIds) {
    const p = placeAgainst(ctx, id, "west", { at: cursor, rationale: "tall units grouped on the solid wall beside the counter run" });
    if (p) {
      tall.push(p);
      cursor = p.y - K.moduleWidth;
    }
  }
  const runStart = r.x + K.counterDepth + 0.01;
  const strip = ctx.openings.find((o) => o.side === "north" && o.kind === "window" && o.from < kitchenEnd);
  const windowCenter = strip ? (strip.from + strip.to) / 2 : runStart + 1.2;
  const sinkIdx = Math.max(1, Math.floor((windowCenter - runStart) / K.moduleWidth));
  const sequence = ["dishwasher", "sink_cabinet", "base_cabinet", "cooktop_cabinet", "base_cabinet"];
  const offset = sinkIdx - 1;
  const modules = [...Array.from({ length: offset }, () => "base_cabinet"), ...sequence];
  const run: FurniturePlacement[] = [];
  const runY = north.wall - 0.01 - K.counterDepth / 2;
  modules.forEach((id, i) => {
    const x = runStart + K.moduleWidth * (i + 0.5);
    if (x + K.moduleWidth / 2 > kitchenEnd + K.moduleWidth + 0.05) return;
    const p = tryPlace(ctx, id, x, runY, 0, { rationale: "600 mm modules along the north wall under the window strip", allowIn: tall.map((t) => t.id) });
    if (p) run.push(p);
  });
  const sink = run.find((p) => p.catalogId === "sink_cabinet");
  const hob = run.find((p) => p.catalogId === "cooktop_cabinet");
  const fridge = tall.find((p) => p.catalogId === "tall_fridge");
  check(ctx, "sink under window", Boolean(sink && strip && sink.x > strip.from && sink.x < strip.to), "the sink sits under the north window strip");
  if (sink && hob && fridge) {
    const tri = dist(sink, hob) + dist(hob, fridge) + dist(fridge, sink);
    check(ctx, "kitchen work triangle", tri >= K.workTriangleMin && tri <= K.workTriangleMax, `${tri.toFixed(2)} m (target ${K.workTriangleMin}–${K.workTriangleMax} m)`);
    const idx = run.indexOf(hob);
    const landing = run.length - 1 - idx;
    check(ctx, "landing beside cooktop", landing * K.moduleWidth >= K.landingBesideCooktop, `${(landing * K.moduleWidth).toFixed(1)} m of counter beside the hob`);
  } else check(ctx, "kitchen work triangle", false, "fridge, sink or cooktop missing");

  // ---------- Island, only if the aisle and clearances allow it.
  const runFront = runY - K.counterDepth / 2;
  const islandY = runFront - R.clearance.kitchenAisle - K.islandDepth / 2 - 0.02;
  let island: FurniturePlacement | null = null;
  const runMid = run.length ? (run[0].x + run[run.length - 1].x) / 2 : (r.x + kitchenEnd) / 2;
  for (let dx = 0; dx <= 1.2 && !island; dx += 0.05) {
    for (const s of [1, -1]) {
      island = tryPlace(ctx, "kitchen_island", runMid + s * dx, islandY, 0, { rationale: `island kept ${R.clearance.kitchenAisle} m from the counter run`, allowIn: run.map((p) => p.id) });
      if (island) break;
    }
  }
  check(ctx, "island only with full aisle", true, island ? "island placed with a full kitchen aisle and seating clearance" : "no island: aisle or clearance would be compromised");
  if (island) {
    const stools = 3;
    for (let i = 0; i < stools; i += 1) {
      const x = island.x - 0.6 + i * 0.6;
      tryPlace(ctx, "bar_stool", x, island.y - K.islandDepth / 2 - 0.22, Math.PI, { allowIn: [island.id], rationale: "stools on the dining side of the island" });
    }
    for (const dx of [-0.45, 0.45]) {
      hangPendant(ctx, "pendant_small", island.x + dx, island.y, R.living.islandPendantDrop, 70, { ceiling: ceilingAt(ctx, island.x + dx, island.y), light: dx < 0 });
    }
  } else if (sink) {
    addLight(ctx, "ceiling", sink.x, sink.y - 0.6, ceilingAt(ctx, sink.x, sink.y) - 0.3, 80);
  }

  // ---------- Dining: in the middle zone, on axis with the terrace doors.
  const diningDoor = ctx.openings.find((o) => o.side === "south" && o.kind === "sliding_door" && (o.from + o.to) / 2 > kitchenEnd && (o.from + o.to) / 2 < livingStart);
  const dx0 = island ? Math.max(kitchenEnd, island.x + 0.9) : kitchenEnd;
  const diningCx = (dx0 + livingStart) / 2;
  const diningCy = r.y + r.h / 2;
  let table: FurniturePlacement | null = null;
  // Long axis along y fits the narrow zone; try along x if the zone is wide enough.
  for (const rot of [Math.PI / 2, 0]) {
    for (let d = 0; d <= 1.2 && !table; d += 0.05) {
      for (const s of [1, -1]) {
        table = tryPlace(ctx, "dining_table_8", diningCx + s * d, diningCy, rot, { rationale: "dining between kitchen and living, opposite the terrace doors" });
        if (table) break;
      }
    }
    if (table) break;
  }
  if (table) {
    const along = table.rotation === 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const across = { x: along.y, y: along.x };
    const half = table.width / 2;
    const chairDepth = 0.52;
    const reach = table.depth / 2 + chairDepth / 2 + 0.01;
    const seats: Array<[number, number, number]> = [];
    for (const k of [-1, 0, 1]) {
      for (const s of [1, -1]) {
        const x = table.x + along.x * k * 0.68 + across.x * s * reach;
        const y = table.y + along.y * k * 0.68 + across.y * s * reach;
        const rot = Math.atan2(-across.x * s, across.y * s) + Math.PI;
        seats.push([x, y, rot]);
      }
    }
    for (const s of [1, -1]) seats.push([table.x + along.x * s * (half + chairDepth / 2 + 0.01), table.y + along.y * s * (half + chairDepth / 2 + 0.01), 0]);
    let placed = 0;
    for (const [x, y, rot] of seats) if (tryPlace(ctx, "dining_chair", x, y, faceToward(x, y, table.x, table.y, rot), { allowIn: [table.id], rationale: "chairs keep the pull-back zone" })) placed += 1;
    check(ctx, "dining seats", placed >= 6, `${placed} chairs around the table`);
    hangPendant(ctx, "pendant", table.x, table.y, R.living.diningPendantDrop, 140, { ceiling: ceilingAt(ctx, table.x, table.y) });
    addLight(ctx, "candle", table.x, table.y, ctx.base + 0.9, 4, 0xff9a4a);
    if (diningDoor) check(ctx, "dining opens to the terrace", Math.abs((diningDoor.from + diningDoor.to) / 2 - table.x) < 1.5, "terrace doors on the dining axis");
  } else check(ctx, "dining table", false, "no valid dining table position");

  // ---------- Living: wood stove centered on the north wall, sofa facing it, view east and south.
  const lr: [number, number] = [livingStart, r.x + r.w];
  const stoveX = (lr[0] + lr[1]) / 2;
  const stoveCeiling = ceilingAt(ctx, stoveX, north.wall - 0.4) - ctx.base;
  const stove = placeAgainst(ctx, "wood_stove", "north", { at: stoveX, range: lr, height: stoveCeiling, gap: 0.06, rationale: "stove is the focal point; the sofa faces it with a lateral view to the garden" });
  if (stove) {
    addLight(ctx, "candle", stove.x, stove.y + 0.1, ctx.base + 0.45, 18, 0xff8a3a);
    const stoveFront = stove.y - stove.depth / 2;
    const ctY = stoveFront - R.clearance.stoveSafety - 0.31 - 0.1;
    const coffee = tryPlace(ctx, "coffee_table", stove.x, ctY, 0, { rationale: "coffee table beyond the stove safety zone" });
    const sofaY = ctY - 0.31 - R.clearance.sofaToCoffeeTable - 0.475 - 0.01;
    let sofa: FurniturePlacement | null = null;
    for (let d = 0; d <= 0.6 && !sofa; d += 0.05) for (const s of [1, -1]) if (!sofa) sofa = tryPlace(ctx, "sofa_3s", stove.x + s * d, sofaY, Math.PI, { rationale: "sofa faces the stove; circulation passes behind it" });
    check(ctx, "sofa orientation", Boolean(sofa), sofa ? "sofa faces the wood stove, glazing to its side" : "sofa could not be placed");
    if (sofa) {
      const behind = sofa.y - sofa.depth / 2 - r.y;
      check(ctx, "circulation behind sofa", behind >= R.clearance.primaryCirculation, `${behind.toFixed(2)} m behind the sofa`);
      commit(ctx, makePlacement(ctx, "rug_living", stove.x, (sofa.y + stove.y) / 2 - 0.25, 0)!);
      // Floor lamp at the sofa's west end; armchair on the east side angled to the stove.
      for (const dx of [0, 0.2, 0.4]) {
        const lamp = tryPlace(ctx, "floor_lamp", sofa.x - sofa.width / 2 - 0.3 - dx, sofa.y + 0.1, 0);
        if (lamp) {
          addLight(ctx, "floor_lamp", lamp.x, lamp.y, ctx.base + 1.45, 90);
          break;
        }
      }
      placeOptional(ctx, [
        () =>
          placeAgainst(ctx, "armchair", "east", {
            at: coffee?.y ?? sofa.y + 1,
            range: [sofa.y, stoveFront],
            gap: 0.05,
            rationale: "armchair closes the conversation group, angled to stove and garden"
          })
      ]);
    }
    // Bookshelf beside the stove on the north wall, plant in a free corner.
    placeOptional(ctx, [() => placeAgainst(ctx, "bookshelf", "north", { range: [lr[0] - 0.4, stove.x - stove.width / 2 - 0.15], at: "end", rationale: "bookshelf on the solid wall beside the stove" })]);
    placeOptional(ctx, [() => placeAgainst(ctx, "plant_large", "north", { range: [stove.x + stove.width / 2 + 0.2, lr[1]], at: "end" })]);
    // Fairy lights draped along the head of the east glazing.
    const east = ctx.openings.find((o) => o.side === "east" && o.kind === "window");
    if (east) {
      const x = r.x + r.w - 0.12;
      const z = ctx.base + Math.min(east.head, ctx.model.wallHeight) + 0.05;
      const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ x, y: east.from + 0.1 + (east.to - east.from - 0.2) * f, z: z - Math.sin(f * Math.PI * 2) ** 2 * 0.12 }));
      stringLights(ctx, pts, 36, 25, { x: -0.9, y: 0 });
    }
  } else check(ctx, "wood stove", false, "stove could not be placed on the north wall");
  check(ctx, "fireplace / TV relationship", true, "the wood stove is the living room's focal point; no TV competes with it");
}

/** Rotation so that an item at (x, y) faces the point (tx, ty), snapped to 90°. */
function faceToward(x: number, y: number, tx: number, ty: number, fallback: number): number {
  const dx = tx - x;
  const dy = ty - y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dy < 0 ? 0 : Math.PI;
}
