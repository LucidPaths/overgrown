import { describe, expect, it } from "vitest";
import vectors from "../../contracts/rng-vectors.json";
import { Rng, deriveSeed, hashString } from "./rng";

// Same vectors are asserted by tools/art/tests/test_rng.py; any TS/Python divergence fails one side.
describe("rng shared vectors", () => {
  it.each(vectors.rng)("nextU32 for seed $seed", ({ seed, u32 }) => {
    const r = new Rng(seed);
    expect(u32.map(() => r.nextU32())).toEqual(u32);
  });

  it("nextFloat", () => {
    const r = new Rng(vectors.float.seed);
    expect(vectors.float.values.map(() => r.nextFloat())).toEqual(vectors.float.values);
  });

  it("int", () => {
    const { seed, lo, hi, values } = vectors.int;
    const r = new Rng(seed);
    expect(values.map(() => r.int(lo, hi))).toEqual(values);
  });

  it.each(vectors.derive)("deriveSeed($seed, $parts)", ({ seed, parts, out }) => {
    expect(deriveSeed(seed, ...parts)).toBe(out);
  });

  it.each(vectors.hashString)("hashString($s)", ({ s, out }) => {
    expect(hashString(s)).toBe(out);
  });
});

describe("Rng.int argument validation", () => {
  it("rejects lo > hi", () => {
    expect(() => new Rng(1).int(6, 1)).toThrow(/lo must be <= hi/);
  });

  it("rejects non-integers", () => {
    expect(() => new Rng(1).int(1.5, 6)).toThrow(/lo must be an integer/);
    expect(() => new Rng(1).int(1, 6.5)).toThrow(/hi must be an integer/);
  });

  it("rejects integers beyond 2^53 (doubles diverge from Python there)", () => {
    expect(() => new Rng(1).int(0, 2 ** 53)).toThrow(/hi must be within/);
    expect(() => new Rng(1).int(-(2 ** 53), 0)).toThrow(/lo must be within/);
  });
});
