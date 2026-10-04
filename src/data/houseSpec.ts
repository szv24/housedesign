import type { CeilingType, OpeningKind, RoomId, Side } from "../model/types";

/**
 * PRIMARY SOURCE OF TRUTH for the house.
 *
 * Plan coordinates: meters, x = east, y = north, origin at the south-west outer corner
 * of the private (bedroom) wing. 3D: X = x, Z = -y, Y = up.
 *
 * Everything else (rooms, walls, openings, roof, terraces, furniture, lights, floor plan,
 * collisions) is derived from this object. Room geometry is expressed as a split tree per
 * wing zone, never as absolute coordinates.
 */

export interface HouseConfig {
  /** Length of the social (north) wing along x, outer faces. */
  overallWidth: number;
  /** Outer depth of the social wing (north-south). */
  socialWingDepth: number;
  /** Outer width of the private (west) wing (east-west). */
  privateWingWidth: number;
  /** Outer length of the private wing south of the social wing. */
  privateWingLength: number;
  /** Clear height from finished floor to top of exterior walls (eaves). */
  wallHeight: number;
  roofPitchDeg: number;
  /** Eave overhang (perpendicular to the ridge). */
  roofOverhang: number;
  /** Overhang at gable ends (along the ridge). */
  gableOverhang: number;
  roofThickness: number;
  exteriorWallThickness: number;
  partitionThickness: number;
  /** Finished floor level above garden ground. */
  floorLevel: number;
  /** Depth of the main terrace (north-south). */
  terraceDepth: number;
  /** Length of the main terrace along the living room facade. */
  terraceLength: number;
  /** Planted buffer between the bedroom wing and the main terrace. */
  terraceBedroomBuffer: number;
  interiorDoorHeight: number;
  casedOpeningHeight: number;
}

export interface TerraceSpecs {
  main: {
    /** Height of the deck surface above garden ground. */
    deckHeight: number;
    /** Pergola length from the west end of the terrace. */
    pergolaLength: number;
    screenHeight: number;
    screenLength: number;
    /** Which facade the deck sits against. Defaults to the south garden side. */
    side?: "south" | "east";
  };
  masterPrivate: {
    deckHeight: number;
    /** Extent along the west facade (north-south). */
    length: number;
    /** Extent away from the facade (east-west). */
    depth: number;
    /** Offset of the deck's south edge from the master bedroom's south bound. */
    at: number;
    screenHeight: number;
  };
  stepDepth: number;
}

export type SplitSize = number | "flex";

export type SplitChild = { size: SplitSize; room: RoomId; min?: number } | { size: SplitSize; node: SplitNode; min?: number };

export interface SplitNode {
  split: "x" | "y";
  children: SplitChild[];
}

export interface RoomSpec {
  id: RoomId;
  name: string;
  ceiling: CeilingType;
  floorMaterial: string;
  minArea: number;
  maxArea: number;
  preferredFurnitureLayout: string;
}

export interface ExteriorOpeningSpec {
  id: string;
  kind: Extract<OpeningKind, "window" | "glazed_door" | "sliding_door" | "front_door">;
  room: RoomId;
  side: Side;
  /** Distance from the room's west/south bound (along the side) to the opening center. */
  at: number;
  width: number;
  height: number;
  sill: number;
}

export interface ConnectionSpec {
  id: string;
  kind: Extract<OpeningKind, "door" | "cased_opening" | "open">;
  rooms: [RoomId, RoomId];
  /** Which side of rooms[1] the shared wall is on (disambiguates L-shaped rooms). */
  sideOf?: Side;
  /** Offset of the opening center from the shared segment start; negative = from the end; "center" or "full". */
  at: number | "center" | "full";
  width: number;
  swingInto?: RoomId;
  hinge?: "start" | "end";
}

export type Massing = "courtyard" | "gable";

