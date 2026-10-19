import { describe, expect, it } from "vitest";
import vectors from "../../../contracts/worldgen-vectors.json";
import { CHUNK_TILES } from "../constants";
import { Biome, type BiomeValue } from "./biome";
import { generateChunk, type ChunkData } from "./chunk-gen";
import { createChunkStore } from "./chunk-store";
import { findSpawn, SPAWN_SEARCH_RADIUS, type SpawnGround } from "./spawn";
import { Tile, type TileValue } from "./tile";
import { TILE_RULES } from "./walkability";

type Spot = readonly [tx: number, ty: number, biome: BiomeValue, tile: TileValue];

/** Ocean / VeryDeepWater everywhere except the listed tiles. */
function ground(spots: readonly Spot[]): SpawnGround {
  const find = (tx: number, ty: number) => spots.find((s) => s[0] === tx && s[1] === ty);
  return {
    biomeAt: (tx, ty) => find(tx, ty)?.[2] ?? Biome.Ocean,
    tileAt: (tx, ty) => find(tx, ty)?.[3] ?? Tile.VeryDeepWater,
  };
}

const G = Biome.Grassland;

describe("findSpawn", () => {
  it("findSpawn: smallest Chebyshev ring first, then (d², ty, tx); skips unwalkable Grassland", () => {
    // (1, 0) is ring 1 but DeepWater; ring 2 holds four walkable tiles. d²: 8, 5, 5, 5 → ty breaks the tie at -2 (tx 1).
    const a = ground([
      [1, 0, G, Tile.DeepWater],
      [-2, -2, G, Tile.Grass],
      [2, -1, G, Tile.Grass],
      [-1, 2, G, Tile.Grass],
      [1, -2, G, Tile.Grass],
    ]);
    expect(findSpawn(a)).toEqual({ x: 1 * 16 + 8, y: -2 * 16 + 8 });
    // Ring 3 (d² 18) beats ring 4 (d² 16): the ring comes before the distance.
    const b = ground([
      [3, 3, G, Tile.Grass],
      [4, 0, G, Tile.Grass],
    ]);
    expect(findSpawn(b)).toEqual({ x: 3 * 16 + 8, y: 3 * 16 + 8 });
  });

  it("findSpawn: throws when no walkable Grassland is within SPAWN_SEARCH_RADIUS, finds one exactly at it", () => {
    expect(() => findSpawn(ground([]))).toThrow(String(SPAWN_SEARCH_RADIUS));
    expect(() => findSpawn(ground([[SPAWN_SEARCH_RADIUS + 1, 0, G, Tile.Grass]]))).toThrow(Error);
    expect(findSpawn(ground([[0, -SPAWN_SEARCH_RADIUS, G, Tile.Grass]]))).toEqual({
      x: 8,
      y: -SPAWN_SEARCH_RADIUS * 16 + 8,
    });
  });

  it("findSpawn on seed 42: origin is ocean; spawn is walkable Grassland, no smaller ring has one; two stores agree", () => {
    const store = createChunkStore(42);
    // Read straight from generateChunk, so a mix-up inside the store's own accessors can't hide.
    const chunks = new Map<string, ChunkData>();
    const layers = (tx: number, ty: number): { tile: TileValue; biome: number } => {
      const cx = Math.floor(tx / CHUNK_TILES);
      const cy = Math.floor(ty / CHUNK_TILES);
      const key = `${cx},${cy}`;
      if (!chunks.has(key)) chunks.set(key, generateChunk(42, cx, cy));
      const i = (ty - cy * CHUNK_TILES) * CHUNK_TILES + (tx - cx * CHUNK_TILES);
      const c = chunks.get(key)!;
      return { tile: c.tiles[i] as TileValue, biome: c.biomes[i]! };
    };
    const walkableGrassland = (tx: number, ty: number): boolean => {
      const t = layers(tx, ty);
      return t.biome === Biome.Grassland && TILE_RULES[t.tile].walkable;
    };
    expect(walkableGrassland(0, 0)).toBe(false);

    const spawn = findSpawn(store);
    const tx = Math.floor(spawn.x / 16);
    const ty = Math.floor(spawn.y / 16);
    expect(walkableGrassland(tx, ty)).toBe(true);

    const ring = Math.max(Math.abs(tx), Math.abs(ty));
    for (let y = -ring + 1; y < ring; y++) {
      for (let x = -ring + 1; x < ring; x++) {
        expect(walkableGrassland(x, y), `tile (${x}, ${y}) is in a smaller ring`).toBe(false);
        expect([store.tileAt(x, y), store.biomeAt(x, y)], `store layers at (${x}, ${y})`).toEqual([
          layers(x, y).tile,
          layers(x, y).biome,
        ]);
      }
    }
    expect(findSpawn(createChunkStore(42))).toEqual(spawn);
  });

  // Shared with game/tests/test_worldgen.gd. Seeds 34 and 47 are ties in the winning ring, so they pin the ty-before-tx tie-break.
  it("fixture holds at least 7 spawn vectors (an emptied array would skip the contract spawns)", () => {
    expect(vectors.spawn.length).toBeGreaterThanOrEqual(7);
  });

  it.each(vectors.spawn.map((v) => [v.seed, v.x, v.y] as const))(
    "contract spawn: seed %d is (%d, %d)",
    (seed, x, y) => {
      expect(findSpawn(createChunkStore(seed))).toEqual({ x, y });
    },
  );
});
