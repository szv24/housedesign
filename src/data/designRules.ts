/**
 * Interior design rules. All values in meters. The InteriorDesignEngine reads these;
 * nothing in the rule programs should hard-code clearances.
 */
export const designRules = {
  clearance: {
    /** Main walking routes (door to door, through living spaces). */
    primaryCirculation: 0.9,
    /** Secondary routes (around a bed, behind a sofa). */
    secondaryCirculation: 0.75,
    bedSide: 0.6,
    bedFoot: 0.7,
    wardrobeFront: 0.8,
    diningChairPullback: 0.8,
    /** Edge of a dining table to a wall or tall obstacle when chairs are used. */
    diningTableToWall: 0.95,
    kitchenAisle: 1.1,
    islandClearance: 1.0,
    toiletFront: 0.6,
    toiletSideFromCenter: 0.4,
    sinkFront: 0.7,
    tubFront: 0.7,
    deskChair: 0.9,
    sofaToCoffeeTable: 0.45,
    stoveSafety: 0.9,
    /** Free square in front of every door, swing or not. */
    doorApproach: 0.9,
    terracePath: 1.0,
    grillSafety: 1.0
  },
  body: {
    /** Radius used to inflate obstacles in reachability checks. */
    radius: 0.22
  },
  access: {
    /** An access point counts as reached if a connected free cell lies within this distance. */
    tolerance: 0.2
  },
  kitchen: {
    moduleWidth: 0.6,
    counterDepth: 0.62,
    counterHeight: 0.92,
    islandDepth: 0.95,
    islandMaxLength: 2.4,
    workTriangleMin: 4.0,
    workTriangleMax: 7.9,
    landingBesideCooktop: 0.4,
    landingBesideSink: 0.6
  },
  window: {
    /** Furniture taller than this may not stand in front of a window. */
    maxTallFurnitureInFront: 1.0,
    /** Distance from the wall within which "in front of a window" applies. */
    frontZoneDepth: 0.5
  },
  living: {
    /** Planning depths (west to east) for the open-plan zones, as fractions of the room length. */
    kitchenZoneFraction: 0.37,
    livingZoneFraction: 0.36,
    /** Shade bottom heights above the floor. */
    diningPendantDrop: 1.55,
    islandPendantDrop: 1.65
  },
  grid: {
    cell: 0.1
  }
} as const;

export type DesignRules = typeof designRules;
