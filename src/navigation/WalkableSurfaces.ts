import type { HouseModel, Rect, Vec2 } from "../model/types";
import { pointInPolygon, rectContains } from "../model/geometry2d";
import type { EnvironmentResult } from "../scene/Environment";

/** Height of the walkable surface under a plan point: floor, terrace decks, steps, landing, ground. */
export class WalkableSurfaces {
  private surfaces: Array<{ rect: Rect; height: number }> = [];

  constructor(private readonly model: HouseModel, env: EnvironmentResult) {
    for (const t of model.terraces) {
      this.surfaces.push({ rect: t.rect, height: t.deckHeight });
      for (const s of t.steps) this.surfaces.push({ rect: s, height: t.deckHeight / 2 });
    }
    this.surfaces.push(...env.surfaces);
  }

  heightAt(p: Vec2): number {
    if (pointInPolygon(p, this.model.footprint)) return this.model.floorLevel;
    let h = 0;
    for (const s of this.surfaces) if (rectContains(s.rect, p, 0.02)) h = Math.max(h, s.height);
    return h;
  }
}
