import type { MeshBuilder } from "../../architecture/MeshBuilder";
import type { MatKey } from "../../scene/Materials";

/**
 * Procedural Scandinavian furniture. Local frame: footprint centered on the origin, floor at y = 0,
 * front facing +z, width along x. Dimensions come from the catalog so they stay realistic.
 */
export type Builder = (mb: MeshBuilder, w: number, d: number, h: number) => void;

/** Box with its base at y. */
function bx(mb: MeshBuilder, k: MatKey, x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
  mb.box(k, x, y + sy / 2, z, sx, sy, sz);
}

function legs(mb: MeshBuilder, k: MatKey, w: number, d: number, h: number, inset = 0.05, r = 0.02): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.cylinder(k, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), r, r * 0.75, h, 8);
}

function flame(mb: MeshBuilder, x: number, y: number, z: number): void {
  mb.cylinder("ceramic", x, y + 0.05, z, 0.025, 0.025, 0.1, 10);
  mb.sphere("fire", x, y + 0.115, z, 0.008, 1, 2, 1, 6);
}

function books(mb: MeshBuilder, x0: number, x1: number, y: number, z: number, depth: number, maxH: number, seed: number): void {
  let x = x0;
  let s = seed;
  const keys: MatKey[] = ["book", "fjordFabric", "oakDark", "linen", "sageFabric", "cushionAccent"];
  while (x < x1 - 0.04) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const t = 0.02 + r * 0.035;
    const h = maxH * (0.7 + r * 0.3);
    bx(mb, keys[Math.floor(r * keys.length)], x + t / 2, y, z, t, h, depth * (0.8 + r * 0.2));
    x += t + 0.002;
    if (r > 0.88) x += 0.12;
  }
}

function plant(mb: MeshBuilder, x: number, y: number, z: number, size: number): void {
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const r = size * 0.35;
    mb.sphere("leaf", x + Math.cos(a) * r * 0.6, y + size * (0.5 + 0.3 * Math.sin(i * 1.7)), z + Math.sin(a) * r * 0.6, size * 0.28, 1.2, 0.7, 1.2, 10);
  }
  mb.sphere("leaf", x, y + size * 0.85, z, size * 0.3, 1, 0.8, 1, 10);
}

// ---------------------------------------------------------------- living
const sofa: Builder = (mb, w, d, h) => {
  const legH = 0.1;
  legs(mb, "oakDark", w - 0.1, d - 0.1, legH, 0.04, 0.02);
  bx(mb, "wool", 0, legH, 0, w, 0.24, d);
  bx(mb, "wool", 0, legH, -d / 2 + 0.11, w, h - legH, 0.22);
  for (const s of [-1, 1]) bx(mb, "wool", s * (w / 2 - 0.09), legH, 0.02, 0.18, 0.56 - legH, d - 0.04);
  const seats = 3;
  const sw = (w - 0.36) / seats;
  for (let i = 0; i < seats; i += 1) {
    const x = -w / 2 + 0.18 + sw * (i + 0.5);
    bx(mb, "wool", x, legH + 0.24, 0.08, sw - 0.02, 0.16, d - 0.3);
    bx(mb, "wool", x, legH + 0.36, -d / 2 + 0.3, sw - 0.04, 0.38, 0.16);
  }
  bx(mb, "cushionAccent", -w / 2 + 0.38, legH + 0.42, -d / 2 + 0.42, 0.42, 0.38, 0.12);
  bx(mb, "fjordFabric", w / 2 - 0.4, legH + 0.42, -d / 2 + 0.42, 0.42, 0.38, 0.12);
  bx(mb, "linen", w / 2 - 0.45, legH + 0.4, 0.05, 0.5, 0.03, d - 0.35);
};

const armchair: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.3, 0.06, 0.022);
  for (const s of [-1, 1]) bx(mb, "oak", s * (w / 2 - 0.03), 0.3, 0, 0.05, 0.3, d - 0.06);
  bx(mb, "linen", 0, 0.3, 0.04, w - 0.12, 0.14, d - 0.14);
  bx(mb, "linen", 0, 0.42, -d / 2 + 0.1, w - 0.12, h - 0.42, 0.14);
  bx(mb, "duvet", 0, 0.44, 0.0, w - 0.2, 0.02, d - 0.3);
};

const coffeeTable: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, h - 0.04, 0.08, 0.022);
  bx(mb, "oak", 0, h - 0.04, 0, w, 0.04, d);
  bx(mb, "oakDark", 0, 0.12, 0, w - 0.2, 0.02, d - 0.15);
  books(mb, -w / 2 + 0.15, -w / 2 + 0.4, h, 0.0, 0.22, 0.04, 7);
  flame(mb, w / 4, h, 0.05);
  flame(mb, w / 4 + 0.08, h, -0.04);
};

const rug = (key: MatKey): Builder => (mb, w, d) => bx(mb, key, 0, 0, 0, w, 0.012, d);
const rugRound: Builder = (mb, w) => mb.cylinder("rug", 0, 0.006, 0, w / 2, w / 2, 0.012, 32);

