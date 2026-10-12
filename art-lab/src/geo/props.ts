// Prop generators. Each makes one variant in local space (base at the origin, y up, world px), from a seed.
// Shapes: lumpy balls for foliage, tapered prisms for wood, squashed lumps for stone. Colours are the
// "natural" palette; the bake step tints per biome and per instance.
import { compose } from "../gl/math";
import { hash01 } from "../world/ground";
import { P } from "../world/placement";
import { Geo, MAT, hex, mixc, shade, type RGB } from "./builder";

const BARK = hex(0x6e4c3c), BARK_DARK = hex(0x553a30);
const OAK_LEAF = [hex(0x3f8a4c), hex(0x5aa652), hex(0x86c45c)];
const PINE_LEAF = [hex(0x2c6450), hex(0x3a7f5e), hex(0x55a070)];
const BIRCH_LEAF = [hex(0x8fb84e), hex(0xb0d05e), hex(0xd2e27a)];
const ROCK = hex(0x8e8a88), MOSS = hex(0x6f9a4a);

type R = (k: number) => number;
const rng = (seed: number): R => (k: number) => hash01(seed, k, 7);

/** Foliage colour by height in the crown: darker low, lighter high (keeps the read "lit from above" even in shade). */
function leaf(pal: RGB[], t: number): RGB {
  return t < 0.5 ? mixc(pal[0]!, pal[1]!, t * 2) : mixc(pal[1]!, pal[2]!, (t - 0.5) * 2);
}

function trunk(g: Geo, r: R, h: number, r0: number, lean: number, bark = BARK): number[] {
  const yaw = r(1) * 6.28;
  const m = compose(0, 0, 0, yaw, 0, lean);
  g.cylinder(m, 5, r0, r0 * 0.6, h, (i) => ({ col: i % 2 ? bark : shade(bark, 0.88), mat: MAT.Prop, wind: 0 }), false);
  // root flare
  g.cylinder(compose(0, -1, 0, yaw + 0.3), 5, r0 * 1.7, r0 * 0.9, 4, { col: BARK_DARK, mat: MAT.Prop }, false);
  return [Math.sin(-lean) * h * -1, h, 0];
}

function oak(seed: number, pal = OAK_LEAF): Geo {
  const g = new Geo();
  const r = rng(seed);
  const h = 22 + r(2) * 12;
  const lean = (r(3) - 0.5) * 0.25;
  const top = trunk(g, r, h, 3 + r(4) * 1.2, lean);
  // branch stubs
  for (let b = 0; b < 2; b++) {
    const a = r(10 + b) * 6.28;
    g.cylinder(compose(top[0]! * 0.6, h * (0.55 + b * 0.15), 0, a, 0, 0.9), 4, 1.4, 0.8, 9, { col: BARK, mat: MAT.Prop, wind: 0.2 }, false);
  }
  const crown = 13 + r(5) * 6;
  const n = 4 + Math.floor(r(6) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + r(20 + i);
    const d = i === 0 ? 0 : crown * (0.45 + r(30 + i) * 0.3);
    const rad = i === 0 ? crown : crown * (0.55 + r(40 + i) * 0.25);
    const y = h + crown * 0.35 + (i === 0 ? crown * 0.25 : r(50 + i) * crown * 0.45 - crown * 0.15);
    const m = compose(top[0]! + Math.cos(a) * d, y, Math.sin(a) * d, r(60 + i) * 6, 0, 0, rad, rad * 0.86, rad);
    g.blob(m, 1, 0.12, seed + i * 31, (_n, p) => ({ col: leaf(pal, (p[1]! - h) / (crown * 2)), mat: MAT.Foliage, wind: Math.min(1, (p[1]! / (h + crown * 1.6))) }), true);
  }
  return g;
}

function pine(seed: number, snow = false): Geo {
  const g = new Geo();
  const r = rng(seed);
  const h = 8 + r(2) * 5;
  trunk(g, r, h + 6, 2.4, (r(3) - 0.5) * 0.1);
  const tiers = 3 + Math.floor(r(4) * 2);
  let y = h, rad = 12 + r(5) * 4;
  for (let i = 0; i < tiers; i++) {
    const th = rad * 1.25;
    const c = leaf(PINE_LEAF, i / (tiers - 1 || 1));
    const m = compose((r(10 + i) - 0.5) * 1.5, y, (r(20 + i) - 0.5) * 1.5, r(30 + i) * 6);
    g.cylinder(m, 7, rad, 0, th, (k) => ({ col: snow && k % 2 === 0 ? hex(0xeef4fb) : k % 2 ? c : shade(c, 0.9), mat: MAT.Foliage, wind: Math.min(1, (y + th) / 60) }), true, r(40 + i));
    y += th * 0.5;
    rad *= 0.72;
  }
  return g;
}

