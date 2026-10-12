// Seeded RNG shared with the Python asset pipeline (tools/art/lib/rng.py).
// Both files must stay bit-for-bit identical; contracts/rng-vectors.json is the shared check.
// All arithmetic is unsigned 32-bit: Math.imul for multiplies, >>> 0 to normalise.

const U32_MAX = 0xffffffff;
const GOLDEN = 0x9e3779b9;

export function fmix32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** One deriveSeed combine step, UNCHECKED (hot paths only): part must be an integer in -2^31..2^32-1. */
export function mixSeedPart(h: number, part: number): number {
  return (fmix32(h ^ fmix32(part >>> 0)) + GOLDEN) >>> 0;
}

function rotl32(x: number, r: number): number {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function assertU32(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX) {
    throw new RangeError(`${name} must be an integer in 0..4294967295, got ${value}`);
  }
}

// Beyond 2^53 doubles lose integer precision while Python ints stay exact; reject in both.
function assertSafeInt(name: string, value: number): void {
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer, got ${value}`);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be within -(2^53-1)..2^53-1, got ${value}`);
  }
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    assertU32("seed", seed);
    let s = seed;
    const out: number[] = [];
    for (let i = 0; i < 4; i++) {
      // splitmix32 step
      s = (s + GOLDEN) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      out.push((z ^ (z >>> 16)) >>> 0);
    }
    [this.a, this.b, this.c, this.d] = out as [number, number, number, number];
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** sfc32: next unsigned 32-bit integer. */
  nextU32(): number {
    const t = (this.a + this.b + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = rotl32(this.c, 21);
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Uniform float in [0, 1); exact in float64. */
  nextFloat(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number {
    assertSafeInt("lo", lo);
    assertSafeInt("hi", hi);
    if (lo > hi) throw new RangeError(`lo must be <= hi, got lo=${lo} hi=${hi}`);
    if (hi - lo > U32_MAX) {
      throw new RangeError(`hi - lo must be < 2^32, got lo=${lo} hi=${hi}`);
    }
    return lo + Math.floor(this.nextFloat() * (hi - lo + 1));
  }
}

/** Sub-seed from a seed plus integer parts, e.g. (worldSeed, chunkX, chunkY). */
export function deriveSeed(seed: number, ...parts: number[]): number {
  assertU32("seed", seed);
  let h = fmix32(seed);
  parts.forEach((p, i) => {
    if (!Number.isSafeInteger(p) || p < -0x80000000 || p > U32_MAX) {
      throw new RangeError(
        `parts[${i}] must be an integer in -2147483648..4294967295, got ${p}`,
      );
    }
    h = mixSeedPart(h, p);
  });
  return h;
}

// TextEncoder is not in lib ES2022 and the sim has no DOM/Node types, so encode by hand.
function utf8Bytes(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const lo = s.charCodeAt(i + 1);
      if (!(lo >= 0xdc00 && lo <= 0xdfff)) {
        throw new RangeError(`s has a lone high surrogate at index ${i}; not valid UTF-8 text`);
      }
      cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
      i++;
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      throw new RangeError(`s has a lone low surrogate at index ${i}; not valid UTF-8 text`);
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a 32 over the UTF-8 bytes of s, then fmix32. For namespacing seeds by name. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (const byte of utf8Bytes(s)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return fmix32(h);
}
