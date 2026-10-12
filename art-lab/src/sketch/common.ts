// Shared helpers for the 2D exploration sketches (paper, ink). Exploration code: fast to write, not shipped.
import { Ground, hash01 } from "../world/ground";

export const SEED = 22;
/** View: world tile rect shown by every sketch (forest | river | meadow, seed 22). */
export const VIEW = { tx0: 82, ty0: 50, tw: 40, th: 22.5 };

export function valueNoise(seed: number) {
  return (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash01(seed, ix, iy), b = hash01(seed, ix + 1, iy);
    const c = hash01(seed, ix, iy + 1), d = hash01(seed, ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
export function fbm(seed: number, oct = 4) {
  const ns = Array.from({ length: oct }, (_, i) => valueNoise(seed + i * 101));
  return (x: number, y: number) => {
    let t = 0, a = 1, n = 0, f = 1;
    for (let i = 0; i < oct; i++) { t += a * ns[i]!(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return t / n;
  };
}

/** Rank of a tile in the "paper stack" (higher = on top). */
export function rank(t: number): number {
  return [4, 4, 3, 4, 5, 2, 1, 0][t]!;
}

/** Bilinear mask over tile centres at fractional tile coords: 1 where pred(tile) holds. */
export function maskSampler(g: Ground, pred: (tx: number, ty: number) => boolean) {
  const cache = new Map<number, number>();
  const at = (tx: number, ty: number) => {
    const k = tx * 100003 + ty;
    let v = cache.get(k);
    if (v === undefined) { v = pred(tx, ty) ? 1 : 0; cache.set(k, v); }
    return v;
  };
  return (x: number, y: number) => {
    const gx = x - 0.5, gy = y - 0.5;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

export function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