const woodStove: Builder = (mb, w, d, h) => {
  bx(mb, "stone", 0, 0, 0.05, w, 0.04, d - 0.1);
  const bw = 0.5;
  const bd = 0.42;
  bx(mb, "stoveBlack", 0, 0.04, -d / 2 + bd / 2 + 0.05, bw, 0.95, bd);
  bx(mb, "fire", 0, 0.32, -d / 2 + bd + 0.051, bw * 0.62, 0.32, 0.01);
  bx(mb, "stoveBlack", 0, 0.99, -d / 2 + bd / 2 + 0.05, bw + 0.04, 0.04, bd + 0.04);
  mb.cylinder("stoveBlack", 0, 1.03 + (h - 1.03) / 2, -d / 2 + bd / 2 + 0.05, 0.075, 0.075, h - 1.03, 16);
  // log stack
  for (let i = 0; i < 6; i += 1) mb.cylinder("oakDark", w / 2 - 0.12, 0.1 + (i % 3) * 0.08, -0.1 + Math.floor(i / 3) * 0.09, 0.04, 0.04, 0.3, 8);
};

const mediaSideboard: Builder = (mb, w, d, h) => {
  legs(mb, "metalBlack", w, d, 0.16, 0.05, 0.012);
  bx(mb, "oak", 0, 0.16, 0, w, h - 0.16, d);
  for (let i = 1; i < 3; i += 1) bx(mb, "oakDark", -w / 2 + (w * i) / 3, 0.18, d / 2 + 0.001, 0.006, h - 0.2, 0.004);
  bx(mb, "metalBlack", -w * 0.12, h, -0.05, 0.25, 0.04, 0.18);
  bx(mb, "stoveBlack", -w * 0.12, h + 0.04, -0.06, 1.1, 0.64, 0.03);
  books(mb, w * 0.22, w / 2 - 0.05, h, 0, d * 0.7, 0.24, 13);
  mb.cylinder("ceramic", w / 2 - 0.15, h + 0.13, 0.05, 0.05, 0.07, 0.26, 12);
};

const bookshelf: Builder = (mb, w, d, h) => {
  for (const s of [-1, 1]) bx(mb, "oak", s * (w / 2 - 0.01), 0, 0, 0.02, h, d);
  const shelves = 5;
  for (let i = 0; i <= shelves; i += 1) {
    const y = 0.05 + ((h - 0.08) * i) / shelves;
    bx(mb, "oak", 0, y, 0, w - 0.04, 0.02, d);
    if (i < shelves) books(mb, -w / 2 + 0.04, w / 2 - 0.04, y + 0.02, 0, d * 0.85, (h - 0.1) / shelves - 0.06, 31 + i * 17);
  }
};

const floorLamp: Builder = (mb, w, _d, h) => {
  mb.cylinder("metalBlack", 0, 0.015, 0, w * 0.4, w * 0.45, 0.03, 20);
  mb.cylinder("metalBlack", 0, (h - 0.3) / 2, 0, 0.012, 0.012, h - 0.3, 8);
  mb.cylinder("lampShade", 0, h - 0.16, 0, 0.15, 0.22, 0.3, 24);
  mb.sphere("bulb", 0, h - 0.2, 0, 0.04, 1, 1, 1, 10);
};

const tableLamp: Builder = (mb, w, _d, h) => {
  mb.sphere("ceramic", 0, h * 0.28, 0, w * 0.3, 1, 1.2, 1, 16);
  mb.cylinder("metalBlack", 0, h * 0.55, 0, 0.008, 0.008, h * 0.3, 6);
  mb.cylinder("lampShade", 0, h - 0.1, 0, w * 0.36, w * 0.48, 0.2, 20);
  mb.sphere("bulb", 0, h - 0.13, 0, 0.025, 1, 1, 1, 8);
};

/** Pendant: shade at y = 0 (the placement's elevation), cord rising h meters. */
const pendant: Builder = (mb, w, _d, h) => {
  mb.cylinder("metalBlack", 0, 0.2 + h / 2, 0, 0.004, 0.004, h, 4);
  mb.sphere("lampShade", 0, 0.05, 0, w / 2, 1, 0.55, 1, 24);
  mb.cylinder("lampShade", 0, 0.16, 0, 0.04, w / 2 - 0.02, 0.1, 20);
  mb.sphere("bulb", 0, 0.04, 0, 0.035, 1, 1, 1, 10);
};

const ceilingLight: Builder = (mb, w) => {
  mb.cylinder("lampShade", 0, -0.04, 0, w / 2, w / 2.4, 0.06, 24);
};

const wallLight: Builder = (mb, w, d) => {
  bx(mb, "metalBlack", 0, -0.1, -d / 2 + 0.01, 0.08, 0.2, 0.02);
  mb.cylinder("lampShade", 0, 0, 0, w / 2, w / 2.6, 0.18, 16);
  mb.sphere("bulb", 0, -0.04, 0, 0.03, 1, 1, 1, 8);
};

