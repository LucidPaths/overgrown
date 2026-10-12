// Test helper: small hand-drawn tile grounds for collision, movement and spawn tests.
import { Tile, type TileValue } from "./tile";
import type { TileLookup } from "./walkability";

const LEGEND: Readonly<Record<string, TileValue>> = {
  ".": Tile.Grass,
  "#": Tile.Cliff,
  "~": Tile.ShallowWater,
  D: Tile.DeepWater,
  V: Tile.VeryDeepWater,
};

/** Grass everywhere. */
export const openGround: TileLookup = () => Tile.Grass;

/**
 * Legend: `.` Grass, `#` Cliff, `~` ShallowWater, `D` DeepWater, `V` VeryDeepWater.
 * Row k is tile row ty0 + k, column j is tile column tx0 + j. Every tile outside the rows is Grass.
 */
export function groundFromRows(rows: readonly string[], tx0: number, ty0: number): TileLookup {
  const grid = rows.map((row, k) =>
    Array.from(row, (ch, j) => {
      const tile = LEGEND[ch];
      if (tile === undefined) throw new RangeError(`groundFromRows: unknown legend character "${ch}" at row ${k}, column ${j}`);
      return tile;
    }),
  );
  return (tx, ty) => grid[ty - ty0]?.[tx - tx0] ?? Tile.Grass;
}
