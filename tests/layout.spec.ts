import { describe, expect, it } from "vitest";
import { cloneSpec, houseSpec } from "../src/data/houseSpec";
import { familyPlanSpec, gardenGableSpec } from "../src/data/houses";
import { buildHouseModel } from "../src/model/HouseModel";
import { reachableRooms } from "../src/model/validate";
import { InteriorDesignEngine } from "../src/interiors/InteriorDesignEngine";
import { rectsOverlap } from "../src/model/geometry2d";

describe("house model", () => {
  const { model, issues } = buildHouseModel(houseSpec);

  it("resolves without errors", () => {
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("contains every required room", () => {
    const ids = model.rooms.map((r) => r.id).sort();
    expect(ids).toEqual(
      ["bathroom", "circulation", "entrance", "guest_wc", "kids_bedroom_1", "kids_bedroom_2", "living_kitchen", "master_bedroom", "office", "utility"].sort()
    );
  });

  it("keeps the net interior area in the 130–170 m² envelope", () => {
    expect(model.meta.interiorArea).toBeGreaterThan(130);
    expect(model.meta.interiorArea).toBeLessThan(170);
  });

  it("rooms do not overlap", () => {
    const parts = model.rooms.flatMap((r) => r.parts.map((p) => ({ id: r.id, p })));
    for (let i = 0; i < parts.length; i += 1)
      for (let j = i + 1; j < parts.length; j += 1)
        if (parts[i].id !== parts[j].id) expect(rectsOverlap(parts[i].p, parts[j].p)).toBe(false);
  });

  it("every room is reachable from the entrance", () => {
    const reach = reachableRooms(model, houseSpec);
    for (const r of model.rooms) expect(reach.has(r.id)).toBe(true);
  });

  it("binds every exterior opening to a wall", () => {
    const bound = model.walls.flatMap((w) => w.openings.map((o) => o.id));
    for (const o of houseSpec.openings) expect(bound).toContain(o.id);
  });

  it("main terrace sits in the 30–45 m² range and the private terrace in 5–8 m²", () => {
    const main = model.terraces.find((t) => t.id === "main_terrace")!;
    const priv = model.terraces.find((t) => t.id === "master_private_terrace")!;
    expect(main.area).toBeGreaterThanOrEqual(30);
    expect(main.area).toBeLessThanOrEqual(45);
    expect(priv.area).toBeGreaterThanOrEqual(5);
    expect(priv.area).toBeLessThanOrEqual(8);
  });

  it("regenerates when a room size changes", () => {
    const spec = cloneSpec();
    const before = model.rooms.find((r) => r.id === "master_bedroom")!.area;
    const first = spec.layout.privateWing.children[0];
    first.size = (first.size as number) + 0.4;
    const after = buildHouseModel(spec).model.rooms.find((r) => r.id === "master_bedroom")!.area;
    expect(after).toBeGreaterThan(before + 1.5);
  });
});

describe("garden gable cottage", () => {
  const { model, issues } = buildHouseModel(gardenGableSpec);

  it("resolves without errors", () => {
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
  });

  it("is a single rectangle, not the courtyard L", () => {
    expect(model.footprint).toHaveLength(4);
    expect(model.meta.grossArea).toBeGreaterThan(180);
    expect(model.meta.interiorArea).toBeGreaterThan(140);
    expect(model.meta.interiorArea).toBeLessThan(180);
  });

  it("keeps every room reachable and both terraces", () => {
    const reach = reachableRooms(model, gardenGableSpec);
    for (const r of model.rooms) expect(reach.has(r.id), r.id).toBe(true);
    expect(model.terraces.map((t) => t.id).sort()).toEqual(["main_terrace", "master_private_terrace"]);
  });

  it("furnishes the cottage without dropping a required piece", () => {
    const { report } = new InteriorDesignEngine().apply(model, gardenGableSpec);
    const programs = report.checks.filter((c) => c.rule === "room program" && !c.ok);
    expect(programs, programs.map((c) => c.detail).join("\n")).toEqual([]);
  });

  it("places the garden terrace on the south front", () => {
    const main = model.terraces.find((t) => t.id === "main_terrace")!;
    expect(main.rect.y).toBeLessThan(0);
    expect(main.area).toBeGreaterThan(28);
  });
});

describe("family plan", () => {
  const { model, issues } = buildHouseModel(familyPlanSpec);

  it("resolves the 14.2 × 8.4 m plan without errors", () => {
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
    const xs = model.footprint.map((p) => p.x);
    const ys = model.footprint.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(14.2, 2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8.4, 2);
  });

  it("keeps every room reachable and the terrace at 15 m² on the east", () => {
    const reach = reachableRooms(model, familyPlanSpec);
    for (const r of model.rooms) expect(reach.has(r.id), r.id).toBe(true);
    const terrace = model.terraces.find((t) => t.id === "main_terrace")!;
    expect(terrace.rect.x).toBeGreaterThanOrEqual(14.2);
    expect(terrace.area).toBeCloseTo(15, 1);
    // Centered on the east facade.
    expect(terrace.rect.y + terrace.rect.h / 2).toBeCloseTo(8.4 / 2, 2);
    expect(model.terraces.some((t) => t.id === "master_private_terrace")).toBe(false);
  });

  it("opens the kitchen to the living room and closes the entrance's east wall", () => {
    expect(model.walls.some((w) => w.id.startsWith("part_kitchen__living"))).toBe(false);
    const entranceWall = model.walls.find((w) => w.id.startsWith("part_entrance__kitchen"))!;
    expect(entranceWall.openings.map((o) => o.kind)).toEqual(["cased_opening"]);
    expect(model.northAngleDeg).toBe(180);
  });

  it("furnishes the plan: L-shaped counter with sink, L-shaped sofa and TV, every program complete", () => {
    const { model: furnished, report } = new InteriorDesignEngine().apply(model, familyPlanSpec);
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.room}: ${c.rule} — ${c.detail}`);
    expect(failed).toEqual([]);
    const ids = (room: string) => furnished.furniture.filter((p) => p.roomId === room).map((p) => p.catalogId);
    expect(ids("kitchen")).toEqual(expect.arrayContaining(["sink_cabinet", "cooktop_cabinet", "dining_table_8", "dining_chair"]));
    expect(ids("living")).toEqual(expect.arrayContaining(["media_sideboard", "sofa_3s", "sofa_corner"]));
    expect(ids("guest_wc")).toContain("basin_small");
    expect(ids("entrance")).toContain("entry_bench");
  });
});