export interface HouseSpec {
  /**
   * courtyard: the L around an inner terrace (two crossing roofs).
   * gable: one rectangular cottage under a single ridge, optional garden cross-gable.
   */
  massing?: Massing;
  style: {
    architecture: string;
    /** vertical board-and-batten, or horizontal lap siding. */
    siding?: "vertical" | "horizontal";
    /** standing-seam metal, or clay pantiles. */
    roofing?: "metal" | "tile";
    exteriorPalette: {
      cladding: string;
      claddingShadow: string;
      roof: string;
      windowFrame: string;
      trim: string;
      deck: string;
      plinth: string;
    };
    interiorPalette: {
      plaster: string;
      oak: string;
      oakDark: string;
      tile: string;
      textileLinen: string;
      textileWool: string;
      fjordBlue: string;
      sage: string;
      metal: string;
    };
  };
  building: HouseConfig;
  terraces: TerraceSpecs;
  rooms: RoomSpec[];
  layout: {
    /** Fills the interior zone of the private wing (inside exterior walls). */
    privateWing: SplitNode;
    /** Fills the interior zone of the social wing. */
    socialWing: SplitNode;
  };
  openings: ExteriorOpeningSpec[];
  connections: ConnectionSpec[];
  gableGlazing: Array<{ wing: string; end: "start" | "end" }>;
  /** Round window set into a gable triangle. */
  gableOculi?: Array<{ wing: string; end: "start" | "end"; radius?: number }>;
  /** Cross-gable on the south slope. `x` is the west edge, `width` the gable span. */
  frontGable?: { x: number; width: number };
  /** Brick stack on the main ridge. */
  chimney?: { x: number };
  skylights: Array<{ id: string; room: RoomId; width: number; length: number }>;
  /** Net interior area warning band. Defaults from the massing. */
  areaRange?: [number, number];
  site: {
    plot: { x: number; y: number; w: number; h: number };
    latitude: number;
    dayOfYear: number;
    northAngleDeg: number;
  };
}

