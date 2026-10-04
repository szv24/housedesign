import type { FurniturePlacement, Side } from "../../model/types";
import {
  R,
  addLight,
  ceilingLight,
  check,
  commit,
  frontDir,
  hangPendant,
  makePlacement,
  opposite,
  placeAgainst,
  placeOptional,
  placeRequired,
  sideLength,
  solidSides,
  tryPlace,
  type RoomContext
} from "../FurniturePlacer";

const ALL: Side[] = ["north", "east", "south", "west"];

function sideFacing(p: FurniturePlacement): Side {
  const F = frontDir(p.rotation);
  if (F.y < -0.5) return "north";
  if (F.y > 0.5) return "south";
  if (F.x < -0.5) return "east";
  return "west";
}

/** Office: desk perpendicular to the main window, so daylight falls from the side. */
export function furnishOffice(ctx: RoomContext): void {
  const windows = ctx.openings.filter((o) => o.kind === "window").sort((a, b) => b.to - b.from - (a.to - a.from));
  const main = windows[0];
  const perpendicular: Side[] = main && (main.side === "north" || main.side === "south") ? ["east", "west"] : ["north", "south"];
  const solid = solidSides(ctx);
  const candidates = perpendicular.sort((a, b) => Number(!solid.includes(a)) - Number(!solid.includes(b)));
  const desk = placeRequired(ctx, candidates.map((s) => () => placeAgainst(ctx, "desk_140", s, { at: "center", rationale: "desk perpendicular to the main window: side light, no screen glare" })));
  check(ctx, "desk orientation", Boolean(desk), desk ? `daylight from the ${main?.side ?? "side"}, not behind the screen` : "no position perpendicular to the window");
  if (desk) {
    const F = frontDir(desk.rotation);
    tryPlace(ctx, "office_chair", desk.x + F.x * (desk.depth / 2 + 0.33), desk.y + F.y * (desk.depth / 2 + 0.33), desk.rotation + Math.PI, { allowIn: [desk.id], rationale: "ergonomic chair with 0.9 m to push back" });
    commit(ctx, makePlacement(ctx, "table_lamp", desk.x + 0.5 * Math.cos(desk.rotation), desk.y + 0.5 * Math.sin(desk.rotation), desk.rotation, { elevation: 0.74 })!);
    addLight(ctx, "table_lamp", desk.x, desk.y, ctx.base + 1.1, 20);
  }
  const shelf = placeRequired(ctx, ALL.map((s) => () => placeAgainst(ctx, "shelf_unit", s, { at: "end", rationale: "storage on a wall without windows" })));
  check(ctx, "office storage", Boolean(shelf), shelf ? "shelving placed clear of the door" : "no storage wall");
  const lounge = placeOptional(ctx, (["west", "north", "south"] as Side[]).map((s) => () => placeAgainst(ctx, "lounge_chair", s, { at: "end", rationale: "a quiet reading chair by the window" })));
  if (lounge) {
    const lamp = placeOptional(ctx, [0.55, -0.55].map((d) => () => tryPlace(ctx, "floor_lamp", lounge.x + d * Math.cos(lounge.rotation), lounge.y + d * Math.sin(lounge.rotation), 0)));
    if (lamp) addLight(ctx, "floor_lamp", lamp.x, lamp.y, ctx.base + 1.45, 40);
  }
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 30);
}

/** Bathroom: tub on the wall opposite the door, toilet and vanity with full clearances. */
export function furnishBathroom(ctx: RoomContext): void {
  const door = ctx.openings.find((o) => o.kind === "door");
  const doorSide: Side = door?.side ?? "north";
  const tubSides = [opposite(doorSide), ...ALL.filter((s) => s !== opposite(doorSide) && s !== doorSide)].filter((s) => sideLength(ctx, s) >= 1.72);
  const tub = placeRequired(ctx, tubSides.flatMap((s) => [() => placeAgainst(ctx, "bathtub", s, { at: "start", rationale: "tub in the corner opposite the door" }), () => placeAgainst(ctx, "bathtub", s, { at: "end" })]));
  check(ctx, "bathtub", Boolean(tub), tub ? `${R.clearance.tubFront} m free in front of the tub` : "the room cannot take a 170 cm tub");
  const toiletSides = ALL.filter((s) => s !== doorSide);
  const toilet = placeRequired(ctx, toiletSides.flatMap((s) => [() => placeAgainst(ctx, "toilet", s, { at: "start", rationale: "WC with 60 cm in front and 20 cm beside the bowl" }), () => placeAgainst(ctx, "toilet", s, { at: "end" })]));
  check(ctx, "toilet clearance", Boolean(toilet), toilet ? `${R.clearance.toiletFront} m in front, ${R.clearance.toiletSideFromCenter} m from the center line to obstacles` : "no valid WC position");
  const vanity = placeRequired(ctx, [doorSide, ...ALL.filter((s) => s !== doorSide)].map((s) => () => placeAgainst(ctx, "vanity_100", s, { at: "start", rationale: "vanity near the door with 70 cm in front" })));
  check(ctx, "sink clearance", Boolean(vanity), vanity ? `${R.clearance.sinkFront} m free in front of the basin` : "no vanity position");
  if (vanity) addLight(ctx, "wall", vanity.x, vanity.y, ctx.base + 1.95, 30);
  placeOptional(ctx, ALL.flatMap((s) => [() => placeAgainst(ctx, "tall_storage", s, { at: "start", rationale: "tall cabinet for towels, clear of every route" }), () => placeAgainst(ctx, "tall_storage", s, { at: "end" })]));
  placeOptional(ctx, ALL.map((s) => () => placeAgainst(ctx, "towel_ladder", s, { at: "center", gap: 0.02 })));
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2 - 0.6, ctx.rect.y + ctx.rect.h / 2, 35);
}

