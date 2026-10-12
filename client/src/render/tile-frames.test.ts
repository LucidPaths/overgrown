import { Biome, type BiomeValue } from "@overgrown/sim/world/biome";
import { Tile, type TileValue } from "@overgrown/sim/world/tile";
import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/tile-frames.json";
import {
  BIOME_PALETTES,
  EDGE_VARIANTS,
  FULL_VARIANTS,
  TERRAIN_KEYS,
  TERRAIN_RANK,
  tileFrames,
} from "./tile-frames";

// The same fixture is asserted by tools/art/tests/test_tiles.py against the frames the pipeline draws.
const tiles = Object.values(Tile);
const biomes = Object.values(Biome);

function expectedFrames(): Set<string> {
  const names = new Set<string>();
  for (const p of fixture.palettes) {
    for (const t of fixture.terrains) {
      const masks = t === fixture.precedence[0] ? [15] : Array.from({ length: 15 }, (_, i) => i + 1);
      for (const m of masks) {
        const n = m === 15 ? fixture.full_variants : fixture.edge_variants;
        for (let v = 0; v < n; v++) names.add(`tile/${p}/${t}/${m}/${v}`);
      }
    }
  }
  return names;
}

describe("tile-frames tables", () => {
  it("match contracts/tile-frames.json", () => {
    expect(tiles.length).toBe(fixture.terrains.length);
    for (const v of tiles) expect(TERRAIN_KEYS[v]).toBe(fixture.terrains[v]);
    expect(biomes.length).toBe(fixture.palettes.length);
    for (const v of biomes) expect(BIOME_PALETTES[v]).toBe(fixture.palettes[v]);
    const byRank = [...tiles].sort((a, b) => TERRAIN_RANK[a] - TERRAIN_RANK[b]).map((v) => TERRAIN_KEYS[v]);
    expect(byRank).toEqual(fixture.precedence);
    expect(FULL_VARIANTS).toBe(fixture.full_variants);
    expect(EDGE_VARIANTS).toBe(fixture.edge_variants);
  });
});

describe("tileFrames", () => {
  it("returns exactly the frames the pipeline draws, all reachable", { timeout: 30_000 }, () => {
    const seen = new Set<string>();
    for (const biome of biomes) {
      for (const tl of tiles) for (const tr of tiles) for (const bl of tiles) for (const br of tiles) {
        for (let rx = -4; rx < 4; rx++) {
          for (let ry = -4; ry < 4; ry++) {
            const names = tileFrames(tl, tr, bl, br, biome, rx, ry);
            if (names.length < 1 || names.length > 4 || !/\/15\/\d+$/.test(names[0]!)) {
              throw new Error(`bad result for ${[tl, tr, bl, br, biome, rx, ry]}: ${names}`);
            }
            for (const n of names) seen.add(n);
          }
        }
      }
    }
    const expected = expectedFrames();
    expect(expected.size).toBe(1100);
    expect(seen).toEqual(expected);
  });

  it("throws a RangeError naming the bad argument", () => {
    const g = Tile.Grass;
    expect(() => tileFrames(g, g, g, 8 as TileValue, 0, 0, 0)).toThrow(/br must be a Tile value, got 8/);
    expect(() => tileFrames(g, g, g, g, 5 as BiomeValue, 0, 0)).toThrow(/biome .* got 5/);
    expect(() => tileFrames(g, g, g, g, 0, 0.5, 0)).toThrow(/rx .* got 0\.5/);
    expect(() => tileFrames(g, g, g, g, 0, 0.5, 0)).toThrow(RangeError);
  });
});
