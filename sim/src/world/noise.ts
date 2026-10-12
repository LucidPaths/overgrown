// Deterministic worldgen noise. Bit-identical in every JS engine: see CLAUDE.md "Worldgen noise".
// The lattice value at integer corner (ix, iy) of octave i is deriveSeed(deriveSeed(seed, i), ix, iy) / 2^32,
// so the Python pipeline can reproduce it with derive_seed alone.
import { deriveSeed, fmix32, mixSeedPart } from "../rng";

/** A continuous 2-D scalar field over world tile coordinates, values in [0, 1). */
export type Field2 = (x: number, y: number) => number;

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lattice value in [0, 1); h is fmix32(octaveSeed), so this equals deriveSeed(octaveSeed, i, j) / 2^32. */
function lattice(h: number, i: number, j: number): number {
  return mixSeedPart(mixSeedPart(h, i), j) / 4294967296;
}

function octave(h: number, w: number, x: number, y: number): number {
  const gx = x / w;
  const gy = y / w;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = fade(gx - ix);
  const fy = fade(gy - iy);
  const top = lerp(lattice(h, ix, iy), lattice(h, ix + 1, iy), fx);
  const bottom = lerp(lattice(h, ix, iy + 1), lattice(h, ix + 1, iy + 1), fx);
  return lerp(top, bottom, fy);
}

/**
 * Fractal value noise: one octave per wavelength (in tiles), amplitude halving each octave, normalised to [0, 1).
 * Bit-identical in every JS engine: only + - * /, Math.floor and 32-bit integer ops.
 * Domain: finite x, y in [-2^31, 2^31). Not checked per call (hot path); callers that take outside input validate it
 * (generateChunk does).
 */
export function createFbm(seed: number, wavelengths: readonly number[]): Field2 {
  if (wavelengths.length < 1) throw new RangeError("wavelengths must not be empty, got []");
  wavelengths.forEach((w, i) => {
    if (!Number.isInteger(w) || w < 1) {
      throw new RangeError(`wavelengths[${i}] must be an integer >= 1, got ${w}`);
    }
  });
  const n = wavelengths.length;
  const h: number[] = [];
  const amp: number[] = [];
  for (let i = 0; i < n; i++) {
    h.push(fmix32(deriveSeed(seed, i)));
    amp.push(i === 0 ? 1 : amp[i - 1]! * 0.5);
  }
  let norm = 0;
  for (let i = 0; i < n; i++) norm += amp[i]!;
  return (x, y) => {
    let total = 0;
    for (let i = 0; i < n; i++) total += amp[i]! * octave(h[i]!, wavelengths[i]!, x, y);
    return total / norm;
  };
}
