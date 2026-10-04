import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import type { HouseModel } from "../model/types";
import type { MaterialRegistry } from "../scene/Materials";
import { generateRooms } from "./RoomGenerator";
import { generateWalls } from "./WallGenerator";
import { generateWindows } from "./WindowGenerator";
import { generateDoors, type DoorRecord } from "./DoorGenerator";
import { generateCollarTies, generateRoof } from "./RoofGenerator";
import { generateTerraces } from "./TerraceGenerator";
import { generateFurniture } from "./FurnitureGenerator";

export interface GeneratedHouse {
  root: THREE.Group;
  doors: DoorRecord[];
  parts: {
    walls: THREE.Group;
    roof: THREE.Group;
    ceilings: THREE.Group;
    furniture: THREE.Group;
    windows: THREE.Group;
  };
}

/** Turns a resolved (and furnished) HouseModel into the 3D house. */
export function generateHouse(model: HouseModel, spec: HouseSpec, mats: MaterialRegistry, overrideIds: Set<string> = new Set()): GeneratedHouse {
  const root = new THREE.Group();
  root.name = "house";
  const { floors, ceilings } = generateRooms(model, spec, mats);
  const walls = generateWalls(model, spec, mats);
  const windows = generateWindows(model, mats);
  const { group: doorsGroup, doors } = generateDoors(model, mats);
  const roof = generateRoof(model, spec, mats);
  roof.add(generateCollarTies(model, spec, mats));
  const terraces = generateTerraces(model, mats);
  const furniture = generateFurniture(model, mats, overrideIds);
  root.add(floors, ceilings, walls, windows, doorsGroup, roof, terraces, furniture);
  return { root, doors, parts: { walls, roof, ceilings, furniture, windows } };
}

/** Frees GPU memory of a generated subtree (materials are shared and kept). */
export function disposeObject(obj: THREE.Object3D): void {
  const seen = new Set<THREE.BufferGeometry>();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
  });
}
