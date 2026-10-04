import { describe, expect, it } from "vitest";
import { houseSpec } from "../src/data/houseSpec";
import { buildHouseModel } from "../src/model/HouseModel";
import { InteriorDesignEngine } from "../src/interiors/InteriorDesignEngine";
import { catalogById } from "../src/interiors/FurnitureLibrary";
import { rectInside, rectsOverlap } from "../src/model/geometry2d";

describe("interior design engine", () => {
  const { model } = buildHouseModel(houseSpec);
  const { model: furnished, report } = new InteriorDesignEngine().apply(model, houseSpec);

  it("logs the design report", () => {
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.room}: ${c.rule} — ${c.detail}`);
    console.log(`passed ${report.passed}, failed ${report.failed}\n${failed.join("\n")}`);
    expect(report.checks.length).toBeGreaterThan(20);
  });

  it("places every required item of every room program", () => {
    const programs = report.checks.filter((c) => c.rule === "room program");
    expect(programs.filter((c) => !c.ok)).toEqual([]);
  });

  it("keeps blocking furniture inside its room and free of overlaps", () => {
    const solid = furnished.furniture.filter((p) => {
      const c = catalogById(p.catalogId)!;
      return p.blocksMovement && !c.flat && !c.mounted;
    });
    for (const p of solid) {
      const room = furnished.rooms.find((r) => r.id === p.roomId);
      const terrace = furnished.terraces.find((t) => t.id === p.roomId);
      const bounds = room?.bounds ?? terrace?.rect;
      expect(bounds && rectInside(p.footprint, bounds)).toBe(true);
    }
    for (let i = 0; i < solid.length; i += 1)
      for (let j = i + 1; j < solid.length; j += 1) expect(rectsOverlap(solid[i].footprint, solid[j].footprint), `${solid[i].id} / ${solid[j].id}`).toBe(false);
  });

  it("is deterministic", () => {
    const again = new InteriorDesignEngine().apply(buildHouseModel(houseSpec).model, houseSpec).model.furniture;
    expect(again.map((p) => `${p.id}@${p.x},${p.y}`)).toEqual(furnished.furniture.map((p) => `${p.id}@${p.x},${p.y}`));
  });

  it("lights every room", () => {
    for (const r of furnished.rooms) expect(furnished.lights.some((l) => l.roomId === r.id), r.id).toBe(true);
  });
});
