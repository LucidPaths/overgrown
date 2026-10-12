// Time of day: one keyframed table for the light (sun/moon direction and colour, sky and bounce ambient, the hue
// shadows lean toward, grade). The whole world goes through the same light(), so dusk is one change here.
import { norm, type Vec3 } from "../gl/math";
import type { Lighting, Renderer } from "./renderer";

interface Key {
  h: number;
  /** sun azimuth/elevation (deg); at night this is the moon */
  az: number;
  el: number;
  sun: Vec3;
  sky: Vec3;
  bounce: Vec3;
  tint: Vec3;
  grade: Vec3;
  clear: Vec3;
  /** 0..1 how much lamps/emissives glow (read by lit props later) */
  night: number;
}

// Colours are chosen as pairs: warm light <-> cool shade by day, cold light <-> warm lamps by night.
const KEYS: Key[] = [
  { h: 0, az: 200, el: 55, sun: [0.32, 0.42, 0.7], sky: [0.2, 0.26, 0.48], bounce: [0.14, 0.14, 0.22], tint: [0.75, 0.8, 1.25], grade: [0.8, 1.04, 0.55], clear: [0.04, 0.07, 0.14], night: 1 },
  { h: 4.5, az: 230, el: 40, sun: [0.3, 0.38, 0.62], sky: [0.22, 0.26, 0.45], bounce: [0.16, 0.15, 0.22], tint: [0.78, 0.8, 1.2], grade: [0.82, 1.04, 0.5], clear: [0.05, 0.08, 0.15], night: 1 },
  { h: 6.2, az: 100, el: 14, sun: [1.0, 0.62, 0.42], sky: [0.5, 0.48, 0.7], bounce: [0.5, 0.36, 0.32], tint: [0.78, 0.74, 1.12], grade: [1.08, 1.05, 0.45], clear: [0.3, 0.25, 0.4], night: 0.3 },
  { h: 8.5, az: 120, el: 38, sun: [1.0, 0.88, 0.7], sky: [0.6, 0.68, 0.92], bounce: [0.55, 0.48, 0.42], tint: [0.8, 0.8, 1.06], grade: [1.12, 1.06, 0.35], clear: [0.12, 0.3, 0.55], night: 0 },
  { h: 12, az: 190, el: 58, sun: [1.0, 0.95, 0.84], sky: [0.62, 0.72, 0.95], bounce: [0.55, 0.5, 0.45], tint: [0.82, 0.8, 1.05], grade: [1.1, 1.06, 0.3], clear: [0.12, 0.3, 0.55], night: 0 },
  { h: 16, az: 215, el: 38, sun: [1.0, 0.9, 0.72], sky: [0.62, 0.7, 0.92], bounce: [0.58, 0.5, 0.42], tint: [0.8, 0.78, 1.06], grade: [1.12, 1.06, 0.35], clear: [0.12, 0.3, 0.55], night: 0 },
  { h: 18.6, az: 250, el: 13, sun: [1.0, 0.55, 0.32], sky: [0.5, 0.42, 0.62], bounce: [0.55, 0.34, 0.3], tint: [0.72, 0.66, 1.15], grade: [1.12, 1.07, 0.5], clear: [0.32, 0.2, 0.32], night: 0.4 },
  { h: 20.2, az: 180, el: 45, sun: [0.36, 0.42, 0.72], sky: [0.26, 0.28, 0.5], bounce: [0.2, 0.16, 0.24], tint: [0.74, 0.76, 1.25], grade: [0.86, 1.05, 0.55], clear: [0.06, 0.08, 0.16], night: 1 },
  { h: 24, az: 200, el: 55, sun: [0.32, 0.42, 0.7], sky: [0.2, 0.26, 0.48], bounce: [0.14, 0.14, 0.22], tint: [0.75, 0.8, 1.25], grade: [0.8, 1.04, 0.55], clear: [0.04, 0.07, 0.14], night: 1 },
];

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function lightingAt(hour: number): Lighting & { night: number } {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= h) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const t0 = (h - a.h) / (b.h - a.h);
  const t = t0 * t0 * (3 - 2 * t0);
  const az = ((a.az + (b.az - a.az) * t) * Math.PI) / 180;
  const el = ((a.el + (b.el - a.el) * t) * Math.PI) / 180;
  // azimuth 180 = sun in the south (toward the camera, +z): faces toward the viewer are lit, as in classic 3/4 art
  const sunDir = norm([Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]);
  return {
    sunDir,
    sunCol: lerp3(a.sun, b.sun, t),
    skyCol: lerp3(a.sky, b.sky, t),
    bounceCol: lerp3(a.bounce, b.bounce, t),
    shadeTint: lerp3(a.tint, b.tint, t),
    cloudAmt: 0.55,
    grade: lerp3(a.grade, b.grade, t),
    clear: lerp3(a.clear, b.clear, t),
    night: a.night + (b.night - a.night) * t,
  };
}

export function applyTime(r: Renderer, hour: number): void {
  r.lighting = lightingAt(hour);
}
