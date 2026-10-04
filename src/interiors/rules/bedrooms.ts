import type { FurniturePlacement, Side } from "../../model/types";
import {
  R,
  addLight,
  ceilingLight,
  check,
  commit,
  frontDir,
  makePlacement,
  opposite,
  placeAgainst,
  placeOptional,
  placeRequired,
  sideGeometry,
  stringLights,
  tryPlace,
  type RoomContext
} from "../FurniturePlacer";

/** Free stretches along a side that are not doors or windows (absolute along-coordinates). */
function freeStretches(ctx: RoomContext, side: Side, margin = 0.05): Array<[number, number]> {
  const g = sideGeometry(ctx.rect, side);
  const blocked = ctx.openings.filter((o) => o.side === side).map((o) => [o.from - margin, o.to + margin] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cur = g.lo;
  for (const [a, b] of blocked) {
    if (a > cur) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < g.hi) out.push([cur, g.hi]);
  return out;
}

function longestStretch(ctx: RoomContext, side: Side): [number, number] {
  return freeStretches(ctx, side).reduce((best, s) => (s[1] - s[0] > best[1] - best[0] ? s : best), [0, 0] as [number, number]);
}

/**
 * Master bedroom: headboard against the longest window-free wall, symmetric nightstands,
 * both sides accessible, wardrobe on a free wall that keeps its door-front clear.
 */
export function furnishMasterBedroom(ctx: RoomContext): void {
  const bedW = 1.76;
  const nightstandW = 0.45;
  const sides: Side[] = (["north", "east", "south", "west"] as Side[])
    .map((s) => ({ s, len: longestStretch(ctx, s)[1] - longestStretch(ctx, s)[0] }))
    .filter((c) => c.len >= bedW + 2 * nightstandW + 0.1)
    .sort((a, b) => b.len - a.len)
    .map((c) => c.s);

  // The headboard wall is decided first; the wardrobe takes another wall; then the bed is
  // centered in what remains, so its side and foot clearances stay intact.
  const headWall = sides[0];
  let wardrobe: FurniturePlacement | null = null;
  if (headWall) {
    const wardrobeSides = (["east", "west", "south", "north"] as Side[]).filter((s) => s !== headWall);
    wardrobe = placeRequired(
      ctx,
      wardrobeSides.flatMap((side) =>
        freeStretches(ctx, side)
          .filter(([a, b]) => b - a >= 2.0)
          .map(([a, b]) => () => placeAgainst(ctx, "wardrobe_200", side, { range: [a, b], at: "start", rationale: "wardrobe on a window-free wall, doors open into free floor" }))
      )
    );
  }
  check(ctx, "wardrobe access", Boolean(wardrobe), wardrobe ? `${R.clearance.wardrobeFront} m free in front of the wardrobe` : "no wall long enough for a 2 m wardrobe");

  let bed: FurniturePlacement | null = null;
  for (const side of sides) {
    const [a, b] = longestStretch(ctx, side);
    bed = placeRequired(ctx, [
      () =>
        placeAgainst(ctx, "bed_double", side, {
          range: [a + nightstandW, b - nightstandW],
          at: "center",
          rationale: `headboard on the ${side} wall: no window behind the bed, view toward the garden`
        })
    ]);
    if (bed) break;
  }
  check(ctx, "bed with access on both sides", Boolean(bed), bed ? `${R.clearance.bedSide} m kept on both sides, ${R.clearance.bedFoot} m at the foot` : "no wall can take the bed");
  if (!bed) return;

  const F = frontDir(bed.rotation);
  const W = { x: -F.y, y: F.x };
  const backOffset = bed.depth / 2 - 0.2;
  for (const s of [1, -1]) {
    const cx = bed.x + W.x * s * (bed.width / 2 + nightstandW / 2 + 0.02) - F.x * backOffset;
    const cy = bed.y + W.y * s * (bed.width / 2 + nightstandW / 2 + 0.02) - F.y * backOffset;
    const ns = tryPlace(ctx, "nightstand", cx, cy, bed.rotation, { allowIn: [bed.id], rationale: "nightstands flank the bed" });
    if (ns) {
      commit(ctx, makePlacement(ctx, "table_lamp", ns.x, ns.y, ns.rotation, { elevation: 0.5 })!);
      addLight(ctx, "table_lamp", ns.x, ns.y, ctx.base + 1.1, 28);
    }
  }

  const footX = bed.x + F.x * (bed.depth / 2 + 0.22);
  const footY = bed.y + F.y * (bed.depth / 2 + 0.22);
  placeOptional(ctx, [() => tryPlace(ctx, "bench_bed", footX, footY, bed!.rotation, { allowIn: [bed!.id], rationale: "bench at the foot of the bed" })]);
  commit(ctx, makePlacement(ctx, "rug_bed", bed.x + F.x * 0.55, bed.y + F.y * 0.55, bed.rotation)!);

  // Reading chair by a window, only if it keeps every route open.
  placeOptional(ctx, (["south", "west", "east"] as Side[]).map((side) => () => placeAgainst(ctx, "armchair_reading", side, { at: "start", rationale: "reading corner in daylight" })));
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 30);
}