function birch(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const h = 26 + r(2) * 10;
  const lean = (r(3) - 0.5) * 0.2;
  const yaw = r(1) * 6;
  g.cylinder(compose(0, 0, 0, yaw, 0, lean), 5, 2.2, 1.5, h, (i) => ({ col: i === 2 ? hex(0x3d3a3a) : hex(0xe8e4dc), mat: MAT.Prop }), false);
  const top = Math.sin(-lean) * h * -1;
  const n = 3 + Math.floor(r(6) * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28;
    const rad = 7 + r(40 + i) * 4;
    const m = compose(top + Math.cos(a) * 5, h + 2 + r(50 + i) * 8, Math.sin(a) * 5, 0, 0, 0, rad, rad * 1.2, rad);
    g.blob(m, 1, 0.15, seed + i * 17, (_n, p) => ({ col: leaf(BIRCH_LEAF, (p[1]! - h) / 22), mat: MAT.Foliage, wind: 1 }), true);
  }
  return g;
}

function bush(seed: number, berries: boolean): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 2 + Math.floor(r(1) * 2);
  for (let i = 0; i < n; i++) {
    const rad = 5 + r(10 + i) * 3;
    const m = compose((i - (n - 1) / 2) * 5, rad * 0.6, (r(20 + i) - 0.5) * 4, r(30 + i) * 6, 0, 0, rad, rad * 0.85, rad);
    g.blob(m, 1, 0.15, seed + i, (_n, p) => ({ col: leaf(OAK_LEAF, p[1]! / 12), mat: MAT.Foliage, wind: 0.5 }), true);
  }
  if (berries) {
    for (let i = 0; i < 6; i++) {
      const a = r(50 + i) * 6.28;
      g.blob(compose(Math.cos(a) * 6, 4 + r(60 + i) * 6, Math.sin(a) * 5 + 2, 0, 0, 0, 1.1, 1.1, 1.1), 0, 0, seed + i, { col: hex(0xd8344a), mat: MAT.Foliage, wind: 0.5 });
    }
  }
  return g;
}

const FLOWER_COLS = [0xf6f1e4, 0xf3cf3b, 0xee7a9a, 0xe0443e, 0x9a7ae0, 0xf39a3c];
function flowers(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const col = hex(FLOWER_COLS[Math.floor(r(1) * FLOWER_COLS.length)]!);
  const n = 4 + Math.floor(r(2) * 5);
  for (let i = 0; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 12, z = (r(20 + i) - 0.5) * 9, hgt = 3 + r(30 + i) * 3;
    g.cylinder(compose(x, 0, z), 3, 0.5, 0.4, hgt, { col: hex(0x4f8a3c), mat: MAT.Grass, wind: 1 }, false);
    g.blob(compose(x, hgt, z, 0, 0, 0, 1.3, 1.0, 1.3), 0, 0, seed + i, { col: i % 4 === 3 ? hex(0xf6f1e4) : col, mat: MAT.Foliage, wind: 1 });
  }
  return g;
}

function rock(seed: number, big: boolean): Geo {
  const g = new Geo();
  const r = rng(seed);
  const s = big ? 9 + r(1) * 5 : 3 + r(1) * 3;
  const m = compose(0, s * 0.35, 0, r(2) * 6, (r(3) - 0.5) * 0.4, 0, s * (1 + r(4) * 0.4), s * 0.75, s);
  g.blob(m, big ? 1 : 0, 0.22, seed, (n) => ({ col: n[1]! > 0.55 && big ? mixc(MOSS, ROCK, r(5) * 0.4) : shade(ROCK, 0.9 + n[1]! * 0.15), mat: MAT.Prop }));
  if (big) {
    const m2 = compose(s * 0.7, s * 0.2, s * 0.3, r(6) * 6, 0, 0, s * 0.45, s * 0.4, s * 0.45);
    g.blob(m2, 0, 0.25, seed + 9, { col: shade(ROCK, 0.95), mat: MAT.Prop });
  }
  return g;
}

