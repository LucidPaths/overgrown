// Chunk generator: world seed + chunk coordinates -> tile layer. Pure and bit-exact (CLAUDE.md "Worldgen noise").
// Noise is always sampled at world tile coordinates, so chunk borders are seamless by construction.
import { CHUNK_TILES } from "../constants";
import { deriveSeed, hashString } from "../rng";
import { createFbm, type Field2 } from "./noise";
import { Tile, type TileValue } from "./tile";

export interface ChunkData {
  cx: number;
  cy: number;
  /** CHUNK_TILES * CHUNK_TILES Tile values, local index ly * CHUNK_TILES + lx. */
  tiles: Uint8Array<ArrayBuffer>;
}

/** Elevation octaves in tiles (tunable). Exported for the seam test's slope bound. */
export const ELEVATION_WAVELENGTHS = [128, 64, 32, 16] as const;

const ELEVATION_SALT = hashString("elevation");

/** The elevation field for a world seed: createFbm(deriveSeed(seed, hashString("elevation")), ELEVATION_WAVELENGTHS). */
export function createElevation(seed: number): Field2 {
  return createFbm(deriveSeed(seed, ELEVATION_SALT), ELEVATION_WAVELENGTHS);
}

/** Upper-exclusive elevation bands, checked in order; anything above the last is Stone (tunable). */
const ELEVATION_BANDS: readonly (readonly [number, TileValue])[] = [
  [0.25, Tile.VeryDeepWater],
  [0.32, Tile.DeepWater],
  [0.38, Tile.ShallowWater],
  [0.42, Tile.Sand],
  [0.68, Tile.Grass],
];

/** PLACEHOLDER classification (WLD-002 replaces it with the biome map). Bands are upper-exclusive, checked in order. */
export function classifyElevation(e: number): TileValue {
  for (const [upper, tile] of ELEVATION_BANDS) {
    if (e < upper) return tile;
  }
  return Tile.Stone;
}

const U32_MAX = 0xffffffff;
// World tile coords cx * CHUNK_TILES + l must fit in int32, the noise domain.
const CHUNK_MIN = -0x80000000 / CHUNK_TILES;
const CHUNK_MAX = 0x80000000 / CHUNK_TILES - 1;

function assertChunkCoord(name: string, value: number): void {
  if (!Number.isInteger(value) || value < CHUNK_MIN || value > CHUNK_MAX) {
    throw new RangeError(`${name} must be an integer in ${CHUNK_MIN}..${CHUNK_MAX}, got ${value}`);
  }
}

export function generateChunk(seed: number, cx: number, cy: number): ChunkData {
  if (!Number.isInteger(seed) || seed < 0 || seed > U32_MAX) {
    throw new RangeError(`seed must be an integer in 0..4294967295, got ${seed}`);
  }
  assertChunkCoord("cx", cx);
  assertChunkCoord("cy", cy);
  const elev = createElevation(seed);
  const tiles = new Uint8Array(CHUNK_TILES * CHUNK_TILES);
  const tx0 = cx * CHUNK_TILES;
  const ty0 = cy * CHUNK_TILES;
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      tiles[ly * CHUNK_TILES + lx] = classifyElevation(elev(tx0 + lx, ty0 + ly));
    }
  }
  return { cx, cy, tiles };
}
