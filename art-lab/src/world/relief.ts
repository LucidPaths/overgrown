// Presentation relief: turns the sim's flat tile grid into heights, water levels and surface weights.
// Pure function of the seed (no clock, no Math.random): the same world always looks the same.
// The sim never sees any of this. Rules:
//  - walkable tiles are flat at their own height (+ a little noise), so feet never float;
//  - Cliff tiles carry the whole step between terraces (their corners take the walkable neighbours' heights);
//  - water surfaces are continuous (sea level 0; rivers sit a few px under the land around them).
import { sampleBiome } from "../../../sim/src/world/biome-map";
import { B, Ground, T, hash01 } from "./ground";

export const LAND_K = 110; // px of rise per unit of elevation above the coast
export const TERRACE = 25; // must match chunk-gen CLIFF_TERRACES
export const STEP = 10; // px per mountain terrace (gentle: the walls are drawn by the cliff tiles, not by the relief)
export const MOUNTAIN_K = 900; // smooth rise per unit elevation inside mountains
const MOUNTAIN_FROM = 0.62;
const COAST = 0.38;

export interface TileInfo {
  /** Ground surface height at the tile (px, up). For water tiles: the bed. */
  h: number;
  /** Water surface height, or NaN on dry tiles. */
  water: number;
  walk: boolean;
}

export function landBase(e: number): number {
  return Math.max(0, e - COAST) * LAND_K;
}

/** Heights for one tile. Cheap enough to call per corner neighbour; callers cache per chunk. */
export function tileInfo(g: Ground, tx: number, ty: number): TileInfo {
  const t = g.tile(tx, ty);
  const b = g.biome(tx, ty);
  const f = g.fields;
  const e = f.elevation(tx, ty);
  const jitter = (hash01(g.seed, tx, ty, 77) - 0.5) * 0.8;
  if (b === B.Ocean) {
    if (t === T.Sand) return { h: Math.max(0.6, ((e - 0.355) / 0.025) * 3.5) + jitter * 0.3, water: NaN, walk: true };
    const bed = e >= 0.32 ? -2 - ((0.355 - e) / 0.035) * 5 : e >= 0.27 ? -7 - ((0.32 - e) / 0.05) * 12 : -19 - ((0.27 - e) / 0.27) * 60;
    return { h: bed, water: 0, walk: t === T.Shallow };
  }
  const land = 3 + landBase(e);
  if (b === B.Mountain) {
    const level = Math.max(0, Math.floor(e * TERRACE) - Math.floor(MOUNTAIN_FROM * TERRACE));
    return { h: land + level * STEP + (e - MOUNTAIN_FROM) * MOUNTAIN_K + jitter * 0.6, water: NaN, walk: t !== T.Cliff };
  }
  if (b === B.River) {
    const level = Math.max(0.4, land - 3.5);
    if (t === T.Sand) {
      const s = sampleBiome(f, tx, ty);
      const k = Math.min(1, Math.max(0, (s.riverDist - s.riverHalfWidth) / 1.5));
      return { h: level + 0.8 + k * 2.4 + jitter * 0.3, water: NaN, walk: true };
    }
    return { h: t === T.Deep ? level - 11 : level - 4, water: level, walk: t === T.Shallow };
  }
  return { h: land + jitter, water: NaN, walk: true };
}

/** Per-chunk relief over a ring of corners: corner (i, j) for i, j in -1..33 is stored at (j+1)*RC+(i+1).
 * Corner (i, j) is the top-left corner of world tile (cx*32+i, cy*32+j). */
export const RC = 35;
export interface ChunkRelief {
  cx: number;
  cy: number;
  h: Float32Array;
  /** Water surface at the corner, NaN where no water tile touches it. */
  water: Float32Array;
  /** sand, dirt, rock, forest weights per corner (0..255) */
  w: Uint8Array;
  /** tiles and biomes with a 2-tile apron: local tile (lx, ly) at (ly+2)*36+(lx+2) */
  tile: Uint8Array;
  biome: Uint8Array;
}
export const RA = 36;

export function chunkRelief(g: Ground, cx: number, cy: number): ChunkRelief {
  const N = 32, A = RA;
  const tx0 = cx * N - 2, ty0 = cy * N - 2;
  const infos: TileInfo[] = new Array(A * A);
  const tile = new Uint8Array(A * A), biome = new Uint8Array(A * A);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < A; x++) {
      infos[y * A + x] = tileInfo(g, tx0 + x, ty0 + y);
      tile[y * A + x] = g.tile(tx0 + x, ty0 + y);
      biome[y * A + x] = g.biome(tx0 + x, ty0 + y);
    }
  }
  const h = new Float32Array(RC * RC), water = new Float32Array(RC * RC), w = new Uint8Array(RC * RC * 4);
  for (let j = -1; j <= N + 1; j++) {
    for (let i = -1; i <= N + 1; i++) {
      let sw = 0, sumW = 0, sAll = 0, wl = 0, wn = 0;
      let sand = 0, dirt = 0, rock = 0, forest = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const k = (j + 1 + dy) * A + (i + 1 + dx);
          const inf = infos[k]!;
          sAll += inf.h;
          if (inf.walk || !Number.isNaN(inf.water)) { sw += inf.h; sumW += 1; }
          if (!Number.isNaN(inf.water)) { wl += inf.water; wn += 1; }
          const t = tile[k]!;
          if (t === T.Sand || t >= T.Shallow) sand += 1;
          if (t === T.Dirt) dirt += 1;
          if (t === T.Stone || t === T.Cliff) rock += 1;
          if (biome[k] === B.Forest) forest += 1;
        }
      }
      const idx = (j + 1) * RC + (i + 1);
      h[idx] = sumW > 0 ? sw / sumW : sAll / 4;
      water[idx] = wn > 0 ? wl / wn : NaN;
      w[idx * 4] = sand * 63.75;
      w[idx * 4 + 1] = dirt * 63.75;
      w[idx * 4 + 2] = rock * 63.75;
      w[idx * 4 + 3] = forest * 63.75;
    }
  }
  return { cx, cy, h, water, w, tile, biome };
}