/** A modest bedroom from the measured plan: a single bed and a wardrobe on the remaining walls. */
export function furnishCompactBedroom(ctx: RoomContext): void {
  const door = ctx.openings.find((o) => o.kind === "door" || o.kind === "front_door");
  const order = (["north", "south", "west", "east"] as Side[]).filter((s) => s !== door?.side);
  const bed = placeRequired(ctx, order.map((s) => () => placeAgainst(ctx, "bed_single", s, { at: "center", rationale: "single bed on the quiet wall" })));
  check(ctx, "bed", Boolean(bed), bed ? "single bed placed" : "no bed position");
  if (bed) {
    const F = frontDir(bed.rotation);
    tryPlace(ctx, "nightstand", bed.x + F.x * 0.15 + (bed.rotation === 0 || bed.rotation === Math.PI ? 0.7 : 0), bed.y + F.y * 0.15, bed.rotation, { allowIn: [bed.id] });
  }
  placeOptional(ctx, order.map((s) => () => placeAgainst(ctx, "wardrobe_100", s, { at: "end", rationale: "wardrobe clear of the door" })));
  ceilingLight(ctx, ctx.rect.x + ctx.rect.w / 2, ctx.rect.y + ctx.rect.h / 2, 22);
}

/**
 * Children's room: bed with its long side against the solid wall farthest from the door,
 * desk perpendicular to the window (side light) on the other solid wall, wardrobe near the door.
 */