const plantLarge: Builder = (mb, w, _d, h) => {
  mb.cylinder("pot", 0, 0.18, 0, w * 0.32, w * 0.26, 0.36, 18);
  mb.cylinder("soil", 0, 0.35, 0, w * 0.3, w * 0.3, 0.01, 18);
  mb.cylinder("bark", 0, 0.36 + (h - 0.36) * 0.3, 0, 0.015, 0.015, (h - 0.36) * 0.6, 6);
  plant(mb, 0, 0.36, 0, h - 0.36);
};

// ---------------------------------------------------------------- dining & kitchen
const diningTable: Builder = (mb, w, d, h) => {
  for (const sx of [-1, 1]) {
    bx(mb, "oak", sx * (w / 2 - 0.25), 0, 0, 0.07, h - 0.04, d - 0.3);
  }
  bx(mb, "oak", 0, h - 0.12, 0, w - 0.55, 0.06, 0.06);
  bx(mb, "oak", 0, h - 0.04, 0, w, 0.04, d);
  bx(mb, "linen", 0, h, 0, w * 0.45, 0.004, 0.36);
  for (const x of [-0.12, 0, 0.12]) flame(mb, x, h, 0);
  mb.cylinder("ceramic", w * 0.32, h + 0.09, 0.05, 0.06, 0.05, 0.18, 12);
  plant(mb, w * 0.32, h + 0.12, 0.05, 0.25);
};

const diningChair: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.45, 0.04, 0.016);
  bx(mb, "oak", 0, 0.43, 0, w, 0.03, d);
  bx(mb, "linen", 0, 0.46, 0.02, w - 0.06, 0.02, d - 0.1);
  for (const s of [-1, 1]) bx(mb, "oak", s * (w / 2 - 0.04), 0.45, -d / 2 + 0.03, 0.025, h - 0.45, 0.025);
  bx(mb, "oak", 0, h - 0.14, -d / 2 + 0.03, w - 0.04, 0.12, 0.02);
};

function counterBody(mb: MeshBuilder, w: number, d: number, h: number): void {
  bx(mb, "metalBlack", 0, 0, -0.02, w - 0.02, 0.1, d - 0.08);
  bx(mb, "whiteLacquer", 0, 0.1, 0, w - 0.004, h - 0.14, d - 0.03);
  bx(mb, "oakDark", 0, h - 0.11, d / 2 - 0.014, w - 0.04, 0.012, 0.004);
  bx(mb, "oak", 0, h - 0.04, 0.01, w, 0.04, d);
}

const baseCabinet: Builder = (mb, w, d, h) => counterBody(mb, w, d, h);

const sinkCabinet: Builder = (mb, w, d, h) => {
  counterBody(mb, w, d, h);
  bx(mb, "steel", 0, h - 0.002, 0.02, w - 0.14, 0.004, d - 0.22);
  mb.cylinder("metalBlack", 0, h + 0.15, -d / 2 + 0.1, 0.012, 0.012, 0.3, 8);
  bx(mb, "metalBlack", 0, h + 0.29, -d / 2 + 0.17, 0.02, 0.02, 0.15);
};

const cooktopCabinet: Builder = (mb, w, d, h) => {
  counterBody(mb, w, d, h);
  // Induction hob with integrated downdraft extraction (keeps the window above clear).
  bx(mb, "stoveBlack", 0, h, 0.02, w - 0.06, 0.006, d - 0.12);
  bx(mb, "metalBlack", 0, h, -d / 2 + 0.08, w - 0.1, 0.008, 0.05);
};

const tallUnit = (kind: "fridge" | "oven" | "pantry"): Builder => (mb, w, d, h) => {
  bx(mb, "metalBlack", 0, 0, -0.02, w - 0.02, 0.1, d - 0.08);
  bx(mb, "whiteLacquer", 0, 0.1, 0, w - 0.004, h - 0.1, d - 0.02);
  const split = kind === "fridge" ? 0.95 : 1.35;
  bx(mb, "oakDark", 0, split, d / 2 - 0.009, w - 0.03, 0.008, 0.004);
  if (kind === "oven") bx(mb, "stoveBlack", 0, 0.85, d / 2 - 0.009, w - 0.06, 0.56, 0.006);
};

const kitchenIsland: Builder = (mb, w, d, h) => {
  bx(mb, "metalBlack", 0, 0, -0.08, w - 0.06, 0.1, d - 0.36);
  bx(mb, "sageFabric", 0, 0.1, -0.12, w - 0.04, h - 0.14, d - 0.28);
  bx(mb, "oak", 0, h - 0.04, 0, w, 0.04, d);
  mb.cylinder("ceramic", -w * 0.3, h + 0.04, -0.15, 0.13, 0.1, 0.08, 18);
  for (let i = 0; i < 3; i += 1) mb.sphere("cushionAccent", -w * 0.3 + (i - 1) * 0.05, h + 0.1, -0.15, 0.04, 1, 1, 1, 8);
};

