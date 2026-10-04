import type { HouseSpec } from "../data/houseSpec";
import type { Room, Terrace } from "./types";
import { round } from "./geometry2d";

export function resolveTerraces(spec: HouseSpec, rooms: Room[]): { terraces: Terrace[]; issues: string[] } {
  const b = spec.building;
  const ts = spec.terraces;
  const issues: string[] = [];
  const terraces: Terrace[] = [];
  const step = ts.stepDepth;

  // Family plan: the 15 m² ceramic terrace is centered on the east facade, as deep as the living room.
  if (spec.terraces.main.side === "east") {
    const living = rooms.find((r) => r.id === "living");
    const height = round(living ? living.bounds.y + living.bounds.h : b.socialWingDepth / 2, 3);
    const depth = round(15 / height, 3);
    const main = { x: round(b.overallWidth), y: round((b.socialWingDepth - height) / 2, 3), w: depth, h: height };
    terraces.push({
      id: "main_terrace",
      name: "Terrace",
      rect: main,
      deckHeight: ts.main.deckHeight,
      area: round(main.w * main.h, 2),
      privacyScreens: [],
      steps: [
        { x: main.x, y: main.y - step, w: main.w, h: step },
        { x: main.x + main.w, y: main.y, w: step, h: main.h }
      ]
    });
  } else if (spec.massing === "gable") {
    const depth = b.terraceDepth;
    const length = Math.min(b.terraceLength, b.overallWidth - b.privateWingWidth);
    const main = { x: round(b.privateWingWidth), y: round(-depth), w: round(length), h: round(depth) };
    const bed = { x: round(b.exteriorWallThickness + 0.3), y: round(-1.05), w: round(Math.max(1, b.privateWingWidth - b.exteriorWallThickness - 0.8)), h: 0.95 };
    const pergolaLength = Math.min(ts.main.pergolaLength, length);
    terraces.push({
      id: "main_terrace",
      name: "Garden terrace",
      rect: main,
      deckHeight: ts.main.deckHeight,
      area: round(main.w * main.h, 2),
      pergola: { x: main.x, y: main.y, w: pergolaLength, h: main.h },
      privacyScreens: [],
      plantingBuffer: bed,
      steps: [
        { x: main.x, y: main.y - step, w: main.w, h: step },
        { x: main.x + main.w, y: main.y, w: step, h: main.h }
      ]
    });
  } else {
  // Main terrace: inside the L, against the living room's south facade, offset from the bedroom wing.
  const x0 = b.privateWingWidth + b.terraceBedroomBuffer;
  const maxLength = b.overallWidth - x0;
  const length = Math.min(b.terraceLength, maxLength);
  if (b.terraceLength > maxLength + 1e-6) issues.push(`Main terrace length clamped to ${maxLength.toFixed(2)} m (facade ends)`);
  const depth = b.terraceDepth;
  const main = { x: round(x0), y: round(b.privateWingLength - depth), w: round(length), h: round(depth) };
  const pergolaLength = Math.min(ts.main.pergolaLength, length);
  const screenLength = Math.min(ts.main.screenLength, depth);
  terraces.push({
    id: "main_terrace",
    name: "Main Terrace",
    rect: main,
    deckHeight: ts.main.deckHeight,
    area: round(main.w * main.h, 2),
    pergola: { x: main.x, y: main.y, w: pergolaLength, h: main.h },
    privacyScreens: [
      { start: { x: main.x + 0.05, y: main.y + main.h - screenLength }, end: { x: main.x + 0.05, y: main.y + main.h }, height: ts.main.screenHeight }
    ],
    plantingBuffer: { x: b.privateWingWidth, y: main.y, w: b.terraceBedroomBuffer, h: main.h },
    steps: [
      { x: main.x, y: main.y - step, w: main.w, h: step },
      { x: main.x + main.w, y: main.y - step, w: step, h: main.h + step }
    ]
  });
  }

  // Master bedroom's private terrace on the west facade.
  const master = rooms.find((r) => r.id === "master_bedroom");
  if (master) {
    const p = ts.masterPrivate;
    const y0 = master.bounds.y + p.at;
    const r = { x: round(-p.depth), y: round(y0), w: p.depth, h: p.length };
    if (y0 + p.length > master.bounds.y + master.bounds.h + 1e-6) issues.push("Private terrace extends past the master bedroom facade");
    terraces.push({
      id: "master_private_terrace",
      name: "Private Terrace",
      rect: r,
      deckHeight: p.deckHeight,
      area: round(r.w * r.h, 2),
      privacyScreens: [
        { start: { x: r.x, y: r.y + 0.04 }, end: { x: 0, y: r.y + 0.04 }, height: p.screenHeight },
        { start: { x: r.x + 0.04, y: r.y }, end: { x: r.x + 0.04, y: r.y + r.h * 0.55 }, height: p.screenHeight }
      ],
      steps: [{ x: r.x - step, y: r.y + r.h * 0.55, w: step, h: r.h * 0.45 }]
    });
  }
  return { terraces, issues };
}
