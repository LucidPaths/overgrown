// The spawn point search. Contract: CLAUDE.md "Spawn point".
import { TILE_PX } from "../constants";
import { Biome, type BiomeValue } from "./biome";
import type { TileValue } from "./tile";
import { TILE_RULES } from "./walkability";

export const SPAWN_SEARCH_RADIUS = 256; // tiles, Chebyshev, around tile (0, 0); tunable. Max seen over seeds 0–199: 163.

export interface SpawnGround {
  tileAt(tx: number, ty: number): TileValue;
  biomeAt(tx: number, ty: number): BiomeValue;
}

/**
 * OQ-024: the feet point (tx·TILE_PX + 8, ty·TILE_PX + 8) at the centre of the nearest tile whose biome is Grassland
 * and whose tile is walkable. "Nearest": the smallest Chebyshev ring r = max(|tx|, |ty|) = 0, 1, … SPAWN_SEARCH_RADIUS
 * that contains any such tile; within that ring, the smallest (tx² + ty², ty, tx). The result doesn't depend on loop order.
 * Throws if no ring up to the radius has one. Never falls back to (0, 0).
 */
export function findSpawn(ground: SpawnGround): { x: number; y: number } {
  for (let r = 0; r <= SPAWN_SEARCH_RADIUS; r++) {
    let bestTx = 0;
    let bestTy = 0;
    let bestD2 = Infinity;
    // Ring r: the tiles with max(|tx|, |ty|) = r, scanned top row, bottom row, then the two side columns.
    const consider = (tx: number, ty: number): void => {
      if (ground.biomeAt(tx, ty) !== Biome.Grassland || !TILE_RULES[ground.tileAt(tx, ty)].walkable) return;
      const d2 = tx * tx + ty * ty;
      if (d2 < bestD2 || (d2 === bestD2 && (ty < bestTy || (ty === bestTy && tx < bestTx)))) {
        bestD2 = d2;
        bestTx = tx;
        bestTy = ty;
      }
    };
    for (let tx = -r; tx <= r; tx++) {
      consider(tx, -r);
      if (r > 0) consider(tx, r);
    }
    for (let ty = -r + 1; ty <= r - 1; ty++) {
      consider(-r, ty);
      consider(r, ty);
    }
    if (bestD2 !== Infinity) return { x: bestTx * TILE_PX + TILE_PX / 2, y: bestTy * TILE_PX + TILE_PX / 2 };
  }
  throw new Error(
    `findSpawn: no walkable Grassland tile within ${SPAWN_SEARCH_RADIUS} tiles (Chebyshev) of tile (0, 0)`,
  );
}