const barStool: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, h - 0.03, 0.03, 0.015);
  bx(mb, "oak", 0, h * 0.35, 0, w - 0.06, 0.02, 0.02);
  mb.cylinder("oak", 0, h - 0.015, 0, w / 2, w / 2, 0.03, 20);
};

const openShelf: Builder = (mb, w, d) => {
  bx(mb, "oak", 0, 0, 0, w, 0.035, d);
  for (let i = 0; i < 5; i += 1) mb.cylinder("ceramic", -w / 2 + 0.15 + i * 0.12, 0.1, 0, 0.045, 0.045, 0.13, 12);
  books(mb, w / 2 - 0.45, w / 2 - 0.05, 0.035, 0, d * 0.8, 0.22, 77);
};

// ---------------------------------------------------------------- bedrooms
const bedDouble: Builder = (mb, w, d, h) => {
  const frameH = 0.32;
  legs(mb, "oak", w - 0.04, d - 0.04, 0.12, 0.06, 0.03);
  bx(mb, "oak", 0, 0.12, 0.03, w, frameH - 0.12, d - 0.06);
  bx(mb, "fjordFabric", 0, 0.12, -d / 2 + 0.04, w, h - 0.12, 0.08);
  bx(mb, "duvet", 0, frameH, 0.04, w - 0.12, 0.2, d - 0.18);
  bx(mb, "linen", 0, frameH + 0.2, 0.18, w - 0.08, 0.06, d - 0.6);
  for (const s of [-1, 1]) {
    bx(mb, "duvet", s * (w / 4 - 0.02), frameH + 0.2, -d / 2 + 0.3, w / 2 - 0.16, 0.13, 0.36);
    bx(mb, "linen", s * (w / 4 - 0.05), frameH + 0.24, -d / 2 + 0.48, w / 2 - 0.3, 0.12, 0.12);
  }
  bx(mb, "cushionAccent", 0, frameH + 0.26, d / 2 - 0.45, w - 0.06, 0.02, 0.45);
};

const bedSingle: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.12, 0.05, 0.025);
  bx(mb, "oak", 0, 0.12, 0, w, 0.18, d);
  bx(mb, "oak", 0, 0.12, -d / 2 + 0.02, w, h - 0.12, 0.04);
  bx(mb, "duvet", 0, 0.3, 0.02, w - 0.06, 0.16, d - 0.08);
  bx(mb, "sageFabric", 0, 0.46, 0.2, w - 0.02, 0.05, d - 0.55);
  bx(mb, "duvet", 0, 0.46, -d / 2 + 0.25, w - 0.25, 0.12, 0.32);
  mb.sphere("cushionAccent", w * 0.22, 0.56, -d / 2 + 0.55, 0.09, 1, 0.9, 0.8, 12);
};

const bunkBed: Builder = (mb, w, d, h) => {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(mb, "oak", sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), 0.06, h, 0.06);
  for (const y of [0.18, 1.12]) {
    bx(mb, "oak", 0, y, 0, w, 0.12, d);
    bx(mb, "duvet", 0, y + 0.12, 0, w - 0.08, 0.14, d - 0.08);
    bx(mb, "fjordFabric", 0, y + 0.26, 0.15, w - 0.06, 0.04, d - 0.6);
    bx(mb, "duvet", 0, y + 0.26, -d / 2 + 0.22, w - 0.3, 0.1, 0.28);
  }
  bx(mb, "oak", 0, h - 0.18, d / 2 - 0.03, w - 0.06, 0.12, 0.04);
  bx(mb, "oak", 0, h - 0.18, -d / 2 + 0.03, w - 0.06, 0.12, 0.04);
  for (let i = 0; i < 5; i += 1) bx(mb, "oak", w / 2 - 0.02, 0.3 + i * 0.27, d / 2 - 0.35, 0.03, 0.03, 0.4);
};

const nightstand: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.16, 0.03, 0.012);
  bx(mb, "oak", 0, 0.16, 0, w, h - 0.16, d);
  bx(mb, "oakDark", 0, h - 0.1, d / 2 + 0.001, w - 0.08, 0.006, 0.004);
  books(mb, -w / 2 + 0.05, -w / 2 + 0.2, h, 0.05, 0.18, 0.04, 3);
};

const wardrobe: Builder = (mb, w, d, h) => {
  bx(mb, "metalBlack", 0, 0, -0.02, w - 0.02, 0.08, d - 0.06);
  bx(mb, "whiteLacquer", 0, 0.08, 0, w, h - 0.08, d);
  const doors = Math.max(2, Math.round(w / 0.5));
  for (let i = 1; i < doors; i += 1) bx(mb, "oakDark", -w / 2 + (w * i) / doors, 0.1, d / 2 + 0.001, 0.005, h - 0.12, 0.004);
  for (let i = 0; i < doors; i += 1) bx(mb, "oak", -w / 2 + (w * (i + 0.5)) / doors + (i % 2 ? -1 : 1) * 0.18, 0.95, d / 2 + 0.01, 0.02, 0.3, 0.02);
};

