// Biome map: seeded fields sampled at world tile coordinates -> biome per tile (CLAUDE.md "Biome map").
// Pure and bit-exact: only integer hashing and + - * / floor abs min max, so chunk borders are seamless by construction.
import { deriveSeed, hashString } from "../rng";
import { createFbm, type Field2 } from "./noise";
import { Biome, type BiomeValue } from "./biome";

/** Field octaves in tiles (all tunable). The 256-tile base gives land regions ~7-9 chunks across (OQ-024). */
export const ELEVATION_WAVELENGTHS = [256, 128, 64, 32] as const;
export const MOISTURE_WAVELENGTHS = [256, 128, 64] as const;
export const TEMPERATURE_WAVELENGTHS = [512, 256] as const;
export const RIVER_WAVELENGTHS = [256, 128, 64] as const;
export const RIVER_WIDTH_WAVELENGTHS = [512] as const;
export const DETAIL_WAVELENGTHS = [16, 8] as const;

const OCEAN_BELOW = 0.38;
const MOUNTAIN_FROM = 0.62;
const FOREST_FROM = 0.52;
const RIVER_NEAR = 0.08;
const RIVER_HALF_WIDTH_MIN = 1;
const RIVER_HALF_WIDTH_MAX = 6;
const RIVER_BANK = 1.5;

/** Every seeded input of worldgen for one world seed. Build once per generateChunk call. */
export interface WorldFields {
  elevation: Field2;
  moisture: Field2;
  temperature: Field2;
  river: Field2;
  riverWidth: Field2;
  detail: Field2;
  fordSeedX: number;
  fordSeedY: number;
}

function field(seed: number, name: string, wavelengths: readonly number[]): Field2 {
  return createFbm(deriveSeed(seed, hashString(name)), wavelengths);
}

export function createWorldFields(seed: number): WorldFields {
  return {
    elevation: field(seed, "elevation", ELEVATION_WAVELENGTHS),
    moisture: field(seed, "moisture", MOISTURE_WAVELENGTHS),
    temperature: field(seed, "temperature", TEMPERATURE_WAVELENGTHS),
    river: field(seed, "river", RIVER_WAVELENGTHS),
    riverWidth: field(seed, "river-width", RIVER_WIDTH_WAVELENGTHS),
    detail: field(seed, "detail", DETAIL_WAVELENGTHS),
    fordSeedX: deriveSeed(seed, hashString("ford-x")),
    fordSeedY: deriveSeed(seed, hashString("ford-y")),
  };
}

/** One biome sample at a world tile. Pure; temperature is reserved (computed, not yet used). */
export interface BiomeSample {
  /** [0, 1) */
  elevation: number;
  /** [0, 1) */
  moisture: number;
  /** [0, 1), reserved */
  temperature: number;
  /** Approx. tiles from the river band centre; Infinity when not near a river. */
  riverDist: number;
  /** River water half-width in tiles at this point; 0 when not near a river. */
  riverHalfWidth: number;
}

export function sampleBiome(f: WorldFields, tx: number, ty: number): BiomeSample {
  // Domain: neighbour samples reach one tile past chunk coordinates (x = -2^31 - 1 or 2^31 at the extreme chunks),
  // one outside createFbm's documented domain; harmless because every wavelength is >= 8, so lattice indices stay in int32.
  const elevation = f.elevation(tx, ty);
  const moisture = f.moisture(tx, ty);
  const temperature = f.temperature(tx, ty);
  let riverDist = Infinity;
  let riverHalfWidth = 0;
  const ridge = Math.abs(f.river(tx, ty) * 2 - 1); // 0 on the band centre line
  if (ridge < RIVER_NEAR) {
    // Per-tile slope of 2n-1 (max-norm, no sqrt); skipped far from rivers.
    const slope = Math.max(
      Math.abs(f.river(tx + 1, ty) - f.river(tx - 1, ty)),
      Math.abs(f.river(tx, ty + 1) - f.river(tx, ty - 1)),
    );
    if (slope > 0) riverDist = ridge / slope;
    riverHalfWidth = RIVER_HALF_WIDTH_MIN + (RIVER_HALF_WIDTH_MAX - RIVER_HALF_WIDTH_MIN) * f.riverWidth(tx, ty);
  }
  return { elevation, moisture, temperature, riverDist, riverHalfWidth };
}

/** Checked in order: rivers end at coasts and mountain feet. */
export function classifyBiome(s: BiomeSample): BiomeValue {
  if (s.elevation < OCEAN_BELOW) return Biome.Ocean;
  if (s.elevation >= MOUNTAIN_FROM) return Biome.Mountain;
  if (s.riverDist < s.riverHalfWidth + RIVER_BANK) return Biome.River;
  if (s.moisture >= FOREST_FROM) return Biome.Forest;
  return Biome.Grassland;
}
