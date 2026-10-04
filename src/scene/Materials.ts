import * as THREE from "three";
import type { HouseSpec } from "../data/houseSpec";
import { TextureFactory } from "./TextureFactory";

/** Every material in the scene, keyed by a stable id. Geometry builders refer to these keys only. */
export type MatKey =
  // exterior
  | "cladding"
  | "cornerBoard"
  | "trim"
  | "roofMetal"
  | "fascia"
  | "soffit"
  | "windowFrame"
  | "glass"
  | "deck"
  | "plinth"
  | "brick"
  | "concrete"
  | "screenTimber"
  // interior architecture
  | "plaster"
  | "ceiling"
  | "timberCeiling"
  | "oakFloor"
  | "tileFloor"
  | "tileWall"
  | "slateFloor"
  | "partition"
  // furniture
  | "oak"
  | "oakDark"
  | "whiteLacquer"
  | "linen"
  | "wool"
  | "fjordFabric"
  | "sageFabric"
  | "duvet"
  | "cushionAccent"
  | "rug"
  | "metalBlack"
  | "steel"
  | "ceramic"
  | "mirror"
  | "stone"
  | "stoveBlack"
  | "fire"
  | "lampShade"
  | "bulb"
  | "skylight"
  | "leaf"
  | "pot"
  | "book"
  | "outdoorFabric"
  // landscape
  | "grass"
  | "gravel"
  | "paver"
  | "asphalt"
  | "soil"
  | "hedge"
  | "birchBark"
  | "bark"
  | "birchLeaf"
  | "spruce"
  | "appleLeaf"
  | "boulder";

export type MaterialRegistry = Record<MatKey, THREE.MeshStandardMaterial>;

/** Materials whose emissive intensity is driven by the interior lighting level. */
export const EMISSIVE_KEYS: MatKey[] = ["lampShade", "bulb", "fire"];

/** Wall materials that can be cut (section) or faded in presentation modes. */
export const WALL_KEYS: MatKey[] = ["cladding", "cornerBoard", "trim", "plaster", "partition", "tileWall"];

function std(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });
}

const maps = {
  vertical: null as THREE.CanvasTexture | null,
  lap: null as THREE.CanvasTexture | null,
  seam: null as THREE.CanvasTexture | null,
  tiles: null as THREE.CanvasTexture | null,
  concrete: null as THREE.CanvasTexture | null,
  deck: null as THREE.CanvasTexture | null
};