const bench: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, h - 0.04, 0.06, 0.02);
  for (let i = 0; i < 4; i += 1) bx(mb, "oak", 0, h - 0.04, -d / 2 + 0.05 + i * (d - 0.1) / 3, w, 0.04, d / 4.4);
};

const dresser: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.14, 0.04, 0.014);
  bx(mb, "oak", 0, 0.14, 0, w, h - 0.14, d);
  for (let i = 1; i < 3; i += 1) bx(mb, "oakDark", 0, 0.14 + ((h - 0.14) * i) / 3, d / 2 + 0.001, w - 0.04, 0.006, 0.004);
};

const deskSimple = (withMonitor: boolean): Builder => (mb, w, d, h) => {
  for (const sx of [-1, 1]) {
    bx(mb, "metalBlack", sx * (w / 2 - 0.04), 0, 0, 0.03, h - 0.03, d - 0.08);
  }
  bx(mb, "oak", 0, h - 0.03, 0, w, 0.03, d);
  if (withMonitor) {
    bx(mb, "metalBlack", 0, h, -d / 2 + 0.18, 0.2, 0.01, 0.16);
    mb.cylinder("metalBlack", 0, h + 0.15, -d / 2 + 0.16, 0.012, 0.012, 0.3, 6);
    bx(mb, "stoveBlack", 0, h + 0.15, -d / 2 + 0.14, 0.62, 0.36, 0.02);
    bx(mb, "whiteLacquer", 0, h, 0.08, 0.42, 0.015, 0.14);
    bx(mb, "linen", w / 2 - 0.25, h, 0.0, 0.22, 0.06, 0.3);
  } else {
    books(mb, -w / 2 + 0.05, -w / 2 + 0.3, h, -d / 2 + 0.15, 0.2, 0.22, 99);
    bx(mb, "cushionAccent", 0.05, h, 0.05, 0.3, 0.01, 0.22);
  }
};

const officeChair: Builder = (mb, w, d, h) => {
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    mb.box("metalBlack", Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17, 0.32, 0.03, 0.04, -a);
  }
  mb.cylinder("metalBlack", 0, 0.25, 0, 0.025, 0.025, 0.36, 8);
  bx(mb, "wool", 0, 0.43, 0.02, w - 0.12, 0.08, d - 0.14);
  bx(mb, "wool", 0, 0.55, -d / 2 + 0.07, w - 0.16, h - 0.55, 0.06);
};

const deskChairKids: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.42, 0.04, 0.014);
  bx(mb, "oak", 0, 0.42, 0, w, 0.03, d);
  bx(mb, "sageFabric", 0, 0.62, -d / 2 + 0.02, w - 0.02, h - 0.62, 0.03);
};

const loungeChair: Builder = (mb, w, d, h) => {
  legs(mb, "oak", w, d, 0.28, 0.05, 0.022);
  bx(mb, "oak", 0, 0.24, 0.02, w, 0.04, d - 0.04);
  bx(mb, "duvet", 0, 0.28, 0.04, w - 0.08, 0.12, d - 0.2);
  mb.box("duvet", 0, 0.62, -d / 2 + 0.16, w - 0.08, 0.6, 0.12);
};

const shelfUnit: Builder = (mb, w, d, h) => bookshelf(mb, w, d, h);

const lowBookshelf: Builder = (mb, w, d, h) => {
  bx(mb, "oak", 0, 0, 0, w, 0.02, d);
  for (const s of [-1, 1]) bx(mb, "oak", s * (w / 2 - 0.01), 0, 0, 0.02, h, d);
  for (const y of [h / 2, h - 0.02]) bx(mb, "oak", 0, y, 0, w, 0.02, d);
  books(mb, -w / 2 + 0.03, w / 2 - 0.03, 0.02, 0, d * 0.8, h / 2 - 0.06, 55);
  books(mb, -w / 2 + 0.03, w / 2 - 0.2, h / 2 + 0.02, 0, d * 0.8, h / 2 - 0.08, 56);
  mb.sphere("cushionAccent", w / 2 - 0.12, h + 0.08, 0, 0.08, 1, 1, 1, 10);
};

const toyBox: Builder = (mb, w, d, h) => {
  bx(mb, "sageFabric", 0, 0, 0, w, h, d);
  mb.sphere("cushionAccent", -0.1, h + 0.05, 0, 0.06, 1, 1, 1, 10);
  mb.sphere("fjordFabric", 0.12, h + 0.04, 0.05, 0.05, 1, 1, 1, 10);
};

