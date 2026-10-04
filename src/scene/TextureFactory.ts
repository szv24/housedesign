import * as THREE from "three";

/**
 * Procedural canvas textures. All textures represent a 1 m x 1 m tile unless noted, so
 * geometry with UVs in meters maps them at real-world scale.
 */

const SIZE = 512;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function make(draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void, seed: number, colorSpace = true): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, seeded(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, rnd: () => number, count: number, alpha: number, size = 2) {
  for (let i = 0; i < count; i += 1) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    ctx.fillRect(rnd() * SIZE, rnd() * SIZE, size, size);
  }
}

function grain(ctx: CanvasRenderingContext2D, rnd: () => number, vertical: boolean, lines: number, alpha: number) {
  for (let i = 0; i < lines; i += 1) {
    const p = rnd() * SIZE;
    ctx.strokeStyle = `rgba(60,35,15,${alpha * (0.4 + rnd())})`;
    ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    for (let t = 0; t <= SIZE; t += 16) {
      const wob = Math.sin(t * 0.02 + i) * 2 + (rnd() - 0.5) * 1.5;
      if (vertical) (t === 0 ? ctx.moveTo(p + wob, t) : ctx.lineTo(p + wob, t));
      else (t === 0 ? ctx.moveTo(t, p + wob) : ctx.lineTo(t, p + wob));
    }
    ctx.stroke();
  }
}

