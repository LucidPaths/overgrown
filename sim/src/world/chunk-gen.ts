// Chunk generator: world seed + chunk coordinates -> tile and biome layers. Pure and bit-exact (CLAUDE.md "Worldgen noise").
// Every field is sampled at world tile coordinates, so chunk borders are seamless by construction.
import { CHUNK_TILES } from "../constants";
import { deriveSeed } from "../rng";
import { Biome, type BiomeValue } from "./biome";
import { classifyBiome, createWorldFields, sampleBiome, type BiomeSample, type WorldFields } from "./biome-map";
import { Tile, type TileValue } from "./tile";

export interface ChunkData {
  cx: number;
  cy: number;
  /** CHUNK_TILES * CHUNK_TILES Tile values, local index ly * CHUNK_TILES + lx. */
  tiles: Uint8Array<ArrayBuffer>;
  /** CHUNK_TILES * CHUNK_TILES Biome values, same indexing. */
  biomes: Uint8Array<ArrayBuffer>;
}

// Ocean depth bands; Sand from SHALLOW_BELOW up to the coast (tunable).
const VERY_DEEP_BELOW = 0.27;
const DEEP_BELOW = 0.32;
const SHALLOW_BELOW = 0.355;
// River depth: deep only in wide stretches, and only this far in from each bank (tunable).
const RIVER_DEEP_MIN_HALF_WIDTH = 4;
const RIVER_SHALLOW_RIM = 2;
// One FORD_WIDTH-tile ford stripe per FORD_CELL-tile cell, per axis (tunable).
const FORD_CELL = 64;
const FORD_WIDTH = 3;
// Cliffs: steep slope crossing one of CLIFF_TERRACES elevation terraces, gapped where detail is low (tunable).
const CLIFF_TERRACES = 25;
const CLIFF_SLOPE = 0.002;
const CLIFF_GAP_BELOW = 0.35;
const GRASSLAND_DIRT_FROM = 0.68;
const FOREST_DIRT_FROM = 0.5;

function inFordStripe(fordSeed: number, t: number): boolean {
  const cell = Math.floor(t / FORD_CELL);
  const offset = Math.floor((deriveSeed(fordSeed, cell) / 4294967296) * (FORD_CELL - FORD_WIDTH + 1));
  const local = t - cell * FORD_CELL;
  return local >= offset && local < offset + FORD_WIDTH;
}

/** True on a seeded ford stripe: one FORD_WIDTH-tile stripe per FORD_CELL-tile cell, per axis. */
export function isFord(f: WorldFields, tx: number, ty: number): boolean {
  return inFordStripe(f.fordSeedX, tx) || inFordStripe(f.fordSeedY, ty);
}

/** The ground tile for a biome sample at world tile (tx, ty). */
export function pickTile(f: WorldFields, s: BiomeSample, biome: BiomeValue, tx: number, ty: number): TileValue {
  const e = s.elevation;
  switch (biome) {
    case Biome.Ocean:
      if (e < VERY_DEEP_BELOW) return Tile.VeryDeepWater;
      if (e < DEEP_BELOW) return Tile.DeepWater;
      if (e < SHALLOW_BELOW) return Tile.ShallowWater;
      return Tile.Sand;
    case Biome.Mountain: {
      const eR = f.elevation(tx + 1, ty);
      const eD = f.elevation(tx, ty + 1);
      const slope = Math.max(Math.abs(eR - e), Math.abs(eD - e));
      const k = Math.floor(e * CLIFF_TERRACES);
      const crosses = Math.floor(eR * CLIFF_TERRACES) !== k || Math.floor(eD * CLIFF_TERRACES) !== k;
      return slope >= CLIFF_SLOPE && crosses && f.detail(tx, ty) >= CLIFF_GAP_BELOW ? Tile.Cliff : Tile.Stone;
    }
    case Biome.River:
      if (s.riverDist >= s.riverHalfWidth) return Tile.Sand;
      if (
        s.riverHalfWidth >= RIVER_DEEP_MIN_HALF_WIDTH &&
        s.riverDist < s.riverHalfWidth - RIVER_SHALLOW_RIM &&
        !isFord(f, tx, ty)
      ) {
        return Tile.DeepWater;
      }
      return Tile.ShallowWater;
    case Biome.Forest:
      return f.detail(tx, ty) >= FOREST_DIRT_FROM ? Tile.Dirt : Tile.Grass;
    case Biome.Grassland:
      return f.detail(tx, ty) >= GRASSLAND_DIRT_FROM ? Tile.Dirt : Tile.Grass;
  }
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
  const f = createWorldFields(seed);
  const tiles = new Uint8Array(CHUNK_TILES * CHUNK_TILES);
  const biomes = new Uint8Array(CHUNK_TILES * CHUNK_TILES);
  const tx0 = cx * CHUNK_TILES;
  const ty0 = cy * CHUNK_TILES;
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = tx0 + lx;
      const ty = ty0 + ly;
      const i = ly * CHUNK_TILES + lx;
      const s = sampleBiome(f, tx, ty);
      const b = classifyBiome(s);
      biomes[i] = b;
      tiles[i] = pickTile(f, s, b, tx, ty);
    }
  }
  return { cx, cy, tiles, biomes };
}