export function furnishGuestWc(ctx: RoomContext): void {
  const door = ctx.openings.find((o) => o.kind === "door");
  const doorSide: Side = door?.side ?? "south";
  const toilet = placeRequired(ctx, [opposite(doorSide), ...ALL].map((s) => () => placeAgainst(ctx, "toilet", s, { at: "center", rationale: "WC opposite the door" })));
  check(ctx, "toilet clearance", Boolean(toilet), toilet ? "60 cm in front of the WC" : "no WC position");
  const sideWalls = ALL.filter((s) => s !== doorSide && s !== opposite(doorSide));
  const basin = placeRequired(ctx, [...sideWalls, opposite(doorSide)].map((s) => () => placeAgainst(ctx, "basin_small", s, { at: "center", rationale: "hand basin on the side wall" })));
  check(ctx, "basin", Boolean(basin), basin ? "hand basin with 60 cm in front" : "no basin position");
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 20);
}

export function furnishUtility(ctx: RoomContext): void {
  const sides = [...ALL].sort((a, b) => sideLength(ctx, b) - sideLength(ctx, a));
  const counter = placeRequired(ctx, sides.map((s) => () => placeAgainst(ctx, "laundry_counter", s, { at: "start", rationale: "washer and dryer under a folding counter" })));
  check(ctx, "laundry", Boolean(counter), counter ? "machines have 90 cm in front" : "no laundry position");
  placeRequired(ctx, sides.map((s) => () => placeAgainst(ctx, "utility_shelf", s, { at: "start", rationale: "storage shelving" })));
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 25);
}

export function furnishEntrance(ctx: RoomContext): void {
  // Fully solid walls first; when every wall has an opening, the walls with the most free length.
  const solid = solidSides(ctx);
  const freeLength = (s: Side) => sideLength(ctx, s) - ctx.openings.filter((o) => o.side === s).reduce((sum, o) => sum + (o.to - o.from), 0);
  const walls = [...solid, ...ALL.filter((s) => !solid.includes(s)).sort((a, b) => freeLength(b) - freeLength(a))];
  const coat = placeRequired(ctx, walls.map((s) => () => placeAgainst(ctx, "coat_cabinet", s, { at: "center", rationale: "coats and shoes stored right by the door" })));
  check(ctx, "coat storage", Boolean(coat), coat ? "coat cabinet with 80 cm in front" : "no wall for coat storage");
  const bench = placeRequired(ctx, walls.filter((s) => !coat || s !== sideFacing(coat)).map((s) => () => placeAgainst(ctx, "entry_bench", s, { at: "center", rationale: "bench to sit on while taking off shoes" })));
  if (bench) {
    const F = frontDir(bench.rotation);
    commit(ctx, makePlacement(ctx, "mirror_wall", bench.x - F.x * 0.2, bench.y - F.y * 0.2, bench.rotation, { elevation: 0 })!);
  }
  const front = ctx.openings.find((o) => o.kind === "front_door");
  if (front) {
    const mid = (front.from + front.to) / 2;
    const y = front.side === "north" ? ctx.rect.y + ctx.rect.h - 0.6 : ctx.rect.y + 0.6;
    commit(ctx, makePlacement(ctx, "rug_entry", mid, y, 0)!);
  }
  hangPendant(ctx, "pendant_small", ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 2.15, 45);
}

/** Hall and corridor: kept clear, a runner rug and evenly spaced ceiling lights. */
export function furnishCirculation(ctx: RoomContext): void {
  const room = ctx.room;
  if (!room) return;
  const longest = [...room.parts].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h))[0];
  const vertical = longest.h > longest.w;
  commit(ctx, makePlacement(ctx, "runner_rug", longest.x + longest.w / 2, longest.y + longest.h / 2, vertical ? 0 : Math.PI / 2)!);
  check(ctx, "circulation width", Math.min(longest.w, longest.h) >= R.clearance.primaryCirculation, `${Math.min(longest.w, longest.h).toFixed(2)} m clear width`);
  for (const part of room.parts) {
    const len = Math.max(part.w, part.h);
    const n = Math.max(1, Math.round(len / 2.6));
    for (let i = 0; i < n; i += 1) {
      const f = (i + 0.5) / n;
      const x = part.w > part.h ? part.x + part.w * f : part.x + part.w / 2;
      const y = part.w > part.h ? part.y + part.h / 2 : part.y + part.h * f;
      const p = makePlacement(ctx, "ceiling_light", x, y, 0, { elevation: ctx.ceiling - ctx.base });
      if (p) commit(ctx, p);
      if (i % 2 === 0) addLight(ctx, "ceiling", x, y, ctx.ceiling - 0.45, 22);
    }
  }
}
