import { builders, type Builder } from "./furniture/builders";
import { designRules } from "../data/designRules";

const C = designRules.clearance;

/** Free zones the item needs around it (meters, measured from its footprint edge). */
export interface Clearance {
  front?: number;
  back?: number;
  left?: number;
  right?: number;
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  /** Width along the item's front, depth front-to-back, height. Real dimensions in meters. */
  width: number;
  depth: number;
  height: number;
  builder: Builder;
  blocksMovement: boolean;
  /** Flat items (rugs) ignore overlap rules with other furniture. */
  flat?: boolean;
  /** Items hung on the wall or ceiling, or stood on other furniture. */
  mounted?: boolean;
  /** Seats that get pulled out in use; ignored as obstacles in reachability checks. */
  movable?: boolean;
  clearance?: Clearance;
  /** Points (in local front/right offsets) a person must be able to reach. */
  access?: Array<"front" | "left" | "right">;
  /** Reaching any one access point is enough (e.g. a sofa entered from either end). */
  accessAny?: boolean;
}

function item(id: string, name: string, width: number, depth: number, height: number, builder: string, opts: Partial<FurnitureCatalogItem> = {}): FurnitureCatalogItem {
  return { id, name, width, depth, height, builder: builders[builder], blocksMovement: true, ...opts };
}