export function furnishKidsRoom(ctx: RoomContext, bedId: "bed_single" | "bunk_bed"): void {
  const r = ctx.rect;
  const door = ctx.openings.find((o) => o.kind === "door");
  const win = ctx.openings.find((o) => o.kind === "window");
  const windowSide: Side = win?.side ?? "east";
  const doorSide: Side = door?.side ?? opposite(windowSide);
  const perpendicular: Side[] = windowSide === "east" || windowSide === "west" ? ["north", "south"] : ["east", "west"];
  const doorAlong = door ? (door.from + door.to) / 2 : 0;
  // Bed on the perpendicular wall farther from the door.
  const distTo = (s: Side) => {
    const g = sideGeometry(r, s);
    return Math.abs(g.wall - doorAlong);
  };
  const [bedSideWall, deskSideWall] = [...perpendicular].sort((a, b) => distTo(b) - distTo(a));

  // Bed: long side against the wall, head toward the window corner.
  const item = bedId === "bunk_bed" ? { w: 1.0, d: 2.08 } : { w: 0.98, d: 2.06 };
  const g = sideGeometry(r, bedSideWall);
  const wallOffset = g.wall + g.inward * (item.w / 2 + 0.01);
  const winG = sideGeometry(r, windowSide);
  const headTowardWindow = winG.wall > (g.alongX ? r.x + r.w / 2 : r.y + r.h / 2) ? 1 : -1;
  // Foot points away from the window wall.
  const rot = g.alongX ? (headTowardWindow > 0 ? -Math.PI / 2 : Math.PI / 2) : headTowardWindow > 0 ? 0 : Math.PI;
  let bed: FurniturePlacement | null = null;
  for (let k = 0; k < 30 && !bed; k += 1) {
    const along = winG.wall - headTowardWindow * (item.d / 2 + 0.01 + k * 0.05);
    const x = g.alongX ? along : wallOffset;
    const y = g.alongX ? wallOffset : along;
    bed = tryPlace(ctx, bedId, x, y, rot, { rationale: "bed along the quiet wall, head toward the window corner" });
  }
  check(ctx, "bed placement", Boolean(bed), bed ? "long side against the wall, approach from the room" : "bed could not be placed");

  // Desk on the other perpendicular wall at the window end: daylight from the side.
  const deskG = sideGeometry(r, deskSideWall);
  const desk = placeAgainst(ctx, "desk_kids", deskSideWall, { at: winG.wall > (deskG.lo + deskG.hi) / 2 ? "end" : "start", rationale: "desk perpendicular to the window: side light, no glare on the screen" });
  check(ctx, "desk daylight", Boolean(desk), desk ? "desk perpendicular to the window" : "no desk position");
  if (desk) {
    const F = frontDir(desk.rotation);
    tryPlace(ctx, "desk_chair_kids", desk.x + F.x * (desk.depth / 2 + 0.24), desk.y + F.y * (desk.depth / 2 + 0.24), desk.rotation + Math.PI, { allowIn: [desk.id] });
    commit(ctx, makePlacement(ctx, "table_lamp", desk.x - 0.35 * Math.cos(desk.rotation), desk.y - 0.35 * Math.sin(desk.rotation), desk.rotation, { elevation: 0.72 })!);
    addLight(ctx, "table_lamp", desk.x, desk.y, ctx.base + 1.05, 18);
  }

  // Wardrobe on the door wall, away from the door swing.
  const wd = placeRequired(ctx, [doorSide, opposite(windowSide), windowSide].map((s) => () => placeAgainst(ctx, "wardrobe_100", s, { at: "center", rationale: "wardrobe beside the door, clear of the swing" })));
  check(ctx, "wardrobe access", Boolean(wd), wd ? "wardrobe front kept free" : "no wardrobe position");
  placeOptional(ctx, [() => placeAgainst(ctx, "bookshelf_low", deskSideWall, { at: "center" })]);
  placeOptional(ctx, [() => placeAgainst(ctx, "toy_box", windowSide, { at: "center" })]);
  commit(ctx, makePlacement(ctx, "rug_round", r.x + r.w / 2, r.y + r.h / 2, 0)!);

  // Fairy lights above the bed: a soft catenary along the wall.
  if (bed) {
    const z = ctx.base + (bedId === "bunk_bed" ? 2.2 : 1.6);
    const wallLine = g.wall + g.inward * 0.04;
    const a = bed.footprint;
    const [lo, hi] = g.alongX ? [a.x, a.x + a.w] : [a.y, a.y + a.h];
    const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => {
      const s = lo + (hi - lo) * f;
      const sag = Math.sin(f * Math.PI * 2.5) ** 2 * 0.1;
      return g.alongX ? { x: s, y: wallLine, z: z - sag } : { x: wallLine, y: s, z: z - sag };
    });
    stringLights(ctx, pts, 28, 14, g.alongX ? { x: 0, y: g.inward * 0.8 } : { x: g.inward * 0.8, y: 0 });
  }
  ceilingLight(ctx, r.x + r.w / 2, r.y + r.h / 2, 25);
}
