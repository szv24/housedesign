import { R, ceilingLight, check, commit, hangPendant, makePlacement, placeAgainst, placeOptional, placeRequired, tryPlace } from "../FurniturePlacer";
import type { RoomContext } from "../FurniturePlacer";
import type { FurniturePlacement, Side } from "../../model/types";

const SIDES: Side[] = ["north", "west", "east", "south"];

/**
 * Kitchen and dining from the measured plan: an L-shaped counter along the entrance wall (west)
 * and under the south window, with the sink on the window and the hob on the west leg; the table
 * stands in the middle with its long side toward the counter, as drawn.
 */
export function furnishPlanKitchen(ctx: RoomContext): void {
  const r = ctx.rect;
  const K = R.kitchen;
  const m = K.moduleWidth;
  const inset = 0.01 + K.counterDepth / 2;
  const run: FurniturePlacement[] = [];
  const ids = () => run.map((p) => p.id);
  const unit = (id: string, x: number, y: number, rot: number, rationale: string) => {
    // The counter may run into the strip along the open edge to the living room; it blocks no door.
    const p = tryPlace(ctx, id, x, y, rot, { rationale, allowIn: ids(), ignoreKeepClear: true });
    if (p) run.push(p);
    return p;
  };

  // West leg, from the corner northward: corner base, base, hob, base, base, fridge at the hall end.
  const westX = r.x + inset;
  const west = ["base_cabinet", "base_cabinet", "cooktop_cabinet", "base_cabinet", "base_cabinet", "tall_fridge"];
  west.forEach((id, i) => {
    const y = r.y + 0.01 + m * (i + 0.5);
    if (y + m / 2 > r.y + r.h - 0.01) return;
    unit(id, westX, y, Math.PI / 2, i === 0 ? "corner of the L" : id === "tall_fridge" ? "fridge at the hall end of the run" : "600 mm modules along the entrance wall");
  });

  // South leg under the window: dishwasher, base, sink on the window, base.
  const southY = r.y + inset;
  const window = ctx.openings.find((o) => o.side === "south" && o.kind === "window");
  const windowCenter = window ? (window.from + window.to) / 2 : r.x + K.counterDepth + 1.5 * m;
  const firstX = r.x + K.counterDepth + 0.01 + m / 2;
  const sinkIdx = Math.max(1, Math.round((windowCenter - firstX) / m));
  const south: string[] = [];
  for (let i = 0; i <= sinkIdx + 1; i += 1) south.push(i === sinkIdx ? "sink_cabinet" : i === sinkIdx - 1 ? "dishwasher" : "base_cabinet");
  south.forEach((id, i) => unit(id, firstX + m * i, southY, Math.PI, id === "sink_cabinet" ? "sink under the window" : "modules under the window"));

  const hob = run.find((p) => p.catalogId === "cooktop_cabinet");
  const sink = run.find((p) => p.catalogId === "sink_cabinet");
  check(ctx, "kitchen counter", Boolean(hob && sink), hob && sink ? `L-shaped counter, ${run.length} modules, sink on the window` : "counter incomplete");

  // Dining table parallel to the west leg, chairs on both long sides (they tuck under the table).
  const tableX = r.x + K.counterDepth + 0.85 + 0.5;
  const tableY = Math.min(r.y + r.h - 0.1 - 1.1, r.y + K.counterDepth + 0.85 + 1.1);
  const table = placeRequired(ctx, [
    () => tryPlace(ctx, "dining_table_8", tableX, tableY, Math.PI / 2, { rationale: "dining table beside the counter, as drawn", allowIn: ids() }),
    () => tryPlace(ctx, "dining_table_8", r.x + r.w / 2, r.y + r.h / 2, Math.PI / 2, { rationale: "dining table in the kitchen" })
  ]);
  check(ctx, "dining table", Boolean(table), table ? "table in the kitchen-dining room" : "no table position");
  if (table) {
    for (const k of [-0.7, 0.7]) {
      for (const s of [1, -1]) {
        tryPlace(ctx, "dining_chair", table.x + s * 0.78, table.y + k, s > 0 ? -Math.PI / 2 : Math.PI / 2, { allowIn: [table.id, ...ids()], ignoreKeepClear: true });
      }
    }
    hangPendant(ctx, "pendant", table.x, table.y, R.living.diningPendantDrop, 55);
  }
  ceilingLight(ctx, r.x + K.counterDepth + 0.8, r.y + r.h / 2, 30);
}

/** Living room: TV sideboard on the bedroom wall, L-shaped sofa in the south-east corner facing it. */
export function furnishPlanLiving(ctx: RoomContext): void {
  const r = ctx.rect;
  const media = placeAgainst(ctx, "media_sideboard", "north", { at: r.x + r.w * 0.5, rationale: "TV wall toward the bedrooms, between the two doors" });
  check(ctx, "living focus", Boolean(media), media ? "TV sideboard on the north wall" : "no sideboard position");

  const sofa = placeAgainst(ctx, "sofa_3s", "south", { at: media ? media.x : r.x + r.w * 0.5, rationale: "sofa under the south window, facing the TV" });
  check(ctx, "sofa", Boolean(sofa), sofa ? "three-seat sofa placed" : "no sofa position");
  if (sofa) {
    const half = 2.3 / 2;
    const corner = (dir: 1 | -1) =>
      tryPlace(ctx, "sofa_corner", sofa.x + dir * (half + 0.95 / 2), sofa.y - 0.95 / 2 + 1.6 / 2, dir > 0 ? -Math.PI / 2 : Math.PI / 2, {
        allowIn: [sofa.id],
        rationale: "return of the L-shaped sofa"
      });
    const ret = placeOptional(ctx, [() => corner(1), () => corner(-1)]);
    check(ctx, "L-shaped sofa", Boolean(ret), ret ? "corner return placed" : "no room for the return");
    const tableY = sofa.y + 0.95 / 2 + R.clearance.sofaToCoffeeTable + 0.31 + 0.1;
    placeOptional(ctx, [() => tryPlace(ctx, "coffee_table", sofa.x, tableY, 0, { allowIn: [sofa.id] })]);
    commit(ctx, makePlacement(ctx, "rug_living", sofa.x, tableY + 0.2, 0)!);
  }
  placeOptional(ctx, [() => placeAgainst(ctx, "plant_large", "east", { at: "start" })]);
  ceilingLight(ctx, r.x + r.w / 2, r.y + r.h / 2, 35);
}

/** Walk-in wardrobe: storage along the long walls. */
export function furnishWardrobe(ctx: RoomContext): void {
  const placed = placeRequired(ctx, SIDES.map((s) => () => placeAgainst(ctx, "wardrobe_100", s, { at: "center", rationale: "hanging storage" })));
  check(ctx, "wardrobe storage", Boolean(placed), placed ? "wardrobe placed" : "no storage position");
  placeOptional(ctx, SIDES.map((s) => () => placeAgainst(ctx, "wardrobe_100", s, { at: "end" })));
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 20);
}
