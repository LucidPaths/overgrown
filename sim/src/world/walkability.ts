// The one walkability rule set: which tiles a foot box can enter, how fast it moves over them, and how deep the water is.
// Contract: CLAUDE.md "Tile walkability, speed factor and water depth".
import { Tile, type TileValue } from "./tile";

/** (tx, ty) → tile. ChunkStore.tileAt satisfies it. */
export type TileLookup = (tx: number, ty: number) => TileValue;

export interface TileRule {
  /** Can a foot box enter this tile? */
  readonly walkable: boolean;
  /** Multiplies displacement while the box centre is over this tile. 1 on blocked tiles: a box placed overlapping one must walk out at normal pace. */
  readonly speed: number;
  /** Water depth layer: dry 0, shallow 1, deep 2, very deep 3. Derived from the tile; there is no second array (M1 contracts). */
  readonly depth: 0 | 1 | 2 | 3;
}

export const SHALLOW_WATER_SPEED = 0.6; // OQ-019, tunable

/** The one walkability rule set (OQ-018, OQ-019). tsc enforces an entry per Tile. */
export const TILE_RULES: Readonly<Record<TileValue, TileRule>> = {
  [Tile.Grass]: { walkable: true, speed: 1, depth: 0 },
  [Tile.Dirt]: { walkable: true, speed: 1, depth: 0 },
  [Tile.Sand]: { walkable: true, speed: 1, depth: 0 },
  [Tile.Stone]: { walkable: true, speed: 1, depth: 0 },
  [Tile.Cliff]: { walkable: false, speed: 1, depth: 0 },
  [Tile.ShallowWater]: { walkable: true, speed: SHALLOW_WATER_SPEED, depth: 1 },
  [Tile.DeepWater]: { walkable: false, speed: 1, depth: 2 },
  [Tile.VeryDeepWater]: { walkable: false, speed: 1, depth: 3 },
};