// ---------------------------------------------------------------- bathroom & utility
const bathtub: Builder = (mb, w, d, h) => {
  bx(mb, "ceramic", 0, 0, 0, w, 0.12, d);
  for (const s of [-1, 1]) {
    bx(mb, "ceramic", 0, 0.12, s * (d / 2 - 0.04), w, h - 0.12, 0.08);
    bx(mb, "ceramic", s * (w / 2 - 0.05), 0.12, 0, 0.1, h - 0.12, d - 0.16);
  }
  bx(mb, "glass", 0, 0.12, 0, w - 0.22, h - 0.2, d - 0.18);
  mb.cylinder("metalBlack", -w / 2 + 0.06, h + 0.12, -d / 2 + 0.06, 0.012, 0.012, 0.25, 8);
  bx(mb, "metalBlack", -w / 2 + 0.12, h + 0.24, -d / 2 + 0.06, 0.14, 0.02, 0.02);
  bx(mb, "linen", w / 2 - 0.25, h, d / 2 - 0.05, 0.4, 0.04, 0.1);
};

const toilet: Builder = (mb, w, d, h) => {
  bx(mb, "whiteLacquer", 0, 0, -d / 2 + 0.08, w + 0.16, 1.05, 0.16);
  bx(mb, "steel", 0, 0.98, -d / 2 + 0.161, 0.2, 0.12, 0.004);
  mb.sphere("ceramic", 0, 0.3, 0.06, w / 2, 1, 0.55, 1.35, 18);
  mb.cylinder("ceramic", 0, 0.395, 0.06, w / 2 - 0.01, w / 2 - 0.01, 0.03, 20);
  void h;
};

const vanity = (basinW: number): Builder => (mb, w, d, h) => {
  bx(mb, "oak", 0, h - 0.48, 0, w, 0.4, d);
  bx(mb, "oakDark", 0, h - 0.3, d / 2 + 0.001, w - 0.04, 0.006, 0.004);
  bx(mb, "ceramic", 0, h - 0.08, 0.02, basinW, 0.1, d - 0.08);
  mb.cylinder("metalBlack", 0, h + 0.1, -d / 2 + 0.06, 0.012, 0.012, 0.2, 8);
  bx(mb, "metalBlack", 0, h + 0.19, -d / 2 + 0.11, 0.02, 0.02, 0.12);
  bx(mb, "mirror", 0, h + 0.3, -d / 2 + 0.01, Math.min(w, 0.9), 0.75, 0.01);
  bx(mb, "lampShade", 0, h + 1.1, -d / 2 + 0.04, Math.min(w, 0.6), 0.04, 0.06);
  mb.cylinder("ceramic", w / 2 - 0.1, h + 0.06, 0.0, 0.03, 0.03, 0.12, 8);
};

const basinSmall: Builder = (mb, w, d, h) => {
  bx(mb, "ceramic", 0, h - 0.14, 0, w, 0.14, d);
  mb.cylinder("metalBlack", 0, h + 0.08, -d / 2 + 0.05, 0.01, 0.01, 0.16, 8);
  bx(mb, "mirror", 0, h + 0.25, -d / 2 + 0.005, w, 0.6, 0.01);
  bx(mb, "lampShade", 0, h + 0.95, -d / 2 + 0.03, w, 0.04, 0.05);
};

const tallStorage: Builder = (mb, w, d, h) => {
  bx(mb, "oak", 0, 0.1, 0, w, h - 0.1, d);
  bx(mb, "metalBlack", 0, 0, 0, w - 0.04, 0.1, d - 0.04);
};

const towelLadder: Builder = (mb, w, _d, h) => {
  for (const s of [-1, 1]) mb.cylinder("oak", s * (w / 2 - 0.02), h / 2, 0, 0.015, 0.015, h, 6);
  for (let i = 1; i < 5; i += 1) mb.box("oak", 0, (h * i) / 5, 0, w, 0.02, 0.02);
  bx(mb, "linen", 0, h * 0.55, 0.02, w - 0.06, 0.4, 0.03);
};

const wallCabinetSmall: Builder = (mb, w, d, h) => bx(mb, "oak", 0, 0, 0, w, h, d);

const laundryCounter: Builder = (mb, w, d, h) => {
  const mw = 0.6;
  for (const x of [-w / 2 + mw / 2 + 0.02, -w / 2 + mw * 1.5 + 0.04]) {
    bx(mb, "ceramic", x, 0, 0, mw, 0.85, d - 0.04);
    mb.cylinder("stoveBlack", x, 0.45, d / 2 - 0.02, 0.2, 0.2, 0.01, 24);
    mb.cylinder("glass", x, 0.45, d / 2 - 0.01, 0.16, 0.16, 0.01, 24);
  }
  bx(mb, "oak", 0, h - 0.04, 0, w, 0.04, d);
  mb.cylinder("linen", w / 2 - 0.2, h + 0.15, 0.0, 0.17, 0.15, 0.3, 14);
};

const utilityShelf: Builder = (mb, w, d, h) => {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(mb, "metalBlack", sx * (w / 2 - 0.015), 0, sz * (d / 2 - 0.015), 0.03, h, 0.03);
  for (let i = 0; i < 5; i += 1) {
    const y = 0.1 + ((h - 0.15) * i) / 4;
    bx(mb, "oak", 0, y, 0, w, 0.02, d);
    if (i < 4) for (let k = 0; k < 3; k += 1) bx(mb, (["linen", "sageFabric", "book"] as MatKey[])[(i + k) % 3], -w / 2 + 0.16 + k * 0.29, y + 0.02, 0, 0.26, 0.24, d - 0.06);
  }
};

