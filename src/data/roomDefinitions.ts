import type { RoomId } from "../model/types";

/**
 * Furniture program per room: what the rules engine must place (required) and what it
 * places when space and clearances allow (optional). Ids refer to the FurnitureLibrary.
 */
export interface RoomProgram {
  roomId: RoomId | "main_terrace" | "master_private_terrace";
  required: string[];
  optional: string[];
}

export const roomPrograms: RoomProgram[] = [
  {
    roomId: "living_kitchen",
    required: ["tall_fridge", "tall_oven", "sink_cabinet", "cooktop_cabinet", "dining_table_8", "dining_chair", "sofa_3s", "coffee_table", "wood_stove"],
    optional: ["kitchen_island", "bar_stool", "armchair", "media_sideboard", "floor_lamp", "plant_large", "rug_living", "open_shelf", "bookshelf"]
  },
  { roomId: "master_bedroom", required: ["bed_double", "nightstand", "wardrobe_200"], optional: ["bench_bed", "rug_bed", "table_lamp", "armchair_reading", "plant_large"] },
  { roomId: "kids_bedroom_1", required: ["bed_single", "desk_kids", "wardrobe_100"], optional: ["desk_chair_kids", "bookshelf_low", "rug_round", "toy_box"] },
  { roomId: "kids_bedroom_2", required: ["bunk_bed", "desk_kids", "wardrobe_100"], optional: ["desk_chair_kids", "bookshelf_low", "rug_round", "toy_box"] },
  { roomId: "office", required: ["desk_140", "office_chair", "shelf_unit"], optional: ["lounge_chair", "floor_lamp", "plant_large"] },
  { roomId: "bathroom", required: ["bathtub", "toilet", "vanity_100"], optional: ["tall_storage", "towel_ladder"] },
  { roomId: "guest_wc", required: ["toilet", "basin_small"], optional: ["wall_cabinet_small"] },
  { roomId: "utility", required: ["laundry_counter", "utility_shelf"], optional: [] },
  { roomId: "entrance", required: ["coat_cabinet", "entry_bench"], optional: ["mirror_wall", "rug_entry"] },
  { roomId: "circulation", required: [], optional: ["runner_rug"] },
  { roomId: "main_terrace", required: ["outdoor_table_10", "outdoor_chair", "outdoor_sofa", "outdoor_coffee_table", "outdoor_kitchen"], optional: ["outdoor_lounge_chair", "planter", "lantern"] },
  { roomId: "master_private_terrace", required: ["outdoor_lounge_chair", "bistro_table"], optional: ["bench_outdoor", "lantern", "planter"] }
];

export function programFor(roomId: string): RoomProgram | undefined {
  return roomPrograms.find((p) => p.roomId === roomId);
}
