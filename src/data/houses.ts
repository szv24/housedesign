import { houseSpec, type HouseSpec } from "./houseSpec";

export interface HousePreset {
  id: string;
  name: string;
  tagline: string;
  /** One sentence in the picker. */
  blurb: string;
  /** Swatch colors for the menu: siding, roof, trim. */
  swatch: [string, string, string];
  spec: HouseSpec;
}

/**
 * Garden-gable cottage. Same rooms as the courtyard house, rearranged as a long
 * single bar: a gallery hall, garden bedrooms to the west, and a wide living room
 * opening south through French doors under a round-window cross-gable.
 * Not a copy of the reference plan — the room program, the gallery, and the
 * private terrace are kept from the original brief.
 */
export const gardenGableSpec: HouseSpec = {
  massing: "gable",
  style: {
    architecture: "scandinavian_garden_cottage",
    siding: "horizontal",
    roofing: "tile",
    exteriorPalette: {
      cladding: "#c2beb4",
      claddingShadow: "#f7f5f0",
      roof: "#a33d32",
      windowFrame: "#f6f3ec",
      trim: "#f7f5f0",
      deck: "#d5cfc4",
      plinth: "#b7b2a8"
    },
    interiorPalette: {
      plaster: "#f3efe7",
      oak: "#c9a27a",
      oakDark: "#8d6848",
      tile: "#d5d1cb",
      textileLinen: "#e4dcd0",
      textileWool: "#8f9aa3",
      fjordBlue: "#6d8494",
      sage: "#8e9b86",
      metal: "#2c2c2e"
    }
  },
  building: {
    overallWidth: 23.4,
    socialWingDepth: 8.55,
    privateWingWidth: 13.4,
    privateWingLength: 0,
    wallHeight: 2.7,
    roofPitchDeg: 34,
    roofOverhang: 0.55,
    gableOverhang: 0.32,
    roofThickness: 0.28,
    exteriorWallThickness: 0.4,
    partitionThickness: 0.12,
    floorLevel: 0.42,
    terraceDepth: 4.4,
    terraceLength: 9.6,
    terraceBedroomBuffer: 1.1,
    interiorDoorHeight: 2.1,
    casedOpeningHeight: 2.35
  },
  terraces: {
    main: { deckHeight: 0.38, pergolaLength: 5.6, screenHeight: 1.2, screenLength: 2.4 },
    masterPrivate: { deckHeight: 0.38, length: 2.8, depth: 2.6, at: 0.3, screenHeight: 1.6 },
    stepDepth: 0.38
  },
  rooms: houseSpec.rooms.map((r) => ({ ...r })),
  layout: {
    // West block: garden bedrooms, then the street-side service row, then the gallery.
    privateWing: {
      split: "y",
      children: [
        {
                size: 3.5,
          node: {
            split: "x",
            children: [
              { size: 5.4, room: "master_bedroom", min: 4.4 },
              { size: 3.4, room: "kids_bedroom_1", min: 3.0 },
              { size: "flex", room: "kids_bedroom_2", min: 3.2 }
            ]
          }
        },
        { size: 1.55, room: "circulation", min: 1.4 },
        {
          size: "flex",
          min: 2.5,
          node: {
            split: "x",
            children: [
              { size: 2.6, room: "entrance", min: 2.2 },
              { size: 3.6, room: "bathroom", min: 3.0 },
              { size: 3.4, room: "office", min: 2.8 },
              { size: 1.4, room: "guest_wc", min: 1.3 },
              { size: "flex", room: "utility", min: 1.6 }
            ]
          }
        }
      ]
    },
    // East block: the whole garden room, north light for the kitchen, south doors, east gable.
    socialWing: {
      split: "x",
      children: [{ size: "flex", room: "living_kitchen", min: 6.5 }]
    }
  },
  openings: [
    // Living room: kitchen strip to the north, French doors to the garden, tall east light.
    { id: "ldk_north_kitchen_strip", kind: "window", room: "living_kitchen", side: "north", at: 1.5, width: 2.0, height: 0.9, sill: 1.05 },
    { id: "ldk_south_french", kind: "sliding_door", room: "living_kitchen", side: "south", at: 4.85, width: 2.0, height: 2.35, sill: 0 },
    { id: "ldk_east_light", kind: "window", room: "living_kitchen", side: "east", at: 6.2, width: 1.2, height: 1.5, sill: 0.75 },
    // Master: garden window and a door to the quiet west terrace.
    { id: "master_south", kind: "window", room: "master_bedroom", side: "south", at: 2.7, width: 1.6, height: 1.6, sill: 0.6 },
    { id: "master_west_terrace_door", kind: "glazed_door", room: "master_bedroom", side: "west", at: 1.7, width: 1.0, height: 2.15, sill: 0 },
    { id: "kids1_south", kind: "window", room: "kids_bedroom_1", side: "south", at: 1.7, width: 1.3, height: 1.4, sill: 0.75 },
    { id: "kids2_south", kind: "window", room: "kids_bedroom_2", side: "south", at: 2.1, width: 1.4, height: 1.4, sill: 0.75 },
    { id: "entrance_front_door", kind: "front_door", room: "entrance", side: "north", at: 1.3, width: 0.95, height: 2.15, sill: 0 },
    { id: "office_north", kind: "window", room: "office", side: "north", at: 1.7, width: 1.4, height: 1.25, sill: 0.9 },
    { id: "wc_north", kind: "window", room: "guest_wc", side: "north", at: 0.7, width: 0.4, height: 0.5, sill: 1.55 },
    { id: "utility_north", kind: "window", room: "utility", side: "north", at: 1.0, width: 0.6, height: 0.65, sill: 1.4 }
  ],
  connections: [
    { id: "door_master", kind: "door", rooms: ["circulation", "master_bedroom"], at: "center", width: 0.9, swingInto: "master_bedroom", hinge: "start" },
    { id: "door_kids1", kind: "door", rooms: ["circulation", "kids_bedroom_1"], at: "center", width: 0.9, swingInto: "kids_bedroom_1", hinge: "end" },
    { id: "door_kids2", kind: "door", rooms: ["circulation", "kids_bedroom_2"], at: 1.2, width: 0.9, swingInto: "kids_bedroom_2", hinge: "end" },
    { id: "door_entrance", kind: "door", rooms: ["circulation", "entrance"], at: "center", width: 0.9, swingInto: "entrance", hinge: "end" },
    { id: "door_bathroom", kind: "door", rooms: ["circulation", "bathroom"], at: "center", width: 0.8, swingInto: "bathroom", hinge: "start" },
    { id: "door_office", kind: "door", rooms: ["circulation", "office"], at: "center", width: 0.9, swingInto: "office", hinge: "end" },
    { id: "door_wc", kind: "door", rooms: ["circulation", "guest_wc"], at: "center", width: 0.7, swingInto: "guest_wc", hinge: "start" },
    { id: "door_utility", kind: "door", rooms: ["circulation", "utility"], at: "center", width: 0.8, swingInto: "utility", hinge: "end" },
    // Gallery opens into the living room toward the garden, clear of the kitchen run.
    { id: "opening_hall_ldk", kind: "cased_opening", rooms: ["circulation", "living_kitchen"], at: "center", width: 1.45 }
  ],
  gableGlazing: [],
  gableOculi: [{ wing: "front", end: "start", radius: 0.42 }],
  frontGable: { x: 15.4, width: 5.6 },
  chimney: { x: 16.2 },
  skylights: [{ id: "bathroom_roof_window", room: "bathroom", width: 0.78, length: 1.05 }],
  site: {
    plot: { x: -16, y: -18, w: 56, h: 42 },
    latitude: 47.5,
    dayOfYear: 228,
    northAngleDeg: 0
  }
};

