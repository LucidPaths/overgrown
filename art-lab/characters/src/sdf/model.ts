// Characters are sculpted, not assembled: a body is a list of signed-distance primitives blended with a smooth
// minimum, then meshed once (mesher.ts). The same blend that fuses a shoulder into a chest also blends the
// material and the skin weights, so joints bend softly and colour seams fall where the shapes meet.
//
// Units are world px. Rest pose: feet at y = 0, facing +z, the character's left is +x.

export type V3 = [number, number, number];
/** Row-major 3x3 rotation: local axes as rows (x, y, z), so local = R * (p - c). */
export type M3 = [number, number, number, number, number, number, number, number, number];

export const IDENT: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const Kind = {
  Ellipsoid: 0,
  RoundCone: 1,
  RoundBox: 2,
  Torus: 3,
  /** a flat-bottomed ellipsoid cap: ellipsoid intersected with a plane (local y > -cut) */
  Disc: 4,
  /** a nested chain of prims (its own unions, carves and intersections), blended in as one shape */
  Group: 5,
} as const;
export type KindV = (typeof Kind)[keyof typeof Kind];

export const Op = {
  Union: 0,
  Subtract: 1,
  Intersect: 2,
  /** paint only: changes the material inside the shape (within k), never the distance */
  Paint: 3,
} as const;
export type OpV = (typeof Op)[keyof typeof Op];

export interface Prim {
  kind: KindV;
  op: OpV;
  /** centre (or start point a for round cones) */
  c: V3;
  rot: M3;
  /** ellipsoid radii / box half size / torus (R, r, -) / round cone (b - a in local space, r1, r2 stored in p) */
  r: V3;
  /** extra params: round cone [bx, by, bz, r1, r2, len]; box [round]; disc [cut] */
  p: number[];
  /** smooth radius of the blend with everything before it */
  k: number;
  /** blend radius for skin weights (>= k): soft joints without soft shapes */
  ks: number;
  bone: number;
  /** material id, or -1 to keep the material underneath (carves) */
  mat: number;
  /** bounding sphere for culling: centre + radius */
  bc: V3;
  br: number;
  /** layer index: shells (clothes) evaluate against their base layer */
  layer: number;
  /** Group: the nested prims */
  sub?: Prim[];
}

export interface Shell {
  /** the layer this shell wraps (its own prims are masks: the shell exists inside their union) */
  base: number;
  thickness: number;
  mat: number;
  /** extra thickness: added as `flare * max(0, flareY - y)` (skirts and coat tails widen toward the hem) */
  flare: number;
  flareY: number;
  /** a raised lip along the shell's edge (a hem, a cuff): extra thickness fading over `hemW` px inside the mask */
  hem: number;
  hemW: number;
  /** material of the hem band (-1 = same as the shell): trim */
  hemMat: number;
  /** how many of the shell's first mask prims define where the hem runs (0 = all of them) */
  hemPrims: number;
  /** vertical folds: amplitude (px) and count around the body's y axis, below foldY */
  fold: number;
  folds: number;
  foldY: number;
}

export interface PrimOpts {
  bone: number;
  mat: number;
  k?: number;
  ks?: number;
  op?: OpV;
  rot?: M3;
}

export class Model {
  readonly prims: Prim[] = [];
  /** layer 0 is the body; every shell adds a layer */
  readonly shells: (Shell | null)[] = [null];
  private layer = 0;

  constructor(readonly bones: number, readonly mats: number) {}

  /** Starts a shell layer around `base` (default: the body). Following prims are its masks (unioned). */
  beginShell(s: Partial<Shell> & { thickness: number; mat: number }): number {
    this.shells.push({
      base: s.base ?? 0, thickness: s.thickness, mat: s.mat, flare: s.flare ?? 0, flareY: s.flareY ?? 0,
      hem: s.hem ?? 0, hemW: s.hemW ?? 0.8, hemMat: s.hemMat ?? -1, hemPrims: s.hemPrims ?? 0, fold: s.fold ?? 0, folds: s.folds ?? 9, foldY: s.foldY ?? 1e9,
    });
    this.layer = this.shells.length - 1;
    return this.layer;
  }

  /** Starts a solid layer (hair, armour plates, a belt): its own prims, joined to the rest with a hard min. */
  beginSolid(): number {
    this.shells.push(null);
    this.layer = this.shells.length - 1;
    return this.layer;
  }

  /** Back to adding prims to layer `l` (0 = body). */
  useLayer(l: number): void {
    this.layer = l;
  }

  private push(kind: KindV, c: V3, rot: M3, r: V3, p: number[], o: PrimOpts, br: number, bc: V3 = c): Prim {
    const k = o.k ?? 0;
    const prim: Prim = {
      kind, op: o.op ?? Op.Union, c, rot, r, p, k, ks: Math.max(o.ks ?? k, k), bone: o.bone, mat: o.mat,
      bc, br: br + k, layer: this.layer,
    };
    this.prims.push(prim);
    return prim;
  }

  ellipsoid(c: V3, r: V3, o: PrimOpts): Prim {
    return this.push(Kind.Ellipsoid, c, o.rot ?? IDENT, r, [], o, Math.max(r[0], r[1], r[2]));
  }

  sphere(c: V3, r: number, o: PrimOpts): Prim {
    return this.ellipsoid(c, [r, r, r], o);
  }

  /** A tapered capsule from a (radius r1) to b (radius r2). */
  cone(a: V3, b: V3, r1: number, r2: number, o: PrimOpts): Prim {
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    const bc: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return this.push(Kind.RoundCone, a, IDENT, [0, 0, 0], [d[0], d[1], d[2], r1, r2, len], o, len / 2 + Math.max(r1, r2), bc);
  }

