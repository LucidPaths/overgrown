import { describe, expect, it } from "vitest";
import { CHUNK_TILES } from "../constants";
import { deriveSeed } from "../rng";
import { ELEVATION_WAVELENGTHS, classifyElevation, createElevation, generateChunk } from "./chunk-gen";

describe("generateChunk", () => {
  // Digests pinned from the spec's reference implementation: same seed must mean same world, everywhere.
  it.each([
    [42, 0, 0, 3156299026],
    [42, -5, -5, 1621497478],
    [42, -1, -8, 1005403038],
    [0, -2, -6, 2625681554],
    [4294967295, -5, 0, 2736794256],
    [4294967295, 7, -7, 3476723864],
    [42, -67108864, 67108863, 1958065395],
  ])("golden digest for seed %d chunk (%d, %d)", (seed, cx, cy, digest) => {
    const chunk = generateChunk(seed, cx, cy);
    expect(chunk.cx).toBe(cx);
    expect(chunk.cy).toBe(cy);
    expect(chunk.tiles.length).toBe(1024);
    expect(deriveSeed(0, ...chunk.tiles)).toBe(digest);
  });

  it.each([
    [-1, -1],
    [0, -1],
    [-1, 0],
    [0, 0],
    [3, -7],
  ])("chunk (%d, %d) equals the elevation field at world tile coords", (cx, cy) => {
    const elev = createElevation(42);
    const { tiles } = generateChunk(42, cx, cy);
    for (let ly = 0; ly < CHUNK_TILES; ly++) {
      for (let lx = 0; lx < CHUNK_TILES; lx++) {
        const expected = classifyElevation(elev(cx * CHUNK_TILES + lx, cy * CHUNK_TILES + ly));
        expect(tiles[ly * CHUNK_TILES + lx], `tile (${lx}, ${ly})`).toBe(expected);
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
    const elev = createElevation(42);
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
});