/** A small curated Scandinavian furniture library (procedural). Drop a GLB at public/assets/furniture/<id>.glb to override. */
export const furnitureCatalog: FurnitureCatalogItem[] = [
  // living
  item("sofa_3s", "Three-seat sofa", 2.3, 0.95, 0.8, "sofa", { clearance: { front: C.sofaToCoffeeTable }, access: ["front", "left", "right"], accessAny: true }),
  item("sofa_corner", "Corner sofa return", 1.6, 0.95, 0.8, "sofa", { clearance: { front: 0.45 }, access: ["front", "left", "right"], accessAny: true }),
  item("armchair", "Armchair", 0.78, 0.82, 0.78, "armchair", { clearance: { front: 0.3 }, access: ["front"] }),
  item("armchair_reading", "Reading armchair", 0.78, 0.82, 0.78, "armchair", { clearance: { front: 0.45 }, access: ["front"] }),
  item("coffee_table", "Oak coffee table", 1.2, 0.62, 0.4, "coffeeTable"),
  item("rug_living", "Wool rug", 2.4, 1.9, 0.012, "rugLiving", { blocksMovement: false, flat: true }),
  item("wood_stove", "Wood stove on stone hearth", 0.95, 0.85, 3.6, "woodStove", { clearance: { front: C.stoveSafety } }),
  item("media_sideboard", "Low oak sideboard with TV", 1.8, 0.45, 0.55, "mediaSideboard", { clearance: { front: 0.6 } }),
  item("bookshelf", "Bookshelf", 1.0, 0.34, 2.0, "bookshelf", { clearance: { front: 0.6 } }),
  item("floor_lamp", "Floor lamp", 0.4, 0.4, 1.6, "floorLamp"),
  item("table_lamp", "Table lamp", 0.3, 0.3, 0.45, "tableLamp", { blocksMovement: false, mounted: true }),
  item("pendant", "Pendant light", 0.45, 0.45, 1.0, "pendant", { blocksMovement: false, mounted: true }),
  item("pendant_small", "Small pendant", 0.26, 0.26, 1.2, "pendant", { blocksMovement: false, mounted: true }),
  item("ceiling_light", "Ceiling light", 0.4, 0.4, 0.06, "ceilingLight", { blocksMovement: false, mounted: true }),
  item("wall_light", "Wall light", 0.16, 0.16, 0.2, "wallLight", { blocksMovement: false, mounted: true }),
  item("plant_large", "Large plant", 0.55, 0.55, 1.35, "plantLarge"),
  // dining & kitchen
  item("dining_table_8", "Oak dining table (8)", 2.2, 1.0, 0.75, "diningTable", { clearance: { front: C.diningChairPullback, back: C.diningChairPullback } }),
  item("dining_chair", "Dining chair", 0.48, 0.52, 0.8, "diningChair", { movable: true }),
  item("base_cabinet", "Base cabinet", 0.6, 0.62, 0.92, "baseCabinet", { clearance: { front: C.kitchenAisle } }),
  item("sink_cabinet", "Sink cabinet", 0.6, 0.62, 0.92, "sinkCabinet", { clearance: { front: C.kitchenAisle }, access: ["front"] }),
  item("cooktop_cabinet", "Induction cooktop", 0.6, 0.62, 0.92, "cooktopCabinet", { clearance: { front: C.kitchenAisle }, access: ["front"] }),
  item("dishwasher", "Dishwasher", 0.6, 0.62, 0.92, "baseCabinet", { clearance: { front: C.kitchenAisle } }),
  item("tall_fridge", "Fridge-freezer (tall unit)", 0.6, 0.62, 2.2, "tallFridge", { clearance: { front: C.kitchenAisle }, access: ["front"] }),
  item("tall_oven", "Oven tower", 0.6, 0.62, 2.2, "tallOven", { clearance: { front: C.kitchenAisle } }),
  item("tall_pantry", "Pantry", 0.6, 0.62, 2.2, "tallPantry", { clearance: { front: C.kitchenAisle } }),
  item("kitchen_island", "Kitchen island", 1.8, 0.95, 0.92, "kitchenIsland", { clearance: { front: C.islandClearance, back: C.kitchenAisle } }),
  item("bar_stool", "Bar stool", 0.4, 0.4, 0.65, "barStool", { movable: true }),
  item("open_shelf", "Open oak shelf", 1.2, 0.26, 0.3, "openShelf", { blocksMovement: false, mounted: true }),
  // bedrooms
  item("bed_double", "Double bed 160x200", 1.76, 2.12, 0.95, "bedDouble", { clearance: { left: C.bedSide, right: C.bedSide, front: C.bedFoot }, access: ["left", "right"] }),
  item("bed_single", "Single bed 90x200", 0.98, 2.06, 0.75, "bedSingle", { clearance: { front: 0.5 }, access: ["front"] }),
  item("bunk_bed", "Bunk bed 90x200", 1.0, 2.08, 1.65, "bunkBed", { clearance: { front: 0.5, right: 0.6 }, access: ["right"] }),
  item("nightstand", "Nightstand", 0.45, 0.4, 0.5, "nightstand"),
  item("wardrobe_200", "Wardrobe 200", 2.0, 0.62, 2.2, "wardrobe", { clearance: { front: C.wardrobeFront }, access: ["front"] }),
  item("wardrobe_100", "Wardrobe 100", 1.0, 0.6, 2.1, "wardrobe", { clearance: { front: C.wardrobeFront }, access: ["front"] }),
  item("bench_bed", "Bed bench", 1.2, 0.4, 0.45, "bench"),
  item("dresser", "Dresser", 1.0, 0.45, 0.8, "dresser", { clearance: { front: 0.7 } }),
  item("rug_bed", "Linen rug", 2.2, 1.6, 0.012, "rugBed", { blocksMovement: false, flat: true }),
  item("desk_kids", "Children's desk", 1.1, 0.6, 0.72, "deskKids", { clearance: { front: C.deskChair }, access: ["front"] }),
  item("desk_chair_kids", "Children's chair", 0.42, 0.42, 0.82, "deskChairKids", { movable: true }),
  item("bookshelf_low", "Low bookshelf", 0.8, 0.33, 0.9, "lowBookshelf", { clearance: { front: 0.5 } }),
  item("toy_box", "Toy box", 0.6, 0.4, 0.42, "toyBox"),
  item("rug_round", "Round rug", 1.4, 1.4, 0.012, "rugRound", { blocksMovement: false, flat: true }),
  // office
  item("desk_140", "Oak desk 140", 1.4, 0.7, 0.74, "desk", { clearance: { front: C.deskChair }, access: ["front"] }),
  item("office_chair", "Ergonomic chair", 0.62, 0.62, 1.05, "officeChair", { movable: true }),
  item("shelf_unit", "Shelving", 1.0, 0.34, 1.9, "shelfUnit", { clearance: { front: 0.6 } }),
  item("lounge_chair", "Lounge chair with sheepskin", 0.72, 0.78, 0.82, "loungeChair", { clearance: { front: 0.4 } }),
  // bathroom & utility
  item("bathtub", "Bathtub 170x75", 1.7, 0.75, 0.58, "bathtub", { clearance: { front: C.tubFront }, access: ["front"] }),
  item("toilet", "Wall-hung WC", 0.38, 0.56, 0.8, "toilet", { clearance: { front: C.toiletFront, left: C.toiletSideFromCenter - 0.19, right: C.toiletSideFromCenter - 0.19 }, access: ["front"] }),
  item("vanity_100", "Vanity 100", 1.0, 0.48, 0.86, "vanity100", { clearance: { front: C.sinkFront }, access: ["front"] }),
  item("basin_small", "Hand basin", 0.45, 0.28, 0.86, "basinSmall", { clearance: { front: 0.6 }, access: ["front"] }),
  item("tall_storage", "Tall bathroom cabinet", 0.4, 0.35, 1.8, "tallStorage", { clearance: { front: 0.5 } }),
  item("towel_ladder", "Towel ladder", 0.45, 0.06, 1.6, "towelLadder", { blocksMovement: false }),
  item("wall_cabinet_small", "Small wall cabinet", 0.4, 0.15, 0.5, "wallCabinetSmall", { blocksMovement: false, mounted: true }),
  item("laundry_counter", "Washer and dryer under counter", 1.3, 0.64, 0.92, "laundryCounter", { clearance: { front: 0.9 }, access: ["front"] }),
  item("utility_shelf", "Utility shelving", 0.9, 0.4, 1.9, "utilityShelf", { clearance: { front: 0.6 } }),
  // entrance & hall
  item("coat_cabinet", "Coat cabinet", 1.2, 0.45, 2.2, "coatCabinet", { clearance: { front: 0.8 }, access: ["front"] }),
  item("entry_bench", "Shoe bench", 1.0, 0.38, 0.45, "entryBench"),
  item("mirror_wall", "Full-length mirror", 0.6, 0.04, 1.9, "mirrorWall", { blocksMovement: false, mounted: true }),
  item("rug_entry", "Entrance mat", 1.2, 0.8, 0.012, "rugEntry", { blocksMovement: false, flat: true }),
  item("runner_rug", "Runner", 0.8, 3.2, 0.012, "runner", { blocksMovement: false, flat: true }),
  // outdoor
  item("outdoor_table_10", "Outdoor table for 10", 2.6, 1.0, 0.74, "outdoorTable", { clearance: { front: C.diningChairPullback, back: C.diningChairPullback } }),
  item("outdoor_chair", "Outdoor chair", 0.52, 0.56, 0.8, "outdoorChair", { movable: true }),
  item("outdoor_sofa", "Outdoor sofa", 2.1, 0.9, 0.72, "outdoorSofa", { clearance: { front: 0.45 } }),
  item("outdoor_lounge_chair", "Outdoor lounge chair", 0.78, 0.85, 0.75, "outdoorLounge", { clearance: { front: 0.4 } }),
  item("outdoor_coffee_table", "Concrete coffee table", 1.0, 0.6, 0.36, "outdoorCoffeeTable"),
  item("outdoor_kitchen", "Outdoor kitchen with grill", 1.8, 0.65, 0.92, "outdoorKitchen", { clearance: { front: C.grillSafety }, access: ["front"] }),
  item("planter", "Planter with grasses", 0.6, 0.6, 0.95, "planter"),
  item("lantern", "Lantern", 0.24, 0.24, 0.5, "lantern", { blocksMovement: false }),
  item("bistro_table", "Small round table", 0.6, 0.6, 0.72, "bistroTable"),
  item("bench_outdoor", "Timber bench", 1.4, 0.42, 0.45, "benchOutdoor")
];

const byId = new Map(furnitureCatalog.map((c) => [c.id, c]));

export function catalogById(id: string): FurnitureCatalogItem | undefined {
  return byId.get(id);
}