export function createMaterialRegistry(spec: HouseSpec): MaterialRegistry {
  const ext = spec.style.exteriorPalette;
  const int = spec.style.interiorPalette;

  maps.vertical = TextureFactory.cladding();
  maps.lap = TextureFactory.lapSiding();
  maps.seam = TextureFactory.standingSeam();
  maps.tiles = TextureFactory.roofTiles();
  const cladding = maps.vertical;
  const oakFloor = TextureFactory.oakFloor();
  const wood = TextureFactory.woodGrain();
  const plaster = TextureFactory.plaster();
  const seam = maps.seam;
  const ceilingBoards = TextureFactory.ceilingBoards();
  const deck = TextureFactory.deck();
  maps.deck = deck;
  const fabric = TextureFactory.fabric();
  const grass = TextureFactory.grass();
  const gravel = TextureFactory.gravel();
  const concrete = TextureFactory.concrete();
  maps.concrete = concrete;
  const tileFloor = TextureFactory.tiles(2, 2, "#b9b6b0", 236);
  const tileWall = TextureFactory.tiles(4, 8, "#d8d6d2", 246);
  const slate = TextureFactory.tiles(3, 3, "#3a3a3a", 120);
  grass.repeat.set(0.25, 0.25);
  gravel.repeat.set(0.5, 0.5);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdfeaf0,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    envMapIntensity: 1.4,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const reg: MaterialRegistry = {
    cladding: std({ color: ext.cladding, map: cladding, roughness: 0.82 }),
    cornerBoard: std({ color: ext.claddingShadow, map: wood, roughness: 0.8 }),
    trim: std({ color: ext.trim, roughness: 0.7 }),
    roofMetal: std({ color: ext.roof, map: seam, roughness: 0.48, metalness: 0.55 }),
    fascia: std({ color: ext.roof, roughness: 0.55, metalness: 0.4 }),
    soffit: std({ color: "#c79d70", map: ceilingBoards, roughness: 0.75 }),
    windowFrame: std({ color: ext.windowFrame, roughness: 0.45, metalness: 0.35 }),
    glass,
    deck: std({ color: ext.deck, map: deck, roughness: 0.82 }),
    plinth: std({ color: ext.plinth, map: concrete, roughness: 0.95 }),
    brick: std({ color: "#9a4036", map: concrete, roughness: 0.9 }),
    concrete: std({ color: "#b9b6b0", map: concrete, roughness: 0.92 }),
    screenTimber: std({ color: "#9a7652", map: wood, roughness: 0.8 }),

    plaster: std({ color: int.plaster, map: plaster, roughness: 0.95 }),
    ceiling: std({ color: "#f7f4ee", map: plaster, roughness: 0.95 }),
    timberCeiling: std({ color: "#d9b88f", map: ceilingBoards, roughness: 0.78 }),
    oakFloor: std({ color: int.oak, map: oakFloor, roughness: 0.62 }),
    tileFloor: std({ color: int.tile, map: tileFloor, roughness: 0.55 }),
    tileWall: std({ color: "#ecebe7", map: tileWall, roughness: 0.4 }),
    slateFloor: std({ color: "#6e6f70", map: slate, roughness: 0.8 }),
    partition: std({ color: int.plaster, map: plaster, roughness: 0.95 }),

    oak: std({ color: int.oak, map: wood, roughness: 0.6 }),
    oakDark: std({ color: int.oakDark, map: wood, roughness: 0.6 }),
    whiteLacquer: std({ color: "#f3f0ea", roughness: 0.45 }),
    linen: std({ color: int.textileLinen, map: fabric, roughness: 0.95 }),
    wool: std({ color: int.textileWool, map: fabric, roughness: 0.98 }),
    fjordFabric: std({ color: int.fjordBlue, map: fabric, roughness: 0.96 }),
    sageFabric: std({ color: int.sage, map: fabric, roughness: 0.96 }),
    duvet: std({ color: "#f4f1ea", map: fabric, roughness: 0.97 }),
    cushionAccent: std({ color: "#c08a5c", map: fabric, roughness: 0.96 }),
    rug: std({ color: "#d6ccbb", map: fabric, roughness: 1 }),
    metalBlack: std({ color: int.metal, roughness: 0.45, metalness: 0.6 }),
    steel: std({ color: "#b8bbbe", roughness: 0.3, metalness: 0.9 }),
    ceramic: std({ color: "#fafafa", roughness: 0.18 }),
    mirror: std({ color: "#dfe6ea", roughness: 0.02, metalness: 1 }),
    stone: std({ color: "#8d8b87", map: concrete, roughness: 0.7 }),
    stoveBlack: std({ color: "#1d1d1e", roughness: 0.6, metalness: 0.4 }),
    fire: std({ color: "#ff8a3a", emissive: "#ff7a2a", emissiveIntensity: 3 }),
    lampShade: std({ color: "#f3e7d3", emissive: "#ffcf96", emissiveIntensity: 0.6, roughness: 0.9 }),
    bulb: std({ color: "#fff3dc", emissive: "#ffd9a0", emissiveIntensity: 6 }),
    skylight: std({ color: "#eaf3fb", emissive: "#dfeefa", emissiveIntensity: 1.2 }),
    leaf: std({ color: "#5d7a4a", roughness: 0.8 }),
    pot: std({ color: "#c9b8a2", roughness: 0.85 }),
    book: std({ color: "#9a8b78", roughness: 0.9 }),
    outdoorFabric: std({ color: "#c9c3b8", map: fabric, roughness: 0.97 }),

    grass: std({ color: "#ffffff", map: grass, roughness: 1 }),
    gravel: std({ color: "#ffffff", map: gravel, roughness: 1 }),
    paver: std({ color: "#a29f99", map: concrete, roughness: 0.9 }),
    asphalt: std({ color: "#4a4b4d", map: concrete, roughness: 0.95 }),
    soil: std({ color: "#5a4a3a", roughness: 1 }),
    hedge: std({ color: "#46603a", map: fabric, roughness: 1 }),
    birchBark: std({ color: "#ebe8e2", roughness: 0.8 }),
    bark: std({ color: "#5a4636", roughness: 0.95 }),
    birchLeaf: std({ color: "#8aa65a", roughness: 0.85 }),
    spruce: std({ color: "#2f4a35", roughness: 0.9 }),
    appleLeaf: std({ color: "#5e8044", roughness: 0.85 }),
    boulder: std({ color: "#8b8a86", map: concrete, roughness: 0.9 })
  };
  reg.glass.userData.noShadow = true;
  reg.bulb.userData.noShadow = true;
  reg.skylight.userData.noShadow = true;
  applyEnvelope(reg, spec);
  return reg;
}

/** Recolour the shared materials when the active house changes. Meshes keep these references. */
export function applyEnvelope(mats: MaterialRegistry, spec: HouseSpec): void {
  const ext = spec.style.exteriorPalette;
  const int = spec.style.interiorPalette;
  const horizontal = spec.style.siding === "horizontal";
  const tile = spec.style.roofing === "tile";
  mats.cladding.color.set(ext.cladding);
  mats.cladding.map = horizontal ? maps.lap : maps.vertical;
  mats.cornerBoard.color.set(ext.claddingShadow);
  mats.trim.color.set(ext.trim);
  mats.windowFrame.color.set(ext.windowFrame);
  mats.windowFrame.metalness = horizontal ? 0.04 : 0.35;
  mats.windowFrame.roughness = horizontal ? 0.55 : 0.45;
  mats.roofMetal.color.set(ext.roof);
  mats.roofMetal.map = tile ? maps.tiles : maps.seam;
  mats.roofMetal.metalness = tile ? 0.02 : 0.55;
  mats.roofMetal.roughness = tile ? 0.86 : 0.48;
  mats.fascia.color.set(tile ? ext.trim : ext.roof);
  mats.fascia.metalness = tile ? 0.02 : 0.4;
  mats.fascia.roughness = tile ? 0.6 : 0.55;
  mats.deck.color.set(ext.deck);
  mats.deck.map = tile ? maps.concrete : maps.deck;
  mats.plinth.color.set(ext.plinth);
  mats.plaster.color.set(int.plaster);
  mats.partition.color.set(int.plaster);
  mats.oak.color.set(int.oak);
  mats.oakDark.color.set(int.oakDark);
  mats.oakFloor.color.set(int.oak);
  for (const m of [mats.cladding, mats.roofMetal, mats.fascia, mats.windowFrame, mats.deck, mats.cornerBoard, mats.trim]) m.needsUpdate = true;
}
