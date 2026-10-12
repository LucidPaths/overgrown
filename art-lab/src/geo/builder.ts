// Low-poly geometry builder: flat-shaded primitives with per-vertex colour, material id, wind weight and bone.
// Every prop and every character is made from these few shapes, so they share one look.
import { compose, type Mat4 } from "../gl/math";
import { hash01 } from "../world/ground";

export type RGB = [number, number, number];

/** Material ids, read by the outline pass. Keep in sync with POST_FS. */
export const MAT = { Terrain: 0, Grass: 1, Prop: 2, Actor: 3, Water: 4, Foliage: 5, Fx: 6 } as const;

export function hex(h: number): RGB {
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}
export function shade(c: RGB, k: number, warm = 0): RGB {
  return [c[0] * k + warm * 12, c[1] * k + warm * 4, c[2] * k - warm * 6];
}
export function mixc(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export interface Style {
  col: RGB;
  mat?: number;
  /** 0..1, how much wind moves these vertices (scaled by height above the prop base in the shader). */
  wind?: number;
  bone?: number;
}

export class Geo {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  aux: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  tri(a: number[], b: number[], c: number[], s: Style): void {
    const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0]!, p[1]!, p[2]!);
      this.nrm.push(nx, ny, nz);
      this.col.push(clamp255(s.col[0]), clamp255(s.col[1]), clamp255(s.col[2]), s.mat ?? MAT.Prop);
      this.aux.push(Math.round((s.wind ?? 0) * 255), s.bone ?? 0, 0, 0);
    }
  }

  /** Appends `g` transformed by `m` (normals by the upper 3x3, renormalised), optionally tinting colours. */
  append(g: Geo, m: Mat4, tint?: (c: RGB, i: number) => RGB): void {
    const n = g.vertexCount;
    for (let i = 0; i < n; i++) {
      const x = g.pos[i * 3]!, y = g.pos[i * 3 + 1]!, z = g.pos[i * 3 + 2]!;
      this.pos.push(m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
      const a = g.nrm[i * 3]!, b = g.nrm[i * 3 + 1]!, c = g.nrm[i * 3 + 2]!;
      let nx = m[0]! * a + m[4]! * b + m[8]! * c, ny = m[1]! * a + m[5]! * b + m[9]! * c, nz = m[2]! * a + m[6]! * b + m[10]! * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.nrm.push(nx, ny, nz);
      if (tint) {
        const t = tint([g.col[i * 4]!, g.col[i * 4 + 1]!, g.col[i * 4 + 2]!], i);
        this.col.push(clamp255(t[0]), clamp255(t[1]), clamp255(t[2]), g.col[i * 4 + 3]!);
      } else this.col.push(g.col[i * 4]!, g.col[i * 4 + 1]!, g.col[i * 4 + 2]!, g.col[i * 4 + 3]!);
      this.aux.push(g.aux[i * 4]!, g.aux[i * 4 + 1]!, g.aux[i * 4 + 2]!, g.aux[i * 4 + 3]!);
    }
  }

  /** Box centred on x/z, from y0 to y0+h, transformed by m. */
  box(m: Mat4, w: number, h: number, d: number, s: Style | ((face: number) => Style), y0 = 0): void {
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y1 = y0 + h;
    const P = (x: number, y: number, z: number) => tf(m, x, y, z);
    const v = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
    const faces = [
      [4, 7, 6, 5], // top
      [3, 2, 6, 7], // front (+z)
      [1, 0, 4, 5], // back
      [0, 3, 7, 4], // left
      [2, 1, 5, 6], // right
      [0, 1, 2, 3], // bottom
    ];
    faces.forEach((f, i) => {
      const st = typeof s === "function" ? s(i) : s;
      this.tri(v[f[0]!]!, v[f[1]!]!, v[f[2]!]!, st);
      this.tri(v[f[0]!]!, v[f[2]!]!, v[f[3]!]!, st);
    });
  }

  /** Tapered prism along +y: `sides` sides, radius r0 at the bottom, r1 at the top. */
  cylinder(m: Mat4, sides: number, r0: number, r1: number, h: number, s: Style | ((i: number, top: boolean) => Style), caps = true, phase = 0): void {
    const ring = (r: number, y: number) =>
      Array.from({ length: sides }, (_, i) => {
        const a = ((i + phase) / sides) * Math.PI * 2;
        return tf(m, Math.cos(a) * r, y, Math.sin(a) * r);
      });
    const lo = ring(r0, 0), hi = ring(r1, h);
    const st = (i: number, top: boolean) => (typeof s === "function" ? s(i, top) : s);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.tri(lo[i]!, hi[i]!, hi[j]!, st(i, false));
      this.tri(lo[i]!, hi[j]!, lo[j]!, st(i, false));
    }
    if (caps) {
      const ct = tf(m, 0, h, 0), cb = tf(m, 0, 0, 0);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        if (r1 > 0) this.tri(ct, hi[j]!, hi[i]!, st(i, true));
        if (r0 > 0) this.tri(cb, lo[i]!, lo[j]!, st(i, false));
      }
    }
  }

  /** Icosphere (subdivision 0 or 1), radius 1 scaled by m, with seeded radial lumps. */
  blob(m: Mat4, sub: 0 | 1, lump: number, seed: number, s: Style | ((n: number[], p: number[]) => Style), radial = false): void {
    const { verts, faces } = ICO[sub];
    const pts = verts.map((v, i) => {
      const k = 1 + (hash01(seed, i) - 0.5) * 2 * lump;
      return [v[0]! * k, v[1]! * k, v[2]! * k];
    });
    const world = pts.map((p) => tf(m, p[0]!, p[1]!, p[2]!));
    for (const f of faces) {
      const a = world[f[0]!]!, b = world[f[1]!]!, c = world[f[2]!]!;
      if (typeof s === "function") {
        const cn = [(verts[f[0]!]![0]! + verts[f[1]!]![0]! + verts[f[2]!]![0]!) / 3, (verts[f[0]!]![1]! + verts[f[1]!]![1]! + verts[f[2]!]![1]!) / 3, (verts[f[0]!]![2]! + verts[f[1]!]![2]! + verts[f[2]!]![2]!) / 3];
        const cp = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
        this.tri(a, b, c, s(cn, cp));
      } else this.tri(a, b, c, s);
      if (radial) {
        // smooth "ball" normals: the clump shades like one soft form, not a pile of facets
        const base = this.nrm.length - 9;
        for (let k = 0; k < 3; k++) {
          const v = verts[f[k]!]!;
          const nx = m[0]! * v[0]! + m[4]! * v[1]! + m[8]! * v[2]!, ny = m[1]! * v[0]! + m[5]! * v[1]! + m[9]! * v[2]!, nz = m[2]! * v[0]! + m[6]! * v[1]! + m[10]! * v[2]!;
          const l = Math.hypot(nx, ny, nz) || 1;
          this.nrm[base + k * 3] = nx / l; this.nrm[base + k * 3 + 1] = ny / l; this.nrm[base + k * 3 + 2] = nz / l;
        }
      }
    }
  }

  /** Cone/pyramid with `sides` sides along +y. */
  cone(m: Mat4, sides: number, r: number, h: number, s: Style, phase = 0): void {
    this.cylinder(m, sides, r, 0, h, s, true, phase);
  }
}

