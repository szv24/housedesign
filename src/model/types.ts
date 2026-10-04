export type Vec2 = { x: number; y: number };

export type Polygon2 = Vec2[];

/** Axis-aligned rectangle in plan coordinates (x east, y north, meters). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = "north" | "south" | "east" | "west";

export type RoomId =
  | "living_kitchen"
  | "master_bedroom"
  | "kids_bedroom_1"
  | "kids_bedroom_2"
  | "office"
  | "bathroom"
  | "guest_wc"
  | "utility"
  | "entrance"
  | "circulation"
  | "bedroom_sw"
  | "bedroom_nw"
  | "bedroom_ne"
  | "kitchen"
  | "living"
  | "wardrobe";

export type CeilingType = "flat" | "vaulted";

export interface Room {
  id: RoomId;
  name: string;
  /** Rectangles that make up the room (merged split-tree leaves). */
  parts: Rect[];
  /** Outline of the merged parts. */
  polygon: Polygon2;
  bounds: Rect;
  width: number;
  length: number;
  area: number;
  ceilingHeight: number;
  ceilingType: CeilingType;
  floorMaterial: string;
  preferredFurnitureLayout: string;
}

export type WallKind = "exterior" | "partition";

export type OpeningKind =
  | "window"
  | "glazed_door"
  | "sliding_door"
  | "front_door"
  | "door"
  | "cased_opening"
  | "open";

export interface WallOpening {
  id: string;
  kind: OpeningKind;
  /** Distance from wall start to opening center, along the wall. */
  center: number;
  width: number;
  sill: number;
  head: number;
  /** Rooms joined by this opening (interior) or the room it serves (exterior). */
  rooms: RoomId[];
  /** Door leaf swings into this room. */
  swingInto?: RoomId;
  hinge?: "start" | "end";
}

export interface Wall {
  id: string;
  kind: WallKind;
  /** Centerline start/end. Exterior walls run counter-clockwise, so the outside is on the right. */
  start: Vec2;
  end: Vec2;
  thickness: number;
  height: number;
  openings: WallOpening[];
  /** Rooms on each side, where known. */
  rooms: RoomId[];
}

export interface Terrace {
  id: string;
  name: string;
  rect: Rect;
  deckHeight: number;
  area: number;
  pergola?: Rect;
  privacyScreens: Array<{ start: Vec2; end: Vec2; height: number }>;
  plantingBuffer?: Rect;
  steps: Rect[];
}

export interface FurniturePlacement {
  id: string;
  catalogId: string;
  roomId: RoomId | string;
  /** Plan position of the footprint center. */
  x: number;
  y: number;
  /** Elevation of the item's base above the floor it stands on. */
  elevation: number;
  /** Rotation in plan, radians, counter-clockwise; 0 means the item's front faces south (-y). */
  rotation: number;
  /** Footprint after rotation (axis-aligned). */
  footprint: Rect;
  width: number;
  depth: number;
  height: number;
  blocksMovement: boolean;
  rationale: string[];
}

export type LightKind = "pendant" | "ceiling" | "floor_lamp" | "table_lamp" | "wall" | "string" | "candle" | "spot";

export interface LightFixture {
  id: string;
  roomId: RoomId | string;
  kind: LightKind;
  x: number;
  y: number;
  /** Height of the light source above the floor. */
  z: number;
  /** Luminous intensity in candela at full output. */
  intensity: number;
  color: number;
  /** String lights: polyline in plan with heights. */
  path?: Array<{ x: number; y: number; z: number }>;
  bulbs?: number;
}

export interface RoofWing {
  id: string;
  /** Footprint rectangle of the wing (outer face of walls). */
  rect: Rect;
  ridgeAxis: "x" | "y";
  /** Extend (or shorten) the roof along the ridge axis; used where the secondary wing meets the primary. */
  ridgeStartExtension: number;
  ridgeEndExtension: number;
  gableAtStart: boolean;
  gableAtEnd: boolean;
}

export interface HouseModel {
  footprint: Polygon2;
  rooms: Room[];
  walls: Wall[];
  terraces: Terrace[];
  roofWings: RoofWing[];
  furniture: FurniturePlacement[];
  lights: LightFixture[];
  floorLevel: number;
  wallHeight: number;
  roofPitchDeg: number;
  roofOverhang: number;
  gableOverhang: number;
  /** Rotation of true north from plan +y, degrees (180 = north is toward plan -y). */
  northAngleDeg: number;
  bounds: Rect;
  meta: {
    grossArea: number;
    interiorArea: number;
  };
}
