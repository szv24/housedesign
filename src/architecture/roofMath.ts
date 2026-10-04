import type { HouseModel, RoofWing } from "../model/types";

export interface WingRoofGeometry {
  wing: RoofWing;
  /** Half span perpendicular to the ridge (outer faces). */
  halfSpan: number;
  tan: number;
  /** Ridge line coordinate (y for ridge along x; x for ridge along y). */
  ridgeCoord: number;
  /** Floor-relative wall top (eave line at the inner face of the exterior walls). */
  wallTop: number;
  wallThickness: number;
  /** Floor-relative height of the roof underside at the ridge. */
  ridgeUnderside: number;
  /** Extent along the ridge (plan coordinates), including gable overhangs and extensions. */
  along: [number, number];
}

export function wingRoof(model: HouseModel, wing: RoofWing, wallThickness: number): WingRoofGeometry {
  const tan = Math.tan((model.roofPitchDeg * Math.PI) / 180);
  const r = wing.rect;
  const halfSpan = (wing.ridgeAxis === "x" ? r.h : r.w) / 2;
  const ridgeCoord = wing.ridgeAxis === "x" ? r.y + r.h / 2 : r.x + r.w / 2;
  const a0 = (wing.ridgeAxis === "x" ? r.x : r.y) - (wing.gableAtStart ? model.gableOverhang : 0) - wing.ridgeStartExtension;
  const a1 = (wing.ridgeAxis === "x" ? r.x + r.w : r.y + r.h) + (wing.gableAtEnd ? model.gableOverhang : 0) + wing.ridgeEndExtension;
  return {
    wing,
    halfSpan,
    tan,
    ridgeCoord,
    wallTop: model.wallHeight,
    wallThickness,
    ridgeUnderside: model.wallHeight + (halfSpan - wallThickness) * tan,
    along: [a0, a1]
  };
}

/** Floor-relative height of the roof underside at plan distance `u` from the ridge line. */
export function undersideAt(g: WingRoofGeometry, u: number): number {
  return g.wallTop + (g.halfSpan - g.wallThickness - u) * g.tan;
}

/** Floor-relative underside height of the roof above a plan point (the highest wing that covers it). */
export function roofUndersideAt(model: HouseModel, wallThickness: number, x: number, y: number): number {
  let best = model.wallHeight;
  for (const wing of model.roofWings) {
    const g = wingRoof(model, wing, wallThickness);
    const along = wing.ridgeAxis === "x" ? x : y;
    const across = wing.ridgeAxis === "x" ? y : x;
    if (along < g.along[0] || along > g.along[1]) continue;
    const u = Math.abs(across - g.ridgeCoord);
    if (u > g.halfSpan + model.roofOverhang) continue;
    best = Math.max(best, undersideAt(g, u));
  }
  return best;
}