// ---------------------------------------------------------------- entrance & hall
const coatCabinet: Builder = (mb, w, d, h) => {
  const closed = w * 0.5;
  bx(mb, "oak", -w / 2 + closed / 2, 0, 0, closed, h, d);
  bx(mb, "oakDark", -w / 2 + closed / 2, 0.1, d / 2 + 0.001, 0.005, h - 0.15, 0.004);
  const ox = w / 2 - (w - closed) / 2;
  bx(mb, "oak", ox, h - 0.03, 0, w - closed, 0.03, d);
  bx(mb, "oak", ox, 0.42, 0, w - closed, 0.04, d);
  bx(mb, "oak", ox, 1.75, -d / 2 + 0.02, w - closed, 0.06, 0.03);
  const coats: MatKey[] = ["wool", "fjordFabric", "cushionAccent"];
  coats.forEach((k, i) => bx(mb, k, ox - (w - closed) / 2 + 0.12 + i * 0.17, 0.9, -d / 2 + 0.16, 0.14, 0.82, 0.24));
  for (let i = 0; i < 3; i += 1) bx(mb, "stoveBlack", ox - 0.15 + i * 0.14, 0.02, 0.05, 0.1, 0.08, 0.26);
};

const entryBench: Builder = (mb, w, d, h) => {
  bench(mb, w, d, h);
  bx(mb, "wool", -w / 4, h, 0, w / 2.5, 0.05, d - 0.06);
  for (let i = 0; i < 2; i += 1) bx(mb, "oakDark", -w / 2 + 0.2 + i * 0.3, 0, 0.0, 0.11, 0.07, 0.27);
};

const mirrorWall: Builder = (mb, w, d, h) => {
  bx(mb, "oak", 0, 0.35, -d / 2 + 0.01, w, h - 0.35, 0.02);
  bx(mb, "mirror", 0, 0.39, -d / 2 + 0.021, w - 0.06, h - 0.43, 0.004);
};

// ---------------------------------------------------------------- outdoor
const outdoorTable: Builder = (mb, w, d, h) => {
  for (const sx of [-1, 1]) bx(mb, "metalBlack", sx * (w / 2 - 0.3), 0, 0, 0.05, h - 0.05, d - 0.2);
  for (let i = 0; i < 6; i += 1) bx(mb, "screenTimber", 0, h - 0.04, -d / 2 + (d / 6) * (i + 0.5), w, 0.04, d / 6 - 0.01);
  for (const x of [-0.5, 0.5]) flame(mb, x, h, 0);
  mb.cylinder("ceramic", 0, h + 0.1, 0, 0.08, 0.06, 0.2, 12);
  plant(mb, 0, h + 0.15, 0, 0.3);
};

const outdoorChair: Builder = (mb, w, d, h) => {
  legs(mb, "metalBlack", w, d, 0.44, 0.04, 0.012);
  for (let i = 0; i < 4; i += 1) bx(mb, "screenTimber", 0, 0.44, -d / 2 + 0.06 + i * ((d - 0.1) / 4), w, 0.03, d / 4 - 0.02);
  bx(mb, "metalBlack", 0, 0.47, -d / 2 + 0.02, w, h - 0.47, 0.02);
  bx(mb, "outdoorFabric", 0, 0.47, 0.02, w - 0.06, 0.04, d - 0.1);
};

const outdoorSofa: Builder = (mb, w, d, h) => {
  bx(mb, "screenTimber", 0, 0.08, 0, w, 0.3, d);
  legs(mb, "metalBlack", w, d, 0.08, 0.05, 0.02);
  bx(mb, "screenTimber", 0, 0.38, -d / 2 + 0.05, w, h - 0.38, 0.1);
  for (const s of [-1, 1]) bx(mb, "screenTimber", s * (w / 2 - 0.05), 0.38, 0, 0.1, 0.22, d);
  bx(mb, "outdoorFabric", 0, 0.38, 0.05, w - 0.22, 0.12, d - 0.2);
  bx(mb, "outdoorFabric", 0, 0.5, -d / 2 + 0.18, w - 0.22, 0.32, 0.14);
  bx(mb, "fjordFabric", -w / 2 + 0.35, 0.5, -d / 2 + 0.3, 0.38, 0.32, 0.1);
};

const outdoorLounge: Builder = (mb, w, d, h) => {
  bx(mb, "screenTimber", 0, 0.08, 0, w, 0.22, d);
  legs(mb, "metalBlack", w, d, 0.08, 0.05, 0.02);
  bx(mb, "screenTimber", 0, 0.3, -d / 2 + 0.05, w, h - 0.3, 0.1);
  bx(mb, "outdoorFabric", 0, 0.3, 0.05, w - 0.1, 0.12, d - 0.2);
  bx(mb, "outdoorFabric", 0, 0.42, -d / 2 + 0.17, w - 0.12, 0.3, 0.12);
  bx(mb, "linen", 0.1, 0.43, 0.1, w * 0.5, 0.02, d * 0.4);
};

