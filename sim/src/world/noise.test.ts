import { describe, expect, it } from "vitest";
import vectors from "../../../contracts/worldgen-vectors.json";
import { deriveSeed } from "../rng";
import { createFbm } from "./noise";

describe("createFbm", () => {
  // Pinned from the spec's reference implementation; any drift in the noise arithmetic changes these.
  it.each([
    [0, 0, 0.27640928483257693],
    [37, -5, 0.47350522662102396],
    [-1000, 2049, 0.6012487562564303],
    [-2147483648, 2147483647, 0.6524181601223612],
    [0.5, -0.25, 0.2761308198732707],
  ])("golden value at (%d, %d)", (x, y, value) => {
    expect(createFbm(7, [64, 16])(x, y)).toBe(value);
  });

  it("lattice is deriveSeed(octaveSeed, ix, iy) / 2^32 (reproducible from the RNG contract)", () => {
    const expected = deriveSeed(deriveSeed(1, 0), 3, 4) / 4294967296;
    expect(expected).toBe(0.8629811755381525);
    expect(createFbm(1, [1])(3, 4)).toBe(expected);
  });

  it("rejects empty, zero and fractional wavelengths", () => {
    expect(() => createFbm(1, [])).toThrow(RangeError);
    expect(() => createFbm(1, [])).toThrow(/wavelengths must not be empty/);
    expect(() => createFbm(1, [0])).toThrow(RangeError);
    expect(() => createFbm(1, [0])).toThrow(/wavelengths\[0\].*got 0/);
    expect(() => createFbm(1, [1.5])).toThrow(RangeError);
    expect(() => createFbm(1, [1.5])).toThrow(/wavelengths\[0\].*got 1\.5/);
  });

  // Shared with game/tests/test_worldgen.gd: the exact float64 bit pattern, never a decimal (Godot's JSON float
  // parsing is not correctly rounded).
  it.each(vectors.noise.map((n) => [n.seed, n.wavelengths, n.x, n.y, n.bits] as const))(
    "contract sample: seed %d, wavelengths %j at (%d, %d)",
    (seed, wavelengths, x, y, bits) => {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, createFbm(seed, wavelengths)(x, y));
      expect(view.getBigUint64(0).toString(16).padStart(16, "0")).toBe(bits);
    },
  );
});
