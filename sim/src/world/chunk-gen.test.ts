import { describe, expect, it } from "vitest";
import { CHUNK_TILES } from "../constants";
import { deriveSeed } from "../rng";
import { Biome, type BiomeValue } from "./biome";
import { ELEVATION_WAVELENGTHS, classifyBiome, createWorldFields, sampleBiome } from "./biome-map";
import { generateChunk, isFord, pickTile } from "./chunk-gen";
import { Tile } from "./tile";

describe("generateChunk", () => {
  // Digests pinned from the spec's reference implementation (WLD-002): same seed must mean same world, everywhere.
  // Retuning any constant changes these on purpose; re-pin in the same PR and say so.
  it.each([
    [42, 0, 0, 1915587938, 3925879910],
    [42, -7, -10, 3296536726, 4270543085],
    [42, -3, 10, 2392050323, 1517910948],
    [42, -9, 10, 2843203185, 1398303617],
    [42, 10, -12, 2581766421, 1340117147],
    [0, -12, -3, 2146707795, 4291061362],
    [0, 1, 10, 2828726546, 1883677180],
    [4294967295, -2, 5, 1292694308, 1731315570],
    [42, -67108864, 67108863, 3000448224, 2729932670],
    [0, 67108863, -67108864, 689241650, 2220377030],
  ])("golden digests for seed %d chunk (%d, %d)", (seed, cx, cy, tilesDigest, biomesDigest) => {
    const chunk = generateChunk(seed, cx, cy);
    expect(chunk.cx).toBe(cx);
    expect(chunk.cy).toBe(cy);
    expect(chunk.tiles.length).toBe(1024);
    expect(chunk.biomes.length).toBe(1024);
    expect(deriveSeed(0, ...chunk.tiles)).toBe(tilesDigest);
    expect(deriveSeed(0, ...chunk.biomes)).toBe(biomesDigest);
  });

  it.each([
    [-1, -1],
    [0, -1],
    [-1, 0],
    [0, 0],
    [-3, 10],
    [-9, 10],
  ])("chunk (%d, %d) equals the per-tile functions at world tile coords", (cx, cy) => {
    const f = createWorldFields(42);
    const { tiles, biomes } = generateChunk(42, cx, cy);
    for (let ly = 0; ly < CHUNK_TILES; ly++) {
      for (let lx = 0; lx < CHUNK_TILES; lx++) {
        const tx = cx * CHUNK_TILES + lx;
        const ty = cy * CHUNK_TILES + ly;
        const i = ly * CHUNK_TILES + lx;
        const s = sampleBiome(f, tx, ty);
        expect(biomes[i], `biome (${lx}, ${ly})`).toBe(classifyBiome(s));
        expect(tiles[i], `tile (${lx}, ${ly})`).toBe(pickTile(f, s, biomes[i] as BiomeValue, tx, ty));
      }
    }
  });

  it("elevation has no jumps across chunk borders (adjacent tiles within the fade slope bound)", () => {
    // No ** here: sim/src/world/ lint forbids it (engine-dependent pow).
    let slope = 0;
    let ampSum = 0;
    let amp = 1;
    for (const w of ELEVATION_WAVELENGTHS) {
      slope += amp / w;
      ampSum += amp;
      amp *= 0.5;
    }
    const bound = (1.5 * slope) / ampSum + 1e-12;
    const elev = createWorldFields(42).elevation;
    let worst = 0;
    for (let ty = -64; ty < 64; ty++) {
      for (let tx = -64; tx < 64; tx++) {
        const e = elev(tx, ty);
        if (tx + 1 < 64) worst = Math.max(worst, Math.abs(elev(tx + 1, ty) - e));
        if (ty + 1 < 64) worst = Math.max(worst, Math.abs(elev(tx, ty + 1) - e));
      }
    }
    expect(worst).toBeLessThanOrEqual(bound);
  });

  it("rejects fractional or out-of-range chunk coordinates and seeds", () => {
    expect(() => generateChunk(42, 0.5, 0)).toThrow(RangeError);
    expect(() => generateChunk(42, 0.5, 0)).toThrow(/cx .*got 0\.5/);
    expect(() => generateChunk(42, 67108864, 0)).toThrow(RangeError);
    expect(() => generateChunk(42, 67108864, 0)).toThrow(/cx .*got 67108864/);
    expect(() => generateChunk(42, 0, -67108865)).toThrow(RangeError);
    expect(() => generateChunk(42, 0, -67108865)).toThrow(/cy .*got -67108865/);
    expect(() => generateChunk(-1, 0, 0)).toThrow(RangeError);
    expect(() => generateChunk(-1, 0, 0)).toThrow(/seed .*got -1/);
    expect(() => generateChunk(4294967296, 0, 0)).toThrow(RangeError);
    expect(() => generateChunk(4294967296, 0, 0)).toThrow(/seed .*got 4294967296/);
  });

  it("seed 42 has a sane biome mix: every biome present, shallow rivers with deep cores, fords, regions 2-10 chunks", () => {
    const f = createWorldFields(42);
    const counts = [0, 0, 0, 0, 0];
    let cliff = 0;
    let rSW = 0;
    let rDW = 0;
    let deepOnFord = 0;
    let runTiles = 0;
    let runs = 0;
    let total = 0;
    for (const cy of [-24, -8, 8, 24]) {
      const prev = new Array<number>(CHUNK_TILES).fill(-1);
      for (let cx = -32; cx < 32; cx++) {
        const { tiles, biomes } = generateChunk(42, cx, cy);
        for (let ly = 0; ly < CHUNK_TILES; ly++) {
          for (let lx = 0; lx < CHUNK_TILES; lx++) {
            const i = ly * CHUNK_TILES + lx;
            const b = biomes[i]!;
            const t = tiles[i]!;
            total++;
            counts[b]!++;
            if (t === Tile.Cliff) cliff++;
            if (b === Biome.River) {
              if (t === Tile.ShallowWater) rSW++;
              if (t === Tile.DeepWater) {
                rDW++;
                if (isFord(f, cx * CHUNK_TILES + lx, cy * CHUNK_TILES + ly)) deepOnFord++;
              }
            } else {
              runTiles++;
              if (b !== prev[ly]) {
                runs++;
                prev[ly] = b;
              }
            }
          }
        }
      }
    }
    const frac = (b: number): number => counts[b]! / total;
    for (const b of [Biome.Grassland, Biome.Forest, Biome.Mountain, Biome.Ocean]) {
      expect(frac(b), `biome ${b}`).toBeGreaterThanOrEqual(0.05);
    }
    expect(frac(Biome.Ocean)).toBeLessThanOrEqual(0.5);
    expect(frac(Biome.Mountain)).toBeLessThanOrEqual(0.5);
    expect(frac(Biome.River)).toBeGreaterThanOrEqual(0.005);
    expect(frac(Biome.River)).toBeLessThanOrEqual(0.1);
    expect(cliff / total).toBeGreaterThanOrEqual(0.001);
    expect(cliff / total).toBeLessThanOrEqual(0.03);
    expect(rDW).toBeGreaterThan(0);
    expect(rSW).toBeGreaterThan(rDW);
    expect(deepOnFord).toBe(0);
    const meanRun = runTiles / runs;
    expect(meanRun).toBeGreaterThanOrEqual(64);
    expect(meanRun).toBeLessThanOrEqual(320);
  });
});
