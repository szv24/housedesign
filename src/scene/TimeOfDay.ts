import * as THREE from "three";

export type TimePreset = "morning" | "daytime" | "evening";

export const PRESET_HOURS: Record<TimePreset, number> = {
  morning: 7.6,
  daytime: 14.0,
  evening: 19.45
};

export interface SunPosition {
  elevationDeg: number;
  /** Degrees clockwise from north. */
  azimuthDeg: number;
}

/** Approximate solar position for local solar time. */
export function solarPosition(latitudeDeg: number, dayOfYear: number, hour: number): SunPosition {
  const rad = Math.PI / 180;
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365) * rad;
  const lat = latitudeDeg * rad;
  const h = (hour - 12) * 15 * rad;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(h);
  const el = Math.asin(THREE.MathUtils.clamp(sinEl, -1, 1));
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat));
  let az = Math.acos(THREE.MathUtils.clamp(cosAz, -1, 1)) / rad;
  if (h > 0) az = 360 - az;
  return { elevationDeg: el / rad, azimuthDeg: az };
}

/** Unit vector toward the sun in 3D (north = -Z, east = +X), rotated by the site's north angle. */
export function sunDirection(p: SunPosition, northAngleDeg = 0): THREE.Vector3 {
  const rad = Math.PI / 180;
  const az = (p.azimuthDeg + northAngleDeg) * rad;
  const el = p.elevationDeg * rad;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}

interface SkyKey {
  el: number;
  zenith: string;
  horizon: string;
  ground: string;
  sun: string;
  sunIntensity: number;
  hemi: number;
  env: number;
  exposure: number;
}

/** Keyframes by sun elevation (degrees). Values are tuned for ACES tone mapping. */
const KEYS: SkyKey[] = [
  { el: -12, zenith: "#070b16", horizon: "#1a2338", ground: "#11141a", sun: "#8aa0d0", sunIntensity: 0, hemi: 0.28, env: 0.12, exposure: 1.1 },
  { el: -4, zenith: "#1d2c52", horizon: "#7c6f8a", ground: "#23262c", sun: "#ff9a5c", sunIntensity: 0, hemi: 0.45, env: 0.2, exposure: 1.05 },
  { el: 1, zenith: "#3c5a8c", horizon: "#f0a57a", ground: "#3a3a34", sun: "#ff9150", sunIntensity: 1.2, hemi: 0.55, env: 0.3, exposure: 1.05 },
  { el: 8, zenith: "#4f78b3", horizon: "#f3cba0", ground: "#4b4a40", sun: "#ffc184", sunIntensity: 2.6, hemi: 0.85, env: 0.45, exposure: 0.95 },
  { el: 22, zenith: "#5d8fd0", horizon: "#d9e6ef", ground: "#5a5a4c", sun: "#ffe7c8", sunIntensity: 3.2, hemi: 1.05, env: 0.55, exposure: 0.92 },
  { el: 60, zenith: "#4f86cc", horizon: "#dfeaf2", ground: "#5e5e50", sun: "#fff4e6", sunIntensity: 3.6, hemi: 1.15, env: 0.6, exposure: 0.9 }
];

export interface SkyState {
  sun: SunPosition;
  direction: THREE.Vector3;
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiIntensity: number;
  envIntensity: number;
  exposure: number;
  /** 0..1 level of interior artificial lights. */
  interiorLevel: number;
  /** 0..1 level of exterior lights (only around and after sunset). */
  exteriorLevel: number;
}

export function skyState(latitude: number, dayOfYear: number, hour: number, northAngleDeg = 0): SkyState {
  const sun = solarPosition(latitude, dayOfYear, hour);
  const el = sun.elevationDeg;
  let i = 0;
  while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((el - a.el) / (b.el - a.el), 0, 1);
  const lerpC = (x: string, y: string) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    sun,
    direction: sunDirection(sun, northAngleDeg),
    zenith: lerpC(a.zenith, b.zenith),
    horizon: lerpC(a.horizon, b.horizon),
    ground: lerpC(a.ground, b.ground),
    sunColor: lerpC(a.sun, b.sun),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity),
    hemiIntensity: lerp(a.hemi, b.hemi),
    envIntensity: lerp(a.env, b.env),
    exposure: lerp(a.exposure, b.exposure),
    interiorLevel: 0.25 + 0.75 * (1 - THREE.MathUtils.smoothstep(el, -2, 16)),
    exteriorLevel: 1 - THREE.MathUtils.smoothstep(el, -3, 5)
  };
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m === 60 ? 0 : m).padStart(2, "0")}`;
}
