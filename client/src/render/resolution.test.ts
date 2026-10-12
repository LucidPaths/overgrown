import { describe, expect, it } from "vitest";
import { renderResolution } from "./resolution";

const DPRS = [0.5, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.625, 2.75, 3, 3.5, 4, 5];
const CAPS = [1, 2, 3, 4];

describe("renderResolution: dpr / smallest integer k with dpr / k ≤ maxDpr", () => {
  it("keeps an integer upscale and the largest resolution under the cap", () => {
    for (const maxDpr of CAPS) {
      for (const dpr of DPRS) {
        const r = renderResolution(dpr, maxDpr);
        expect(r <= maxDpr || r === dpr, `r <= cap: dpr ${dpr} cap ${maxDpr}`).toBe(true);
        const k = dpr / r;
        expect(Math.abs(k - Math.round(k)), `k integer: dpr ${dpr} cap ${maxDpr}`).toBeLessThan(1e-9);
        expect(k >= 1 - 1e-9, `k >= 1: dpr ${dpr} cap ${maxDpr}`).toBe(true);
        const kInt = Math.round(k);
        expect(kInt === 1 || dpr / (kInt - 1) > maxDpr, `largest: dpr ${dpr} cap ${maxDpr}`).toBe(true);
      }
    }
  });

  it("pins real phone DPRs", () => {
    const pinned: [number, number, number][] = [
      [1, 2, 1],
      [2, 2, 2],
      [2.25, 2, 1.125],
      [2.625, 2, 1.3125],
      [3, 2, 1.5],
      [3.5, 2, 1.75],
      [4, 2, 2],
      [0.9, 2, 0.9],
      [3, 1, 1],
      [3, 4, 3],
    ];
    for (const [dpr, maxDpr, want] of pinned) expect(renderResolution(dpr, maxDpr)).toBeCloseTo(want, 12);
  });

  it("uses the default cap of 2", () => {
    expect(renderResolution(3)).toBe(1.5);
  });

  it("rejects values that are not a DPR or a whole cap", () => {
    for (const dpr of [NaN, 0, -1, Infinity]) expect(() => renderResolution(dpr, 2)).toThrow(RangeError);
    for (const maxDpr of [0, 1.5]) expect(() => renderResolution(2, maxDpr)).toThrow(RangeError);
  });
});
