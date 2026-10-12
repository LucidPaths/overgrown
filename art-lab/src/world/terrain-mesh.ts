// Chunk relief -> vertex arrays for the ground and the water surface. World units = world px; y is up; z = sim y.
import { B, Ground } from "./ground";
import { RC, type ChunkRelief } from "./relief";

export interface TerrainArrays {
  pos: Float32Array<ArrayBuffer>;
  nrm: Float32Array<ArrayBuffer>;
  tint: Uint8Array<ArrayBuffer>;
  weights: Uint8Array<ArrayBuffer>;
  index: Uint16Array<ArrayBuffer>;
}

export interface WaterArrays {
  pos: Float32Array<ArrayBuffer>;
  /** depth (surface - bed, px), river flow x, flow z, ocean(1)/river(0) */
  info: Float32Array<ArrayBuffer>;
  count: number;
}

const C = 33;

function srgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
function mix3(a: number[], b: number[], t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k, a[2]! + (b[2]! - a[2]!) * k];
}

// Grass is coloured by the continuous worldgen fields, never by the discrete biome id, so biome borders never seam.
const MEADOW = srgb(0x9bc35a);
const MEADOW_DRY = srgb(0xb9c463);
const LUSH = srgb(0x5fae5b);
const FOREST = srgb(0x3f8a58);
const ALPINE = srgb(0x8f9e66);
export function grassTint(g: Ground, x: number, y: number): [number, number, number] {
  const m = g.fields.moisture(x, y);
  const e = g.fields.elevation(x, y);
  let c = mix3(MEADOW_DRY, MEADOW, (m - 0.3) / 0.15);
  c = mix3(c, LUSH, (m - 0.45) / 0.07);
  c = mix3(c, FOREST, (m - 0.52) / 0.08);
  c = mix3(c, ALPINE, (e - 0.58) / 0.08);
  // gentle macro patches so the 300th field is not the first one
  const p = g.fields.detail(x * 0.25, y * 0.25) - 0.5;
  return mix3(c, p > 0 ? [c[0] * 1.08 + 6, c[1] * 1.06 + 4, c[2] * 0.95] : [c[0] * 0.9, c[1] * 0.95, c[2] * 1.02], Math.abs(p) * 1.4);
}

export function terrainArrays(g: Ground, r: ChunkRelief): TerrainArrays {
  const n = C * C;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  const tint = new Uint8Array(n * 4), weights = new Uint8Array(n * 4);
  const H = (i: number, j: number) => r.h[(j + 1) * RC + (i + 1)]!;
  const X0 = r.cx * 32, Y0 = r.cy * 32;
  for (let j = 0; j < C; j++) {
    for (let i = 0; i < C; i++) {
      const v = j * C + i;
      const h = H(i, j);
      pos[v * 3] = (X0 + i) * 16;
      pos[v * 3 + 1] = h;
      pos[v * 3 + 2] = (Y0 + j) * 16;
      const dx = (H(i + 1, j) - H(i - 1, j)) / 32;
      const dz = (H(i, j + 1) - H(i, j - 1)) / 32;
      const l = Math.hypot(dx, 1, dz);
      nrm[v * 3] = -dx / l;
      nrm[v * 3 + 1] = 1 / l;
      nrm[v * 3 + 2] = -dz / l;
      const c = grassTint(g, X0 + i, Y0 + j);
      tint[v * 4] = c[0]; tint[v * 4 + 1] = c[1]; tint[v * 4 + 2] = c[2];
      const ridx = ((j + 1) * RC + (i + 1)) * 4;
      for (let k = 0; k < 4; k++) weights[v * 4 + k] = r.w[ridx + k]!;
      tint[v * 4 + 3] = Math.max(0, Math.min(255, (g.fields.moisture(X0 + i, Y0 + j)) * 255));
    }
  }
  const index = new Uint16Array(32 * 32 * 6);
  let k = 0;
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 32; i++) {
      const a = j * C + i, b = a + 1, c = a + C, d = c + 1;
      // split along the diagonal with the smaller height change: cliffs stay crisp
      if (Math.abs(H(i, j) - H(i + 1, j + 1)) <= Math.abs(H(i + 1, j) - H(i, j + 1))) {
        index.set([a, c, d, a, d, b], k);
      } else {
        index.set([a, c, b, b, c, d], k);
      }
      k += 6;
    }
  }
  return { pos, nrm, tint, weights, index };
}

/** Water quads over every tile that is water or touches water, at the interpolated surface level. */
export function waterArrays(g: Ground, r: ChunkRelief): WaterArrays {
  const X0 = r.cx * 32, Y0 = r.cy * 32;
  const W = (i: number, j: number) => r.water[(j + 1) * RC + (i + 1)]!;
  const H = (i: number, j: number) => r.h[(j + 1) * RC + (i + 1)]!;
  const pos: number[] = [], info: number[] = [];
  const level = (i: number, j: number): number => {
    const w = W(i, j);
    if (!Number.isNaN(w)) return w;
    // a dry corner next to water: borrow a neighbour's level so the sheet runs under the bank
    let s = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const v = r.water[(j + 1 + dj) * RC + (i + 1 + di)];
      if (v !== undefined && !Number.isNaN(v)) { s += v; n++; }
    }
    return n > 0 ? s / n : NaN;
  };
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 32; i++) {
      const corners: [number, number][] = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]];
      const lv = corners.map(([a, b]) => level(a, b));
      if (lv.some((v) => Number.isNaN(v))) continue;
      const ocean = r.biome[(j + 2) * 36 + (i + 2)] === B.Ocean ? 1 : 0;
      // river flow: downhill along the elevation field
      const ex = g.fields.elevation(X0 + i + 1, Y0 + j) - g.fields.elevation(X0 + i - 1, Y0 + j);
      const ez = g.fields.elevation(X0 + i, Y0 + j + 1) - g.fields.elevation(X0 + i, Y0 + j - 1);
      const fl = Math.hypot(ex, ez) || 1;
      const push = (ci: number) => {
        const [a, b] = corners[ci]!;
        pos.push((X0 + a) * 16, lv[ci]!, (Y0 + b) * 16);
        info.push(lv[ci]! - H(a, b), -ex / fl, -ez / fl, ocean);
      };
      for (const ci of [0, 2, 3, 0, 3, 1]) push(ci);
    }
  }
  return { pos: new Float32Array(pos), info: new Float32Array(info), count: pos.length / 3 };
}