function fern(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 5 + Math.floor(r(1) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + r(10 + i) * 0.5;
    const L = 7 + r(20 + i) * 4;
    const c = mixc(hex(0x3f8a44), hex(0x6eb352), r(30 + i));
    const m = compose(0, 0, 0, a);
    const p0 = [0, 0, -1.2], p1 = [0, 0, 1.2], tip = [L, 3 + r(40 + i) * 2, 0], mid = [L * 0.5, 5, 0];
    const tfp = (p: number[]) => [m[0]! * p[0]! + m[8]! * p[2]!, p[1]!, m[2]! * p[0]! + m[10]! * p[2]!];
    g.tri(tfp(p0), tfp(mid), tfp(p1), { col: c, mat: MAT.Foliage, wind: 0.8 });
    g.tri(tfp(p1), tfp(mid), tfp(p0), { col: shade(c, 0.8), mat: MAT.Foliage, wind: 0.8 });
    g.tri(tfp([L * 0.5, 5, -1]), tfp(tip), tfp([L * 0.5, 5, 1]), { col: c, mat: MAT.Foliage, wind: 1 });
    g.tri(tfp([L * 0.5, 5, 1]), tfp(tip), tfp([L * 0.5, 5, -1]), { col: shade(c, 0.8), mat: MAT.Foliage, wind: 1 });
  }
  return g;
}

function mushroom(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 1 + Math.floor(r(1) * 3);
  for (let i = 0; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 8, z = (r(20 + i) - 0.5) * 6, s = 0.7 + r(30 + i) * 0.5;
    g.cylinder(compose(x, 0, z), 5, 1.1 * s, 0.9 * s, 4 * s, { col: hex(0xf0e8d8), mat: MAT.Prop }, false);
    g.blob(compose(x, 4 * s, z, 0, 0, 0, 3.2 * s, 1.8 * s, 3.2 * s), 1, 0.05, seed + i, (nn) => ({ col: nn[1]! > 0.7 && (nn[0]! * 7 + nn[2]! * 5) % 1 > 0.6 ? hex(0xfff6ea) : nn[1]! < 0 ? hex(0xf0e0d0) : hex(0xd9363e), mat: MAT.Prop }));
  }
  return g;
}

function reeds(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 5 + Math.floor(r(1) * 5);
  for (let i = 0; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 12, z = (r(20 + i) - 0.5) * 8, h = 10 + r(30 + i) * 9;
    const tilt = (r(40 + i) - 0.5) * 0.3;
    const c = mixc(hex(0x6f9a3e), hex(0xa3b85a), r(50 + i));
    g.cylinder(compose(x, -2, z, r(60 + i) * 6, 0, tilt), 3, 0.8, 0.3, h, { col: c, mat: MAT.Grass, wind: 1 }, false);
    if (i % 3 === 0) g.cylinder(compose(x + Math.sin(-tilt) * -h * 0.8, h * 0.78, z, 0, 0, tilt), 4, 1.2, 1.1, 3.5, { col: hex(0x7a4e32), mat: MAT.Prop, wind: 1 });
  }
  return g;
}

function lily(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 1 + Math.floor(r(1) * 3);
  for (let i = 0; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 10, z = (r(20 + i) - 0.5) * 8, s = 2.5 + r(30 + i) * 2;
    g.cylinder(compose(x, 0, z, r(40 + i) * 6), 7, s, s, 0.5, { col: mixc(hex(0x4f9a4a), hex(0x77b35a), r(50 + i)), mat: MAT.Prop }, true);
    if (i === 0 && r(60) > 0.5) g.blob(compose(x, 1.2, z, 0, 0, 0, 1.4, 1.2, 1.4), 0, 0, seed, { col: hex(0xf6a6c0), mat: MAT.Prop });
  }
  return g;
}

function log(seed: number, drift: boolean): Geo {
  const g = new Geo();
  const r = rng(seed);
  const L = 18 + r(1) * 12, rad = drift ? 2 : 3.2;
  const c = drift ? hex(0xc9bfae) : BARK;
  g.cylinder(compose(-L / 2, rad, 0, 0, 0, -Math.PI / 2), 6, rad, rad * 0.9, L, (_i, top) => ({ col: top ? hex(0xc8a070) : c, mat: MAT.Prop }), true);
  if (!drift) g.blob(compose(0, rad * 1.8, 0, 0, 0, 0, 4, 1.5, 3), 0, 0.2, seed, { col: MOSS, mat: MAT.Prop });
  return g;
}

function stump(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  g.cylinder(compose(0, 0, 0, r(1) * 6), 6, 4.5, 3.8, 5, (_i, top) => ({ col: top ? hex(0xd0a676) : BARK, mat: MAT.Prop }), true);
  return g;
}

