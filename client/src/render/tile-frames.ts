// Ground tile lookup for the dual grid. Contract: contracts/tile-frames.json, drawn by tools/art/gen/tiles.py.
// A render cell (rx, ry) has its corners on the centres of four world tiles: TL=(rx,ry), TR=(rx+1,ry),
// BL=(rx,ry+1), BR=(rx+1,ry+1). It is drawn 16x16 with its top-left pixel at world px (rx*16+8, ry*16+8),
// using the palette of the TL tile's biome. Mask bits: TL=1 TR=2 BL=4 BR=8.
import { Biome, type BiomeValue } from "@overgrown/sim/world/biome";
import { Tile, type TileValue } from "@overgrown/sim/world/tile";

/** Frame-name terrain key per Tile. Adding a Tile without a key fails typecheck. */
export const TERRAIN_KEYS: Record<TileValue, string> = {
  [Tile.Grass]: "grass",
  [Tile.Dirt]: "dirt",
  [Tile.Sand]: "sand",
  [Tile.Stone]: "stone",
  [Tile.Cliff]: "cliff",
  [Tile.ShallowWater]: "shallow_water",
  [Tile.DeepWater]: "deep_water",
  [Tile.VeryDeepWater]: "very_deep_water",
};

/** Draw order: 0 = lowest (very_deep_water) ... 7 = highest (cliff). Higher terrains draw over lower ones. */
export const TERRAIN_RANK: Record<TileValue, number> = {
  [Tile.VeryDeepWater]: 0,
  [Tile.DeepWater]: 1,
  [Tile.ShallowWater]: 2,
  [Tile.Sand]: 3,
  [Tile.Dirt]: 4,
  [Tile.Grass]: 5,
  [Tile.Stone]: 6,
  [Tile.Cliff]: 7,
};

/** Palette (frame-name key) per Biome. */
export const BIOME_PALETTES: Record<BiomeValue, string> = {
  [Biome.Grassland]: "meadow",
  [Biome.Forest]: "forest",
  [Biome.River]: "river",
  [Biome.Mountain]: "mountain",
  [Biome.Ocean]: "ocean",
};

export const FULL_MASK = 15;
export const FULL_VARIANTS = 3;
export const EDGE_VARIANTS = 2;

/** The only place the frame-name format is spelled out in TS. */
export function tileFrameName(biome: BiomeValue, terrain: TileValue, mask: number, variant: number): string {
  return `tile/${BIOME_PALETTES[biome]}/${TERRAIN_KEYS[terrain]}/${mask}/${variant}`;
}

/** Stable per-cell hash, so a re-baked chunk picks the same variants. */
function cellHash(rx: number, ry: number, t: number): number {
  let h = Math.imul(rx, 0x9e3779b1) ^ Math.imul(ry, 0x85ebca77) ^ Math.imul(t + 1, 0xc2b2ae3d);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

function requireTile(name: string, value: number): void {
  if (!Object.hasOwn(TERRAIN_KEYS, value)) throw new RangeError(`${name} must be a Tile value, got ${value}`);
}

/**
 * Frames to draw, bottom first, for render cell (rx, ry). Its corners are tiles tl=(rx,ry), tr=(rx+1,ry), bl=(rx,ry+1),
 * br=(rx+1,ry+1); it is drawn at world px (rx*16+8, ry*16+8); its palette is the biome of the TL tile.
 * Returns 1-4 names; the first always has mask 15.
 */
export function tileFrames(
  tl: TileValue,
  tr: TileValue,
  bl: TileValue,
  br: TileValue,
  biome: BiomeValue,
  rx: number,
  ry: number,
): string[] {
  requireTile("tl", tl);
  requireTile("tr", tr);
  requireTile("bl", bl);
  requireTile("br", br);
  if (!Object.hasOwn(BIOME_PALETTES, biome)) throw new RangeError(`biome must be a Biome value, got ${biome}`);
  if (!Number.isInteger(rx)) throw new RangeError(`rx must be an integer, got ${rx}`);
  if (!Number.isInteger(ry)) throw new RangeError(`ry must be an integer, got ${ry}`);

  const corners = [tl, tr, bl, br]; // index i <-> bit 1 << i
  const layers = [...new Set(corners)].sort((a, b) => TERRAIN_RANK[a] - TERRAIN_RANK[b]);
  return layers.map((terrain) => {
    let mask = 0;
    for (let i = 0; i < 4; i++) {
      if (TERRAIN_RANK[corners[i]!] >= TERRAIN_RANK[terrain]) mask |= 1 << i;
    }
    const variants = mask === FULL_MASK ? FULL_VARIANTS : EDGE_VARIANTS;
    return tileFrameName(biome, terrain, mask, cellHash(rx, ry, terrain) % variants);
  });
}