export function tf(m: Mat4, x: number, y: number, z: number): number[] {
  return [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!];
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export const T = compose;

// --- icosphere tables ---
function icosahedron(): { verts: number[][]; faces: number[][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => { const l = Math.hypot(v[0]!, v[1]!, v[2]!); return [v[0]! / l, v[1]! / l, v[2]! / l]; });
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts, faces };
}
function subdivide(g: { verts: number[][]; faces: number[][] }): { verts: number[][]; faces: number[][] } {
  const verts = g.verts.map((v) => [...v]);
  const cache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    let i = cache.get(k);
    if (i === undefined) {
      const p = [(verts[a]![0]! + verts[b]![0]!) / 2, (verts[a]![1]! + verts[b]![1]!) / 2, (verts[a]![2]! + verts[b]![2]!) / 2];
      const l = Math.hypot(p[0]!, p[1]!, p[2]!);
      i = verts.push([p[0]! / l, p[1]! / l, p[2]! / l]) - 1;
      cache.set(k, i);
    }
    return i;
  };
  const faces: number[][] = [];
  for (const [a, b, c] of g.faces) {
    const ab = mid(a!, b!), bc = mid(b!, c!), ca = mid(c!, a!);
    faces.push([a!, ab, ca], [b!, bc, ab], [c!, ca, bc], [ab, bc, ca]);
  }
  return { verts, faces };
}
const ICO0 = icosahedron();
const ICO: Record<0 | 1, { verts: number[][]; faces: number[][] }> = { 0: ICO0, 1: subdivide(ICO0) };
