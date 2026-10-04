import * as THREE from "three";
import type { HouseModel } from "../model/types";
import type { MaterialRegistry } from "../scene/Materials";
import { catalogById } from "../interiors/FurnitureLibrary";
import { MeshBuilder } from "./MeshBuilder";

/**
 * Builds all furniture as one static batch (one mesh per material). Items whose catalog id is in
 * `separate` are built as individual objects instead, so a GLB override can replace them.
 */
export function generateFurniture(model: HouseModel, mats: MaterialRegistry, separate: Set<string> = new Set()): THREE.Group {
  const group = new THREE.Group();
  group.name = "furniture";
  const batch = new MeshBuilder(mats);
  const m = new THREE.Matrix4();

  for (const p of model.furniture) {
    const item = catalogById(p.catalogId);
    if (!item) continue;
    m.makeRotationY(p.rotation).setPosition(p.x, p.elevation, -p.y);
    if (separate.has(p.catalogId)) {
      const mb = new MeshBuilder(mats);
      item.builder(mb, item.width, item.depth, p.height);
      const obj = mb.build(p.catalogId);
      obj.applyMatrix4(m);
      obj.userData = { furnitureId: p.id, catalogId: p.catalogId, roomId: p.roomId, separate: true };
      group.add(obj);
      continue;
    }
    batch.transform = m;
    item.builder(batch, item.width, item.depth, p.height);
  }
  batch.transform = null;
  group.add(batch.build("furnitureBatch"));
  return group;
}