const outdoorCoffeeTable: Builder = (mb, w, d, h) => {
  bx(mb, "concrete", 0, 0, 0, w, h, d);
  flame(mb, 0.15, h, 0.05);
  flame(mb, 0.25, h, -0.05);
};

const outdoorKitchen: Builder = (mb, w, d, h) => {
  bx(mb, "concrete", 0, 0, 0, w, h - 0.04, d);
  bx(mb, "stone", 0, h - 0.04, 0, w, 0.04, d);
  bx(mb, "steel", w * 0.15, h, 0, w * 0.5, 0.02, d - 0.15);
  bx(mb, "stoveBlack", w * 0.15, h + 0.02, -d / 2 + 0.12, w * 0.5, 0.4, 0.08);
  for (let i = 0; i < 4; i += 1) bx(mb, "metalBlack", w * 0.15 - w * 0.2 + i * (w * 0.13), h + 0.025, 0.03, 0.01, 0.01, d - 0.25);
  bx(mb, "screenTimber", -w / 2 + 0.25, h, 0.0, 0.4, 0.03, 0.3);
};

const planter: Builder = (mb, w, d, h) => {
  bx(mb, "concrete", 0, 0, 0, w, h * 0.55, d);
  for (let i = 0; i < 9; i += 1) {
    const a = i * 2.4;
    mb.cylinder("birchLeaf", Math.cos(a) * w * 0.25, h * 0.55 + h * 0.22, Math.sin(a) * d * 0.25, 0.0, 0.07, h * 0.45, 5);
  }
};

const lantern: Builder = (mb, w, _d, h) => {
  bx(mb, "metalBlack", 0, 0, 0, w, 0.03, w);
  bx(mb, "metalBlack", 0, h - 0.04, 0, w, 0.04, w);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(mb, "metalBlack", sx * (w / 2 - 0.01), 0.03, sz * (w / 2 - 0.01), 0.015, h - 0.07, 0.015);
  bx(mb, "glass", 0, 0.03, 0, w - 0.02, h - 0.07, w - 0.02);
  flame(mb, 0, 0.03, 0);
  mb.sphere("bulb", 0, 0.2, 0, 0.02, 1, 1.4, 1, 8);
};

const bistroTable: Builder = (mb, w, _d, h) => {
  mb.cylinder("metalBlack", 0, 0.01, 0, 0.2, 0.22, 0.02, 16);
  mb.cylinder("metalBlack", 0, h / 2, 0, 0.02, 0.02, h, 8);
  mb.cylinder("screenTimber", 0, h - 0.015, 0, w / 2, w / 2, 0.03, 24);
  flame(mb, 0, h, 0);
  mb.cylinder("glass", 0.15, h + 0.08, 0.05, 0.03, 0.03, 0.16, 10);
  mb.cylinder("glass", 0.08, h + 0.08, -0.12, 0.03, 0.03, 0.16, 10);
};

const benchOutdoor: Builder = (mb, w, d, h) => {
  bench(mb, w, d, h);
  bx(mb, "outdoorFabric", 0, h, 0, w - 0.1, 0.05, d - 0.05);
  bx(mb, "linen", w / 2 - 0.3, h + 0.05, 0, 0.35, 0.05, d - 0.1);
};

export const builders: Record<string, Builder> = {
  sofa,
  armchair,
  coffeeTable,
  rugLiving: rug("rug"),
  rugBed: rug("linen"),
  rugEntry: rug("wool"),
  runner: rug("wool"),
  rugRound,
  woodStove,
  mediaSideboard,
  bookshelf,
  floorLamp,
  tableLamp,
  pendant,
  ceilingLight,
  wallLight,
  plantLarge,
  diningTable,
  diningChair,
  baseCabinet,
  sinkCabinet,
  cooktopCabinet,
  tallFridge: tallUnit("fridge"),
  tallOven: tallUnit("oven"),
  tallPantry: tallUnit("pantry"),
  kitchenIsland,
  barStool,
  openShelf,
  bedDouble,
  bedSingle,
  bunkBed,
  nightstand,
  wardrobe,
  bench,
  dresser,
  desk: deskSimple(true),
  deskKids: deskSimple(false),
  officeChair,
  deskChairKids,
  loungeChair,
  shelfUnit,
  lowBookshelf,
  toyBox,
  bathtub,
  toilet,
  vanity100: vanity(0.6),
  basinSmall,
  tallStorage,
  towelLadder,
  wallCabinetSmall,
  laundryCounter,
  utilityShelf,
  coatCabinet,
  entryBench,
  mirrorWall,
  outdoorTable,
  outdoorChair,
  outdoorSofa,
  outdoorLounge,
  outdoorCoffeeTable,
  outdoorKitchen,
  planter,
  lantern,
  bistroTable,
  benchOutdoor
};
