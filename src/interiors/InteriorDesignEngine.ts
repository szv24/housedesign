import type { HouseSpec } from "../data/houseSpec";
import { programFor } from "../data/roomDefinitions";
import type { HouseModel } from "../model/types";
import { checkReachability, createRoomContext, type RoomContext } from "./FurniturePlacer";
import { buildDesignReport, type DesignReport, type RuleCheck } from "./DesignReport";
import { furnishLivingKitchen } from "./rules/livingKitchen";
import { furnishCompactBedroom, furnishKidsRoom, furnishMasterBedroom } from "./rules/bedrooms";
import { furnishPlanKitchen, furnishPlanLiving, furnishWardrobe } from "./rules/planRooms";
import { furnishBathroom, furnishCirculation, furnishEntrance, furnishGuestWc, furnishOffice, furnishUtility } from "./rules/serviceRooms";
import { createTerraceContext, exteriorLights, furnishCompactTerrace, furnishMainTerrace, furnishPrivateTerrace } from "./rules/terraces";
import { catalogById } from "./FurnitureLibrary";

export interface InteriorDesignResult {
  model: HouseModel;
  report: DesignReport;
}

const ROOM_RULES: Record<string, (ctx: RoomContext) => void> = {
  living_kitchen: furnishLivingKitchen,
  master_bedroom: furnishMasterBedroom,
  kids_bedroom_1: (ctx) => furnishKidsRoom(ctx, "bed_single"),
  kids_bedroom_2: (ctx) => furnishKidsRoom(ctx, "bunk_bed"),
  office: furnishOffice,
  bathroom: furnishBathroom,
  guest_wc: furnishGuestWc,
  utility: furnishUtility,
  entrance: furnishEntrance,
  circulation: furnishCirculation,
  bedroom_sw: furnishCompactBedroom,
  bedroom_nw: furnishCompactBedroom,
  bedroom_ne: furnishCompactBedroom,
  kitchen: furnishPlanKitchen,
  living: furnishPlanLiving,
  wardrobe: furnishWardrobe
};

/**
 * Furnishes every room and terrace from explicit spatial rules (see data/designRules.ts and
 * interiors/rules/*). Deterministic: the same HouseModel always yields the same layout.
 */
export class InteriorDesignEngine {
  apply(model: HouseModel, spec: HouseSpec): InteriorDesignResult {
    const checks: RuleCheck[] = [];
    model.furniture = [];
    model.lights = [];

    const collect = (ctx: RoomContext, runReachability: boolean) => {
      if (runReachability) checkReachability(ctx);
      const program = programFor(ctx.id);
      const compactTerrace = ctx.id === "main_terrace" && ctx.rect.w * ctx.rect.h < 22;
      if (program && !compactTerrace) {
        const missing = program.required.filter((id) => !ctx.placed.some((p) => p.catalogId === id));
        ctx.checks.push({
          room: ctx.id,
          rule: "room program",
          ok: missing.length === 0,
          detail: missing.length === 0 ? "all required furniture placed" : `missing: ${missing.map((m) => catalogById(m)?.name ?? m).join(", ")}`
        });
      }
      model.furniture.push(...ctx.placed);
      model.lights.push(...ctx.lights);
      checks.push(...ctx.checks);
    };

    for (const room of model.rooms) {
      const ctx = createRoomContext(model, spec, room, model.floorLevel + room.ceilingHeight);
      ROOM_RULES[room.id]?.(ctx);
      collect(ctx, room.id !== "circulation");
    }

    for (const t of model.terraces) {
      const ctx = createTerraceContext(model, spec, t);
      if (t.id === "main_terrace" && t.area >= 22) furnishMainTerrace(ctx, t);
      else if (t.id === "main_terrace") furnishCompactTerrace(ctx);
      else furnishPrivateTerrace(ctx);
      collect(ctx, false);
    }

    const site = createTerraceContext(model, spec, { ...model.terraces[0], id: "site", name: "Site", deckHeight: 0, rect: model.bounds, privacyScreens: [], steps: [] });
    site.base = 0;
    exteriorLights(model, site);
    collect(site, false);

    return { model, report: buildDesignReport(checks) };
  }
}