  box(c: V3, half: V3, round: number, o: PrimOpts): Prim {
    return this.push(Kind.RoundBox, c, o.rot ?? IDENT, half, [round], o, Math.hypot(half[0], half[1], half[2]) + round);
  }

  /** Torus in the local xz plane (ring radius R, tube radius r). */
  torus(c: V3, R: number, r: number, o: PrimOpts): Prim {
    return this.push(Kind.Torus, c, o.rot ?? IDENT, [R, r, 0], [], o, R + r);
  }

  /**
   * A compound shape: `build` adds prims to a scratch model (their bone/mat are ignored); they are evaluated as
   * their own chain and blended in as one primitive with this bone and material. Ears, horns, beaks, blades.
   */
  group(build: (g: Model) => void, o: PrimOpts): Prim {
    const g = new Model(this.bones, this.mats);
    build(g);
    let lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
    for (const p of g.prims) {
      if (p.op !== Op.Union) continue;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i]!, p.bc[i]! - p.br); hi[i] = Math.max(hi[i]!, p.bc[i]! + p.br); }
    }
    const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const r = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
    const p = this.push(Kind.Group, c, IDENT, [0, 0, 0], [], o, r);
    p.sub = g.prims;
    return p;
  }

  /** Ellipsoid cut flat below local y = -cut (a dome, a cap, a hood brim). */
  dome(c: V3, r: V3, cut: number, o: PrimOpts): Prim {
    return this.push(Kind.Disc, c, o.rot ?? IDENT, r, [cut], o, Math.max(r[0], r[1], r[2]));
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Distance functions. All take a point already in the primitive's local frame where noted.

function sdEllipsoid(x: number, y: number, z: number, r: V3): number {
  // iq's bound: exact on the surface, a good-enough distance near it
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

function sdRoundCone(px: number, py: number, pz: number, p: number[]): number {
  // p relative to a; b - a = (bx, by, bz); radii r1 (at a), r2 (at b). iq's exact round cone.
  const bx = p[0]!, by = p[1]!, bz = p[2]!, r1 = p[3]!, r2 = p[4]!;
  const l2 = bx * bx + by * by + bz * bz;
  if (l2 < 1e-9) return Math.hypot(px, py, pz) - Math.max(r1, r2);
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const y = px * bx + py * by + pz * bz;
  const z = y - l2;
  const qx = px * l2 - bx * y, qy = py * l2 - by * y, qz = pz * l2 - bz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

function sdRoundBox(x: number, y: number, z: number, h: V3, round: number): number {
  const qx = Math.abs(x) - h[0] + round, qy = Math.abs(y) - h[1] + round, qz = Math.abs(z) - h[2] + round;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - round;
}

function sdTorus(x: number, y: number, z: number, R: number, r: number): number {
  const q = Math.hypot(x, z) - R;
  return Math.hypot(q, y) - r;
}

/** Signed distance of one primitive at world-rest point (x, y, z). */
export function primDist(pr: Prim, x: number, y: number, z: number): number {
  const dx = x - pr.c[0], dy = y - pr.c[1], dz = z - pr.c[2];
  if (pr.kind === Kind.RoundCone) return sdRoundCone(dx, dy, dz, pr.p);
  const R = pr.rot;
  const lx = R[0] * dx + R[1] * dy + R[2] * dz;
  const ly = R[3] * dx + R[4] * dy + R[5] * dz;
  const lz = R[6] * dx + R[7] * dy + R[8] * dz;
  switch (pr.kind) {
    case Kind.Ellipsoid:
      return sdEllipsoid(lx, ly, lz, pr.r);
    case Kind.RoundBox:
      return sdRoundBox(lx, ly, lz, pr.r, pr.p[0]!);
    case Kind.Torus:
      return sdTorus(lx, ly, lz, pr.r[0], pr.r[1]);
    case Kind.Disc:
      return Math.max(sdEllipsoid(lx, ly, lz, pr.r), -ly - pr.p[0]!);
  }
  return 1e9;
}

// ---------------------------------------------------------------------------------------------------------------
// Rotation helpers (row-major local axes).

/** Rotation whose local axes are the world axes turned by yaw (about y), then pitch (about x), then roll (about z). */
export function euler(yaw: number, pitch = 0, roll = 0): M3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // world-from-local W = Ry * Rx * Rz; we store local-from-world = W^T
  const w00 = cy * cr + sy * sp * sr, w01 = -cy * sr + sy * sp * cr, w02 = sy * cp;
  const w10 = cp * sr, w11 = cp * cr, w12 = -sp;
  const w20 = -sy * cr + cy * sp * sr, w21 = sy * sr + cy * sp * cr, w22 = cy * cp;
  return [w00, w10, w20, w01, w11, w21, w02, w12, w22];
}

/** Rotation whose local +y points along `dir` (a limb, a horn, an ear), with local +z kept as close to `fwd` as possible. */
export function alongY(dir: V3, fwd: V3 = [0, 0, 1]): M3 {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const y: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  // x = normalize(y cross fwd) (fall back if parallel), z = x cross y
  let x: V3 = [y[1] * fwd[2] - y[2] * fwd[1], y[2] * fwd[0] - y[0] * fwd[2], y[0] * fwd[1] - y[1] * fwd[0]];
  let xl = Math.hypot(x[0], x[1], x[2]);
  if (xl < 1e-6) { x = [1, 0, 0]; xl = 1; }
  x = [x[0] / xl, x[1] / xl, x[2] / xl];
  const z: V3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  // we want +x to be the character's left when y is up and z forward: y cross fwd = up x fwd = (+1,0,0)? up(0,1,0) x fwd(0,0,1) = (1,0,0). ok.
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}