/** Greyscale-ish multipliers: tinted by the material color. */
export const TextureFactory = {
  /** Vertical board-on-board cladding: wide boards with narrow overlapping battens. */
  cladding(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const board = SIZE / 5; // 20 cm module
      for (let i = 0; i < 5; i += 1) {
        const x = i * board;
        const shade = 235 + Math.floor(rnd() * 20);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, 0, board * 0.72, SIZE);
        // batten
        ctx.fillStyle = "rgb(250,250,250)";
        ctx.fillRect(x + board * 0.72, 0, board * 0.28, SIZE);
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fillRect(x + board * 0.72 - 3, 0, 3, SIZE);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(x + board - 2, 0, 2, SIZE);
      }
      grain(ctx, rnd, true, 60, 0.05);
      noise(ctx, rnd, 6000, 0.05);
    }, 11);
  },
  oakFloor(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      const plank = SIZE / 5; // 20 cm planks
      for (let r = 0; r < 5; r += 1) {
        let x = -rnd() * SIZE;
        while (x < SIZE) {
          const len = SIZE * (0.8 + rnd() * 0.9);
          const t = 215 + Math.floor(rnd() * 35);
          ctx.fillStyle = `rgb(${t},${t - 8},${t - 22})`;
          ctx.fillRect(x, r * plank, len, plank);
          ctx.fillStyle = "rgba(70,45,20,0.35)";
          ctx.fillRect(x, r * plank, 2, plank);
          x += len;
        }
        ctx.fillStyle = "rgba(70,45,20,0.4)";
        ctx.fillRect(0, r * plank, SIZE, 2);
      }
      grain(ctx, rnd, false, 140, 0.07);
      noise(ctx, rnd, 5000, 0.04);
    }, 21);
  },
  woodGrain(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#f0e8de";
      ctx.fillRect(0, 0, SIZE, SIZE);
      grain(ctx, rnd, false, 120, 0.08);
      noise(ctx, rnd, 4000, 0.03);
    }, 31);
  },
  plaster(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#fbfaf8";
      ctx.fillRect(0, 0, SIZE, SIZE);
      noise(ctx, rnd, 14000, 0.035, 3);
    }, 41);
  },
  tiles(cols: number, rows: number, grout: string, base = 240): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = grout;
      ctx.fillRect(0, 0, SIZE, SIZE);
      const w = SIZE / cols;
      const h = SIZE / rows;
      for (let c = 0; c < cols; c += 1)
        for (let r = 0; r < rows; r += 1) {
          const t = base + Math.floor(rnd() * 12) - 6;
          ctx.fillStyle = `rgb(${t},${t},${t - 3})`;
          ctx.fillRect(c * w + 2, r * h + 2, w - 4, h - 4);
        }
      noise(ctx, rnd, 6000, 0.04);
    }, 51 + cols * 7 + rows);
  },
  deck(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      const board = SIZE / 7; // 14 cm boards
      for (let r = 0; r < 7; r += 1) {
        const t = 215 + Math.floor(rnd() * 35);
        ctx.fillStyle = `rgb(${t},${t - 10},${t - 25})`;
        ctx.fillRect(0, r * board, SIZE, board);
        ctx.fillStyle = "rgba(20,12,5,0.75)";
        ctx.fillRect(0, r * board + board - 5, SIZE, 5);
      }
      grain(ctx, rnd, false, 90, 0.08);
    }, 61);
  },
  /** Horizontal lap siding, 14 cm courses. Greyscale, tinted by the material color. */
  lapSiding(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const course = SIZE / 7;
      for (let i = 0; i < 7; i += 1) {
        const y = i * course;
        const shade = 228 + Math.floor(rnd() * 22);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(0, y, SIZE, course * 0.82);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(0, y, SIZE, 3);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(0, y + course * 0.82, SIZE, course * 0.18);
      }
      grain(ctx, rnd, false, 40, 0.04);
      noise(ctx, rnd, 4000, 0.04);
    }, 131);
  },
  /** Clay pantiles, about 32 cm exposure. Greyscale relief, tinted by the material color. */
  roofTiles(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#e6e6e6";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const course = SIZE / 3;
      const tile = SIZE / 4;
      for (let r = 0; r < 3; r += 1) {
        const y = r * course;
        const shift = r % 2 === 0 ? 0 : tile / 2;
        for (let c = -1; c < 5; c += 1) {
          const x = c * tile + shift;
          const shade = 210 + Math.floor(rnd() * 30);
          ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + course - 2);
          ctx.quadraticCurveTo(x + tile / 2, y + 6, x + tile - 4, y + course - 2);
          ctx.lineTo(x + tile - 8, y + 8);
          ctx.quadraticCurveTo(x + tile / 2, y + course * 0.35, x + 8, y + 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(x + 2, y + course - 6, tile - 4, 5);
        }
      }
      noise(ctx, rnd, 2500, 0.05);
    }, 141);
  },
  standingSeam(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 2; i += 1) {
        const y = i * (SIZE / 2);
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.fillRect(0, y, SIZE, 6);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, y + 6, SIZE, 4);
      }
      noise(ctx, rnd, 3000, 0.03);
    }, 71);
  },
  ceilingBoards(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      const board = SIZE / 8;
      for (let r = 0; r < 8; r += 1) {
        const t = 228 + Math.floor(rnd() * 22);
        ctx.fillStyle = `rgb(${t},${t - 6},${t - 18})`;
        ctx.fillRect(0, r * board, SIZE, board);
        ctx.fillStyle = "rgba(60,40,20,0.35)";
        ctx.fillRect(0, r * board, SIZE, 2);
      }
      grain(ctx, rnd, false, 100, 0.05);
    }, 81);
  },
  grass(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#6f8a52";
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 26000; i += 1) {
        const g = 110 + Math.floor(rnd() * 70);
        ctx.fillStyle = `rgba(${g - 40},${g},${g - 70},0.5)`;
        ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1.5, 4 + rnd() * 5);
      }
    }, 91);
  },
  gravel(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#b8b2a8";
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 9000; i += 1) {
        const g = 120 + Math.floor(rnd() * 110);
        ctx.fillStyle = `rgb(${g},${g - 4},${g - 10})`;
        ctx.beginPath();
        ctx.arc(rnd() * SIZE, rnd() * SIZE, 1 + rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 101);
  },
  fabric(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < SIZE; i += 3) {
        ctx.fillStyle = i % 6 === 0 ? "#000" : "#fff";
        ctx.fillRect(i, 0, 1, SIZE);
        ctx.fillRect(0, i, SIZE, 1);
      }
      ctx.globalAlpha = 1;
      noise(ctx, rnd, 8000, 0.05);
    }, 111);
  },
  concrete(): THREE.CanvasTexture {
    return make((ctx, rnd) => {
      ctx.fillStyle = "#e6e4e0";
      ctx.fillRect(0, 0, SIZE, SIZE);
      noise(ctx, rnd, 20000, 0.07, 2);
    }, 121);
  }
};