export const houseSpec: HouseSpec = {
  massing: "courtyard",
  style: {
    architecture: "modern_norwegian_coastal",
    siding: "vertical",
    roofing: "metal",
    exteriorPalette: {
      cladding: "#6e7f72",
      claddingShadow: "#46524a",
      roof: "#2b2e31",
      windowFrame: "#2a2c2e",
      trim: "#e3ddd2",
      deck: "#a07c58",
      plinth: "#8a8782"
    },
    interiorPalette: {
      plaster: "#f1ece3",
      oak: "#c49a6c",
      oakDark: "#8a6646",
      tile: "#cfccc6",
      textileLinen: "#d9cfbf",
      textileWool: "#8e9ba3",
      fjordBlue: "#5d7586",
      sage: "#8d9a83",
      metal: "#2c2c2e"
    }
  },
  building: {
    overallWidth: 17.4,
    socialWingDepth: 7.2,
    privateWingWidth: 6.0,
    privateWingLength: 11.4,
    wallHeight: 2.8,
    roofPitchDeg: 32,
    roofOverhang: 0.5,
    gableOverhang: 0.25,
    roofThickness: 0.32,
    exteriorWallThickness: 0.4,
    partitionThickness: 0.12,
    floorLevel: 0.45,
    terraceDepth: 4.4,
    terraceLength: 9.6,
    terraceBedroomBuffer: 1.2,
    interiorDoorHeight: 2.1,
    casedOpeningHeight: 2.35
  },
  terraces: {
    main: { deckHeight: 0.42, pergolaLength: 5.4, screenHeight: 1.4, screenLength: 3.2 },
    masterPrivate: { deckHeight: 0.42, length: 3.0, depth: 2.6, at: 0.2, screenHeight: 1.8 },
    stepDepth: 0.42
  },
  rooms: [
    { id: "living_kitchen", name: "Living / Dining / Kitchen", ceiling: "vaulted", floorMaterial: "oak", minArea: 45, maxArea: 75, preferredFurnitureLayout: "kitchen_west_dining_center_living_east" },
    { id: "master_bedroom", name: "Master Bedroom", ceiling: "flat", floorMaterial: "oak", minArea: 14, maxArea: 26, preferredFurnitureLayout: "bed_north_wall_wardrobe_east" },
    { id: "kids_bedroom_1", name: "Children's Room 1", ceiling: "flat", floorMaterial: "oak", minArea: 10, maxArea: 17, preferredFurnitureLayout: "bed_long_wall_desk_by_window" },
    { id: "kids_bedroom_2", name: "Children's Room 2", ceiling: "flat", floorMaterial: "oak", minArea: 10, maxArea: 17, preferredFurnitureLayout: "bed_long_wall_desk_by_window" },
    { id: "office", name: "Home Office", ceiling: "flat", floorMaterial: "oak", minArea: 7, maxArea: 12, preferredFurnitureLayout: "desk_perpendicular_to_window" },
    { id: "bathroom", name: "Bathroom", ceiling: "flat", floorMaterial: "tile", minArea: 6, maxArea: 11, preferredFurnitureLayout: "tub_west_wc_south_vanity_east" },
    { id: "guest_wc", name: "Guest WC", ceiling: "flat", floorMaterial: "tile", minArea: 2, maxArea: 4.5, preferredFurnitureLayout: "wc_north_basin_side" },
    { id: "utility", name: "Utility / Laundry", ceiling: "flat", floorMaterial: "tile", minArea: 3.5, maxArea: 7, preferredFurnitureLayout: "machines_east_shelves_west" },
    { id: "entrance", name: "Entrance", ceiling: "flat", floorMaterial: "slate", minArea: 4, maxArea: 9, preferredFurnitureLayout: "coat_wall_bench" },
    { id: "circulation", name: "Hall", ceiling: "flat", floorMaterial: "oak", minArea: 12, maxArea: 26, preferredFurnitureLayout: "keep_clear" }
  ],
  layout: {
    privateWing: {
      split: "y",
      children: [
        { size: 4.2, room: "master_bedroom", min: 3.4 },
        {
          size: "flex",
          node: {
            split: "x",
            children: [
              { size: 1.2, room: "circulation" },
              {
                size: "flex",
                node: {
                  split: "y",
                  children: [
                    { size: 3.5, room: "kids_bedroom_1", min: 2.8 },
                    { size: "flex", room: "kids_bedroom_2", min: 2.8 }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    socialWing: {
      split: "x",
      children: [
        {
          size: 6.8,
          node: {
            split: "y",
            children: [
              {
                size: 2.6,
                node: {
                  split: "x",
                  children: [
                    { size: 1.2, room: "circulation" },
                    { size: "flex", room: "bathroom", min: 2.6 },
                    { size: 2.0, room: "utility" }
                  ]
                }
              },
              { size: 1.2, room: "circulation" },
              {
                size: "flex",
                node: {
                  split: "x",
                  children: [
                    { size: 3.0, room: "office" },
                    { size: 1.3, room: "guest_wc" },
                    { size: "flex", room: "entrance", min: 1.8 }
                  ]
                }
              }
            ]
          }
        },
        { size: "flex", room: "living_kitchen", min: 7 }
      ]
    }
  },
  openings: [
    // Living / dining / kitchen: south (terrace), east (gable), north (kitchen strip)
    { id: "ldk_south_slide_dining", kind: "sliding_door", room: "living_kitchen", side: "south", at: 5.4, width: 3.0, height: 2.4, sill: 0 },
    { id: "ldk_south_slide_living", kind: "sliding_door", room: "living_kitchen", side: "south", at: 8.4, width: 2.2, height: 2.4, sill: 0 },
    { id: "ldk_south_kitchen", kind: "window", room: "living_kitchen", side: "south", at: 1.6, width: 1.4, height: 1.7, sill: 0.7 },
    { id: "ldk_east_gable", kind: "window", room: "living_kitchen", side: "east", at: 3.2, width: 4.4, height: 2.45, sill: 0.25 },
    { id: "ldk_north_kitchen_strip", kind: "window", room: "living_kitchen", side: "north", at: 1.9, width: 2.4, height: 0.85, sill: 1.05 },
    { id: "ldk_north_dining", kind: "window", room: "living_kitchen", side: "north", at: 5.4, width: 1.4, height: 1.9, sill: 0.5 },
    // Master bedroom: west glazed door to private terrace, south window, narrow east window
    { id: "master_west_terrace_door", kind: "glazed_door", room: "master_bedroom", side: "west", at: 1.4, width: 1.2, height: 2.3, sill: 0 },
    { id: "master_south", kind: "window", room: "master_bedroom", side: "south", at: 3.0, width: 2.0, height: 1.8, sill: 0.5 },
    { id: "master_east_narrow", kind: "window", room: "master_bedroom", side: "east", at: 3.3, width: 0.7, height: 1.8, sill: 0.5 },
    // Children's rooms face the courtyard (morning light)
    { id: "kids1_east", kind: "window", room: "kids_bedroom_1", side: "east", at: 1.75, width: 1.6, height: 1.6, sill: 0.6 },
    { id: "kids2_east", kind: "window", room: "kids_bedroom_2", side: "east", at: 1.6, width: 1.6, height: 1.6, sill: 0.6 },
    // Corridor: tall narrow windows to the west
    { id: "corridor_west_1", kind: "window", room: "circulation", side: "west", at: 1.8, width: 0.6, height: 2.1, sill: 0.3 },
    { id: "corridor_west_2", kind: "window", room: "circulation", side: "west", at: 5.2, width: 0.6, height: 2.1, sill: 0.3 },
    { id: "corridor_west_3", kind: "window", room: "circulation", side: "west", at: 8.6, width: 0.6, height: 2.1, sill: 0.3 },
    // Office: north light + west window (side light for the desk)
    { id: "office_north", kind: "window", room: "office", side: "north", at: 1.5, width: 1.4, height: 1.4, sill: 0.8 },
    { id: "office_west", kind: "window", room: "office", side: "west", at: 1.3, width: 1.0, height: 1.4, sill: 0.8 },
    { id: "wc_north", kind: "window", room: "guest_wc", side: "north", at: 0.65, width: 0.5, height: 0.6, sill: 1.5 },
    { id: "entrance_front_door", kind: "front_door", room: "entrance", side: "north", at: 1.4, width: 1.0, height: 2.3, sill: 0 },
    { id: "utility_south", kind: "window", room: "utility", side: "south", at: 1.4, width: 0.6, height: 0.8, sill: 1.2 }
  ],
  connections: [
    { id: "door_master", kind: "door", rooms: ["circulation", "master_bedroom"], at: "center", width: 0.9, swingInto: "master_bedroom", hinge: "start" },
    { id: "door_kids1", kind: "door", rooms: ["circulation", "kids_bedroom_1"], at: -0.6, width: 0.9, swingInto: "kids_bedroom_1", hinge: "end" },
    { id: "door_kids2", kind: "door", rooms: ["circulation", "kids_bedroom_2"], at: 0.6, width: 0.9, swingInto: "kids_bedroom_2", hinge: "start" },
    { id: "door_bathroom", kind: "door", rooms: ["circulation", "bathroom"], sideOf: "north", at: -0.6, width: 0.8, swingInto: "bathroom", hinge: "end" },
    { id: "door_utility", kind: "door", rooms: ["circulation", "utility"], at: "center", width: 0.8, swingInto: "utility", hinge: "end" },
    { id: "door_office", kind: "door", rooms: ["circulation", "office"], at: 0.6, width: 0.9, swingInto: "office", hinge: "start" },
    { id: "door_wc", kind: "door", rooms: ["circulation", "guest_wc"], at: "center", width: 0.7, swingInto: "guest_wc", hinge: "start" },
    { id: "open_entrance_hall", kind: "open", rooms: ["circulation", "entrance"], at: "full", width: 0 },
    { id: "opening_hall_ldk", kind: "cased_opening", rooms: ["circulation", "living_kitchen"], at: "full", width: 0 }
  ],
  gableGlazing: [{ wing: "social", end: "end" }],
  skylights: [{ id: "bathroom_roof_window", room: "bathroom", width: 0.8, length: 1.2 }],
  site: {
    plot: { x: -14, y: -16, w: 46, h: 44 },
    latitude: 47.5,
    dayOfYear: 228,
    northAngleDeg: 0
  }
};

/** Deep copy, so live design edits never mutate the defaults. */
export function cloneSpec(spec: HouseSpec = houseSpec): HouseSpec {
  return JSON.parse(JSON.stringify(spec)) as HouseSpec;
}
