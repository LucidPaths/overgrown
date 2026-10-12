import { describe, expect, it } from "vitest";
import { slideMove, speedFactorAt } from "./collision";
import { groundFromRows } from "./test-ground";
import { Tile } from "./tile";
import { SHALLOW_WATER_SPEED, TILE_RULES } from "./walkability";

const HW = 5;
const HH = 3;

/** A one-tile-wide wall column `ch` at tile column tx, over tile rows -3..6. */
function wallColumn(ch: string, tx: number) {
  return groundFromRows(Array.from({ length: 10 }, () => ch), tx, -3);
}

/** A one-tile-high wall row `ch` at tile row ty, over tile columns -3..6. */
function wallRow(ch: string, ty: number) {
  return groundFromRows([ch.repeat(10)], -3, ty);
}

describe("collision", () => {
  it("TILE_RULES: Cliff, DeepWater and VeryDeepWater block; ShallowWater ×SHALLOW_WATER_SPEED; depth 0/1/2/3", () => {
    const blocking: number[] = [Tile.Cliff, Tile.DeepWater, Tile.VeryDeepWater];
    for (const tile of Object.values(Tile)) {
      const rule = TILE_RULES[tile];
      expect(rule.walkable, `walkable of tile ${tile}`).toBe(!blocking.includes(tile));
      expect(rule.speed, `speed of tile ${tile}`).toBe(tile === Tile.ShallowWater ? SHALLOW_WATER_SPEED : 1);
      const depth = tile === Tile.ShallowWater ? 1 : tile === Tile.DeepWater ? 2 : tile === Tile.VeryDeepWater ? 3 : 0;
      expect(rule.depth, `depth of tile ${tile}`).toBe(depth);
    }
  });

  it("slideMove: stops flush at walls on each axis and direction, at negative coordinates, without tunnelling", () => {
    const cases: { name: string; ground: ReturnType<typeof wallColumn>; from: [number, number]; d: [number, number]; to: [number, number] }[] = [
      { name: "west wall at tx -1", ground: wallColumn("#", -1), from: [20, 8], d: [-30, 0], to: [5, 8] },
      { name: "east wall at tx 3", ground: wallColumn("#", 3), from: [30, 8], d: [30, 0], to: [43, 8] },
      { name: "east wall, destination past it", ground: wallColumn("#", 3), from: [30, 8], d: [40, 0], to: [43, 8] },
      { name: "south deep water row at ty 2", ground: wallRow("D", 2), from: [8, 20], d: [0, 20], to: [8, 32] },
      { name: "north very deep water row at ty -1", ground: wallRow("V", -1), from: [8, 10], d: [0, -20], to: [8, 6] },
    ];
    for (const c of cases) {
      const hit = slideMove(c.ground, c.from[0], c.from[1], HW, HH, c.d[0], c.d[1]);
      expect([c.name, hit.x, hit.y]).toEqual([c.name, c.to[0], c.to[1]]);
      const again = slideMove(c.ground, hit.x, hit.y, HW, HH, c.d[0], c.d[1]);
      expect([c.name, again.x, again.y]).toEqual([c.name, c.to[0], c.to[1]]);
    }
  });

  it("slideMove: slides along walls, moves freely parallel to a flush wall, resolves x before y at an outside corner", () => {
    const wall = wallColumn("#", 3);
    expect(slideMove(wall, 40, 8, HW, HH, 3, 3)).toEqual({ x: 43, y: 11 });
    expect(slideMove(wall, 43, 8, HW, HH, 0, 10)).toEqual({ x: 43, y: 18 });
    // A single cliff at tile (2, 2): x is free alone, then y stops flush on top of it.
    const corner = groundFromRows(["#"], 2, 2);
    expect(slideMove(corner, 25, 30, HW, HH, 4, 4)).toEqual({ x: 29, y: 32 });
  });

  it("slideMove: a box straddling two tile rows is stopped by a wall in only the upper row", () => {
    // Feet y 18, hh 3: the box covers y 12..18, so tile rows 0 and 1. The cliff is at tile (3, 0) only.
    const upperOnly = groundFromRows(["#"], 3, 0);
    expect(slideMove(upperOnly, 30, 18, HW, HH, 30, 0)).toEqual({ x: 43, y: 18 });
  });

  it("speedFactorAt samples the tile under the box centre (x, y − hh)", () => {
    const ground = wallRow("~", 2);
    expect(speedFactorAt(ground, 8, 34, HH)).toBe(1);
    expect(speedFactorAt(ground, 8, 36, HH)).toBe(SHALLOW_WATER_SPEED);
  });

  it("speedFactorAt samples the x of the box centre, not an x-edge of the box", () => {
    // Shallow water at tile column 2 (x 32..48) in row 0; feet y 11 puts the centre (y 8) in row 0.
    const ground = groundFromRows(["~"], 2, 0);
    expect(speedFactorAt(ground, 30, 11, HH)).toBe(1); // centre in column 1, a box edge (x + 5 = 35) would be in column 2
    expect(speedFactorAt(ground, 36, 11, HH)).toBe(SHALLOW_WATER_SPEED); // centre in column 2, x - 5 = 31 is in column 1
    expect(speedFactorAt(ground, 44, 11, HH)).toBe(SHALLOW_WATER_SPEED); // centre in column 2, x + 5 = 49 is in column 3
    expect(speedFactorAt(ground, 50, 11, HH)).toBe(1); // centre in column 3, x - 5 = 45 is in column 2
  });
});