function palm(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  const segs = 6;
  let x = 0, y = 0, a = 0;
  const bend = 0.06 + r(1) * 0.06;
  for (let i = 0; i < segs; i++) {
    g.cylinder(compose(x, y, 0, 0, 0, -a), 5, 2.4 - i * 0.15, 2.2 - i * 0.15, 6, (k) => ({ col: k % 2 ? hex(0x8a6a4a) : hex(0x75583e), mat: MAT.Prop, wind: i / segs * 0.4 }), false);
    x += Math.sin(a) * 6; y += Math.cos(a) * 6; a += bend;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.28 + r(10 + i);
    const L = 14 + r(20 + i) * 5;
    const c = mixc(hex(0x3f8a44), hex(0x7cba52), r(30 + i));
    const pts = [[0, 0], [L * 0.5, 3], [L, -5]];
    for (let s = 0; s < 2; s++) {
      const p0 = pts[s]!, p1 = pts[s + 1]!;
      const w0 = s === 0 ? 1 : 3, w1 = s === 0 ? 3 : 0.3;
      const P0 = (side: number, w: number, p: number[]) => [x + Math.cos(ang) * p[0]! - Math.sin(ang) * side * w, y + p[1]!, Math.sin(ang) * p[0]! + Math.cos(ang) * side * w];
      g.tri(P0(-1, w0, p0), P0(1, w0, p0), P0(1, w1, p1), { col: c, mat: MAT.Foliage, wind: 1 });
      g.tri(P0(-1, w0, p0), P0(1, w1, p1), P0(-1, w1, p1), { col: c, mat: MAT.Foliage, wind: 1 });
      g.tri(P0(1, w1, p1), P0(1, w0, p0), P0(-1, w0, p0), { col: shade(c, 0.75), mat: MAT.Foliage, wind: 1 });
      g.tri(P0(-1, w1, p1), P0(1, w1, p1), P0(-1, w0, p0), { col: shade(c, 0.75), mat: MAT.Foliage, wind: 1 });
    }
  }
  return g;
}

function tallGrass(seed: number, dry: boolean): Geo {
  const g = new Geo();
  const r = rng(seed);
  const n = 6 + Math.floor(r(1) * 6);
  for (let i = 0; i < n; i++) {
    const x = (r(10 + i) - 0.5) * 12, z = (r(20 + i) - 0.5) * 9, h = 6 + r(30 + i) * 6;
    const c = dry ? mixc(hex(0xb8b06a), hex(0xd8cc84), r(40 + i)) : mixc(hex(0x5f9e44), hex(0x9cc95c), r(40 + i));
    const yaw = r(50 + i) * 6.28, tilt = (r(60 + i) - 0.5) * 0.6;
    const m = compose(x, 0, z, yaw, 0, tilt);
    const a = [m[12]! - m[0]! * 1.2, 0, m[14]! - m[2]! * 1.2], b = [m[12]! + m[0]! * 1.2, 0, m[14]! + m[2]! * 1.2];
    const t = [m[12]! + m[4]! * h, m[13]! + m[5]! * h, m[14]! + m[6]! * h];
    g.tri(a, t, b, { col: c, mat: MAT.Grass, wind: 1 });
    g.tri(b, t, a, { col: c, mat: MAT.Grass, wind: 1 });
  }
  return g;
}

function shell(seed: number): Geo {
  const g = new Geo();
  const r = rng(seed);
  g.blob(compose(0, 0.6, 0, r(1) * 6, 0, 0, 2.2, 1, 1.8), 0, 0.1, seed, { col: r(2) > 0.5 ? hex(0xf4c8c0) : hex(0xf6efe2), mat: MAT.Prop });
  return g;
}

export const VARIANTS = 6;
const cache = new Map<string, Geo>();

/** One cached variant of a prop kind. `alt` selects a biome flavour (e.g. snow on pines, dry grass on beaches). */
export function propGeo(kind: number, variant: number, alt = 0): Geo | undefined {
  const key = `${kind}:${variant}:${alt}`;
  let g = cache.get(key);
  if (g) return g;
  const seed = kind * 7919 + variant * 104729 + alt * 31;
  switch (kind) {
    case P.Oak: g = oak(seed, alt === 1 ? [hex(0x55a04a), hex(0x7cbf55), hex(0xa8d868)] : OAK_LEAF); break;
    case P.Pine: g = pine(seed, alt === 1); break;
    case P.Birch: g = birch(seed); break;
    case P.Bush: g = bush(seed, variant % 3 === 0); break;
    case P.Flowers: g = flowers(seed); break;
    case P.Rock: g = rock(seed, false); break;
    case P.Boulder: g = rock(seed, true); break;
    case P.Fern: g = fern(seed); break;
    case P.Mushroom: g = mushroom(seed); break;
    case P.Reeds: g = reeds(seed); break;
    case P.Lily: g = lily(seed); break;
    case P.Log: g = log(seed, false); break;
    case P.Stump: g = stump(seed); break;
    case P.Palm: g = palm(seed); break;
    case P.Driftwood: g = log(seed, true); break;
    case P.TallGrass: g = tallGrass(seed, alt === 1); break;
    case P.Shell: g = shell(seed); break;
    default: return undefined;
  }
  cache.set(key, g);
  return g;
}
