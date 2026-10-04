import { houseSpec, type HouseSpec } from "../data/houseSpec";
import { solveRooms } from "./LayoutSolver";
import { buildFootprint, resolveWalls } from "./WallResolver";
import { resolveTerraces } from "./TerraceResolver";
import type { HouseModel, Rect, RoofWing } from "./types";
import { boundsOfPoints, boundsOfRects, polygonArea, round } from "./geometry2d";
import { validateHouseModel, type ValidationIssue } from "./validate";

export interface BuildResult {
  model: HouseModel;
  issues: ValidationIssue[];
}

function buildRoofWings(spec: HouseSpec): RoofWing[] {
  const b = spec.building;
  if (spec.massing === "gable") {
    const main: RoofWing = {
      id: "main",
      rect: { x: 0, y: 0, w: b.overallWidth, h: b.socialWingDepth },
      ridgeAxis: "x",
      ridgeStartExtension: 0,
      ridgeEndExtension: 0,
      gableAtStart: true,
      gableAtEnd: true
    };
    const front = spec.frontGable;
    if (!front) return [main];
    // A narrow cross-gable on the south slope. Its ridge runs north into the main roof and stops in a valley.
    return [
      main,
      {
        id: "front",
        rect: { x: front.x, y: -0.02, w: front.width, h: 0.02 },
        ridgeAxis: "y",
        ridgeStartExtension: 0,
        ridgeEndExtension: b.socialWingDepth / 2,
        gableAtStart: true,
        gableAtEnd: false
      }
    ];
  }
  const social: Rect = { x: 0, y: b.privateWingLength, w: b.overallWidth, h: b.socialWingDepth };
  const priv: Rect = { x: 0, y: 0, w: b.privateWingWidth, h: b.privateWingLength };
  return [
    { id: "social", rect: social, ridgeAxis: "x", ridgeStartExtension: 0, ridgeEndExtension: 0, gableAtStart: true, gableAtEnd: true },
    // The private wing's roof runs on into the social wing until its ridge meets the social roof (valley).
    { id: "private", rect: priv, ridgeAxis: "y", ridgeStartExtension: 0, ridgeEndExtension: b.privateWingWidth / 2, gableAtStart: true, gableAtEnd: false }
  ];
}

/**
 * Resolves the declarative house specification into the concrete HouseModel that every
 * consumer (3D generators, floor plan, collision, interior engine) reads.
 * Furniture and lights are filled in afterwards by the InteriorDesignEngine.
 */
export function buildHouseModel(spec: HouseSpec = houseSpec): BuildResult {
  const { rooms, issues: layoutIssues } = solveRooms(spec);
  const { walls, issues: wallIssues } = resolveWalls(spec, rooms);
  const { terraces, issues: terraceIssues } = resolveTerraces(spec, rooms);
  const footprint = buildFootprint(spec);

  const plan = boundsOfRects([boundsOfPoints(footprint), ...terraces.map((t) => t.rect), ...terraces.flatMap((t) => t.steps)]);
  const model: HouseModel = {
    footprint,
    rooms,
    walls,
    terraces,
    roofWings: buildRoofWings(spec),
    furniture: [],
    lights: [],
    floorLevel: spec.building.floorLevel,
    wallHeight: spec.building.wallHeight,
    roofPitchDeg: spec.building.roofPitchDeg,
    roofOverhang: spec.building.roofOverhang,
    gableOverhang: spec.building.gableOverhang,
    northAngleDeg: spec.site.northAngleDeg,
    bounds: plan,
    meta: {
      grossArea: round(polygonArea(footprint), 1),
      interiorArea: round(rooms.reduce((s, r) => s + r.area, 0), 1)
    }
  };

  const issues: ValidationIssue[] = [
    ...layoutIssues.map((i) => ({ severity: "error" as const, message: i.message })),
    ...wallIssues.map((i) => ({ severity: "error" as const, message: i.message })),
    ...terraceIssues.map((m) => ({ severity: "warning" as const, message: m })),
    ...validateHouseModel(model, spec)
  ];
  return { model, issues };
}