/**
 * Measured family plan, 14.20 m × 8.40 m. Walls follow the drawing's dimension chains
 * (exterior 0.45 m, partitions 0.10 m): two equal west bedrooms, a deeper living room
 * on the east, and a 15 m² ceramic terrace outside that living room.
 */
export const familyPlanSpec: HouseSpec = {
  massing: "gable",
  areaRange: [85, 120],
  style: {
    architecture: "measured_family_plan",
    siding: "horizontal",
    roofing: "tile",
    exteriorPalette: {
      cladding: "#e4ddd2",
      claddingShadow: "#f7f4ee",
      roof: "#6a6058",
      windowFrame: "#f4f1ea",
      trim: "#f7f4ee",
      deck: "#d5cfc6",
      plinth: "#c4bdb4"
    },
    interiorPalette: {
      plaster: "#f6f3ee",
      oak: "#c9a27a",
      oakDark: "#8d6848",
      tile: "#d7d2cb",
      textileLinen: "#e6dfd4",
      textileWool: "#8f9aa3",
      fjordBlue: "#6d8494",
      sage: "#8e9b86",
      metal: "#2c2c2e"
    }
  },
  building: {
    overallWidth: 14.6,
    socialWingDepth: 8.4,
    privateWingWidth: 9.2,
    privateWingLength: 0,
    wallHeight: 2.7,
    roofPitchDeg: 30,
    roofOverhang: 0.4,
    gableOverhang: 0.25,
    roofThickness: 0.22,
    exteriorWallThickness: 0.45,
    partitionThickness: 0.1,
    floorLevel: 0.32,
    terraceDepth: 3.16,
    terraceLength: 4.75,
    terraceBedroomBuffer: 1.1,
    interiorDoorHeight: 2.1,
    casedOpeningHeight: 2.4
  },
  terraces: {
    main: { deckHeight: 0.18, pergolaLength: 0, screenHeight: 0, screenLength: 0, side: "east" },
    masterPrivate: { deckHeight: 0.18, length: 0, depth: 0, at: 0.0, screenHeight: 1.2 },
    stepDepth: 0.32
  },
  rooms: [
    { id: "bedroom_sw", name: "Bedroom", ceiling: "flat", floorMaterial: "oak", minArea: 9, maxArea: 14, preferredFurnitureLayout: "single_bed" },
    { id: "bedroom_nw", name: "Bedroom", ceiling: "flat", floorMaterial: "oak", minArea: 9, maxArea: 14, preferredFurnitureLayout: "single_bed" },
    { id: "master_bedroom", name: "Master Bedroom", ceiling: "flat", floorMaterial: "oak", minArea: 7, maxArea: 12, preferredFurnitureLayout: "bed_south_wall_wardrobe_east" },
    { id: "wardrobe", name: "Wardrobe", ceiling: "flat", floorMaterial: "oak", minArea: 3.5, maxArea: 7, preferredFurnitureLayout: "storage" },
    { id: "bathroom", name: "Bathroom", ceiling: "flat", floorMaterial: "tile", minArea: 5, maxArea: 9, preferredFurnitureLayout: "tub" },
    { id: "guest_wc", name: "WC", ceiling: "flat", floorMaterial: "tile", minArea: 1.2, maxArea: 2.4, preferredFurnitureLayout: "wc" },
    { id: "utility", name: "Utility", ceiling: "flat", floorMaterial: "tile", minArea: 4, maxArea: 7, preferredFurnitureLayout: "laundry" },
    { id: "entrance", name: "Entrance", ceiling: "flat", floorMaterial: "tile", minArea: 6, maxArea: 12, preferredFurnitureLayout: "coats" },
    { id: "kitchen", name: "Kitchen / Dining", ceiling: "flat", floorMaterial: "tile", minArea: 14, maxArea: 20, preferredFurnitureLayout: "counter_and_table" },
    { id: "living", name: "Living room", ceiling: "flat", floorMaterial: "tile", minArea: 16, maxArea: 23, preferredFurnitureLayout: "sofa_north" }
  ],
  layout: {
    privateWing: {
      split: "x",
      children: [
        {
          size: 3.05,
          node: {
            split: "y",
            children: [
              { size: 3.75, room: "bedroom_sw", min: 3.2 },
              { size: "flex", room: "bedroom_nw", min: 3.2 }
            ]
          }
        },
        {
          size: 2.7,
          node: {
            split: "y",
            children: [
              {
                size: 3.75,
                node: {
                  split: "x",
                  children: [
                    { size: 2.05, room: "entrance", min: 1.6 },
                    { size: "flex", room: "kitchen", min: 0.4 }
                  ]
                }
              },
              {
                // Hall in front of the bathroom: open to the entrance, the kitchen counter wall ends here.
                size: "flex",
                min: 0.8,
                node: {
                  split: "x",
                  children: [
                    { size: 2.05, room: "entrance", min: 1.6 },
                    { size: "flex", room: "kitchen", min: 0.4 }
                  ]
                }
              },
              { size: 2.48, room: "bathroom", min: 2.2 }
            ]
          }
        },
        {
          size: "flex",
          min: 2.6,
          node: {
            split: "y",
            children: [
              { size: 3.75, room: "kitchen", min: 3.2 },
              {
                size: "flex",
                min: 3.2,
                node: {
                  split: "x",
                  children: [
                    {
                      size: 1,
                      node: {
                        split: "y",
                        children: [
                          { size: "flex", room: "kitchen", min: 1.2 },
                          { size: 1.7, room: "guest_wc", min: 1.3 }
                        ]
                      }
                    },
                    {
                      size: "flex",
                      min: 1.6,
                      node: {
                        split: "y",
                        children: [
                          { size: "flex", room: "kitchen", min: 0.8 },
                          { size: 2.0, room: "utility", min: 1.6 }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    socialWing: {
      split: "y",
      children: [
        { size: 4.3, room: "living", min: 3.8 },
        {
          size: "flex",
          min: 2.8,
          node: {
            split: "x",
            children: [
              { size: 1.1, room: "wardrobe", min: 0.9 },
              { size: "flex", room: "master_bedroom", min: 3.0 }
            ]
          }
        }
      ]
    }
  },
  openings: [
    { id: "sw_west", kind: "window", room: "bedroom_sw", side: "west", at: 1.88, width: 1.5, height: 1.4, sill: 0.9 },
    { id: "sw_south", kind: "window", room: "bedroom_sw", side: "south", at: 1.5, width: 0.9, height: 1.4, sill: 0.9 },
    { id: "nw_west", kind: "window", room: "bedroom_nw", side: "west", at: 1.88, width: 1.5, height: 1.4, sill: 0.9 },
    // High strip windows (sill 1.80) on the service rooms, as on the drawing; none on the bedrooms' north walls.
    { id: "bath_north", kind: "window", room: "bathroom", side: "north", at: 1.35, width: 0.9, height: 0.6, sill: 1.8 },
    { id: "wc_north", kind: "window", room: "guest_wc", side: "north", at: 0.5, width: 0.6, height: 0.6, sill: 1.8 },
    { id: "utility_north", kind: "window", room: "utility", side: "north", at: 1.0, width: 0.9, height: 0.6, sill: 1.8 },
    { id: "wardrobe_north", kind: "window", room: "wardrobe", side: "north", at: 0.8, width: 0.6, height: 0.6, sill: 1.8 },
    { id: "ne_east", kind: "window", room: "master_bedroom", side: "east", at: 1.6, width: 1.5, height: 1.4, sill: 0.9 },
    { id: "entrance_door", kind: "front_door", room: "entrance", side: "south", at: 1.02, width: 1.0, height: 2.15, sill: 0 },
    { id: "kitchen_south", kind: "window", room: "kitchen", side: "south", at: 2.15, width: 1.5, height: 1.4, sill: 0.9 },
    { id: "living_south", kind: "window", room: "living", side: "south", at: 3.3, width: 1.8, height: 1.5, sill: 0.9 },
    { id: "living_east", kind: "sliding_door", room: "living", side: "east", at: 3.0, width: 2.4, height: 2.3, sill: 0 }
  ],
  connections: [
    // Both west bedroom doors sit beside the partition between them and swing into the rooms.
    { id: "door_sw", kind: "door", rooms: ["bedroom_sw", "entrance"], at: -0.5, width: 0.9, swingInto: "bedroom_sw", hinge: "end" },
    { id: "door_nw", kind: "door", rooms: ["bedroom_nw", "entrance"], at: 0.5, width: 0.8, swingInto: "bedroom_nw", hinge: "start" },
    // The entrance's east wall is solid (kitchen counter behind it); the hall opens to the kitchen at its north end.
    { id: "opening_entrance_kitchen", kind: "cased_opening", rooms: ["entrance", "kitchen"], at: -0.635, width: 1.17 },
    { id: "door_bath", kind: "door", rooms: ["bathroom", "entrance"], at: -0.5, width: 0.8, swingInto: "bathroom", hinge: "end" },
    { id: "door_wc", kind: "door", rooms: ["guest_wc", "kitchen"], at: -0.35, width: 0.6, swingInto: "guest_wc", hinge: "end" },
    { id: "door_utility", kind: "door", rooms: ["utility", "kitchen"], at: 0.5, width: 0.8, swingInto: "utility", hinge: "start" },
    { id: "open_kitchen_living", kind: "open", rooms: ["kitchen", "living"], at: "full", width: 0 },
    { id: "door_wardrobe", kind: "door", rooms: ["wardrobe", "living"], at: 0.5, width: 0.8, swingInto: "wardrobe", hinge: "start" },
    { id: "door_ne", kind: "door", rooms: ["master_bedroom", "living"], at: -0.55, width: 0.9, swingInto: "master_bedroom", hinge: "end" }
  ],
  gableGlazing: [],
  skylights: [],
  site: {
    plot: { x: -12, y: -14, w: 40, h: 32 },
    latitude: 47.5,
    dayOfYear: 228,
    // The drawing's north mark points down: true north is on the bedroom-free (plan south) side.
    northAngleDeg: 180
  }
};

export const housePresets: HousePreset[] = [
  {
    id: "courtyard",
    name: "Courtyard L",
    tagline: "Contemporary Norwegian home · Hungary",
    blurb: "The original. An L around a planted terrace, charcoal metal roof, vaulted living room to the east.",
    swatch: ["#6e7f72", "#2b2e31", "#e3ddd2"],
    spec: houseSpec
  },
  {
    id: "garden-gable",
    name: "Garden gable",
    tagline: "Long cottage · terracotta roof · Hungary",
    blurb: "A long garden cottage. Gallery hall, bedrooms to the west, French doors and a round gable window facing south.",
    swatch: ["#c2beb4", "#a33d32", "#f7f5f0"],
    spec: gardenGableSpec
  },
  {
    id: "family-plan",
    name: "Family plan",
    tagline: "14.2 × 8.4 m · 15 m² terrace",
    blurb: "The measured drawing. Three bedrooms, kitchen and living room, ceramic terrace on the east.",
    swatch: ["#e4ddd2", "#6a6058", "#f7f4ee"],
    spec: familyPlanSpec
  }
];

export function presetById(id: string): HousePreset {
  return housePresets.find((p) => p.id === id) ?? housePresets[0];
}
