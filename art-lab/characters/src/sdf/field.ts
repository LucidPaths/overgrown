// Evaluating a Model: the distance alone (fast, for meshing) or the distance plus blended material and skin
// weights (once per vertex). Layers combine with a hard min, so a hem or a plate edge is a real step.
import { Kind, Op, primDist as primDist0, type Model, type Prim } from "./model";

export interface Attrs {
  mats: Float32Array;
  bones: Float32Array;
  /** which layer won (0 = body) */
  layer: number;
}

function primDist(pr: Prim, x: number, y: number, z: number): number {
  return pr.kind === Kind.Group ? groupDist(pr.sub!, x, y, z) : primDist0(pr, x, y, z);
}

/** A group's own chain (distance only). */
function groupDist(prims: Prim[], x: number, y: number, z: number): number {
  let d = 1e9;
  let first = true;
  for (const pr of prims) {
    const e = primDist(pr, x, y, z);
    if (first) { d = e; first = false; continue; }
    const k = Math.max(pr.k, 1e-4);
    if (pr.op === Op.Union) d = smin(d, e, pr.k);
    else if (pr.op === Op.Subtract) { const h = clamp01(0.5 - (0.5 * (-e - d)) / k); d = -e * (1 - h) + d * h + k * h * (1 - h); }
    else if (pr.op === Op.Intersect) { const h = clamp01(0.5 - (0.5 * (e - d)) / k); d = e * (1 - h) + d * h + k * h * (1 - h); }
  }
  return d;
}

interface LayerPlan {
  prims: Prim[];
  /** the shell's hem-defining masks (its first hemPrims prims) */
  hem: Prim[];
  shell: Model["shells"][number];
}

/** Grid cell size (px) of the prim-culling grid, and how far beyond a prim's bound it still counts. */
const CELL = 2;
const MARGIN = 5;

export class Field {
  private plans: LayerPlan[];
  private tmpA: Attrs;
  private tmpB: Attrs;
  /** smooth radius used where layers meet (0 = a crisp step) */
  layerK = 0.25;

  constructor(readonly model: Model) {
    this.plans = model.shells.map((shell, i) => {
      const prims = model.prims.filter((p) => p.layer === i);
      return { prims, hem: shell && shell.hemPrims > 0 ? prims.slice(0, shell.hemPrims) : prims, shell };
    });
    this.cur = this.plans;
    // culling grid over the model's bounds: each cell keeps only the prims that can matter within MARGIN of it
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of model.prims) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a]!, p.bc[a]! - p.br); hi[a] = Math.max(hi[a]!, p.bc[a]! + p.br); }
    this.g0 = [lo[0]! - MARGIN, lo[1]! - MARGIN, lo[2]! - MARGIN];
    this.gn = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a]! - lo[a]! + 2 * MARGIN) / CELL))) as [number, number, number];
    this.cells = new Array(this.gn[0] * this.gn[1] * this.gn[2]);
    this.tmpA = newAttrs(model);
    this.tmpB = newAttrs(model);
  }

  /** Distance of one solid layer (or a shell's mask union). */
  private chain(prims: Prim[], x: number, y: number, z: number, at: Attrs | null): number {
    let d = 1e9;
    let first = true;
    for (let i = 0; i < prims.length; i++) {
      const pr = prims[i]!;
      // bounding-sphere cull: a primitive farther than its blend radius cannot change the result
      const bx = x - pr.bc[0], by = y - pr.bc[1], bz = z - pr.bc[2];
      const lb = Math.sqrt(bx * bx + by * by + bz * bz) - pr.br;
      if (pr.op === Op.Union) {
        if (!first && lb - d >= (at ? pr.ks : pr.k)) continue;
        const e = primDist(pr, x, y, z);
        if (first) {
          d = e;
          first = false;
          if (at) { at.mats.fill(0); at.bones.fill(0); if (pr.mat >= 0) at.mats[pr.mat] = 1; at.bones[pr.bone] = 1; }
          continue;
        }
        const k = pr.k;
        if (k > 0) {
          const h = clamp01(0.5 + (0.5 * (e - d)) / k); // h = 1: the old surface wins
          if (at) blendInto(at, pr, h, clamp01(0.5 + (0.5 * (e - d)) / pr.ks));
          d = e * (1 - h) + d * h - k * h * (1 - h);
        } else {
          if (at) blendInto(at, pr, e < d ? 0 : 1, pr.ks > 0 ? clamp01(0.5 + (0.5 * (e - d)) / pr.ks) : e < d ? 0 : 1);
          d = Math.min(d, e);
        }
      } else if (pr.op === Op.Subtract) {
        if (lb > pr.k - d) continue;
        const e = primDist(pr, x, y, z);
        const k = Math.max(pr.k, 1e-4);
        // smooth max(d, -e)
        const h = clamp01(0.5 - (0.5 * (-e - d)) / k); // h = 1: the old surface wins
        if (at && pr.mat >= 0) blendMat(at, pr.mat, h);
        d = -e * (1 - h) + d * h + k * h * (1 - h);
      } else if (pr.op === Op.Intersect) {
        const e = primDist(pr, x, y, z);
        const k = Math.max(pr.k, 1e-4);
        const h = clamp01(0.5 - (0.5 * (e - d)) / k);
        if (at && pr.mat >= 0) blendMat(at, pr.mat, h);
        d = e * (1 - h) + d * h + k * h * (1 - h);
      } else if (at && pr.op === Op.Paint) {
        if (lb > pr.k) continue;
        const e = primDist(pr, x, y, z);
        const h = pr.k > 0 ? clamp01(0.5 + (0.5 * e) / pr.k) : e < 0 ? 0 : 1;
        blendMat(at, pr.mat, h);
      }
    }
    return d;
  }

  private cur: LayerPlan[];
  private g0: [number, number, number];
  private gn: [number, number, number];
  private cells: (LayerPlan[] | undefined)[];

  /** The culled plans for the grid cell holding (x, y, z) (outside the grid: everything). */
  private plansAt(x: number, y: number, z: number): LayerPlan[] {
    const i = Math.floor((x - this.g0[0]) / CELL), j = Math.floor((y - this.g0[1]) / CELL), k = Math.floor((z - this.g0[2]) / CELL);
    const n = this.gn;
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return this.plans;
    const ci = i + n[0] * (j + n[1] * k);
    let c = this.cells[ci];
    if (!c) {
      const cx = this.g0[0] + (i + 0.5) * CELL, cy = this.g0[1] + (j + 0.5) * CELL, cz = this.g0[2] + (k + 0.5) * CELL;
      const reach = CELL * 0.87 + MARGIN;
      const keep = (p: Prim) => p.op === Op.Intersect || Math.hypot(cx - p.bc[0], cy - p.bc[1], cz - p.bc[2]) - p.br < reach;
      c = this.plans.map((pl) => {
        const prims = pl.prims.filter(keep);
        return { prims, hem: pl.hem === pl.prims ? prims : pl.hem.filter(keep), shell: pl.shell };
      });
      this.cells[ci] = c;
    }
    return c;
  }

  /** per-call memo of layer distances (dist() only): shells reuse their base layer instead of re-evaluating it */
  private memo = new Float64Array(64);
  private memoOn = false;

  private layerDist(i: number, x: number, y: number, z: number, at: Attrs | null): number {
    const plan = this.cur[i]!;
    const s = plan.shell;
    if (!s) return this.chain(plan.prims, x, y, z, at);
    // shell: the base layer grown by `thickness`, kept only inside the union of the mask prims
    const base = this.memoOn && !at ? this.memo[s.base]! : this.layerDist(s.base, x, y, z, at);
    const mask = this.chain(plan.prims, x, y, z, null);
    let t = s.thickness + (s.flare > 0 ? s.flare * Math.max(0, s.flareY - y) : 0);
    // the hem: thicker within hemW of the mask's edge
    const hm = s.hem > 0 && s.hemPrims > 0 ? this.chain(plan.hem, x, y, z, null) : mask;
    const edge = s.hem > 0 ? clamp01(1 + Math.max(hm, mask) / s.hemW) * (mask <= 0 ? 1 : 0) : 0;
    if (s.hem > 0) t += s.hem * edge * edge * (3 - 2 * edge);
    if (s.fold > 0 && y < s.foldY) {
      const a = Math.atan2(x, z);
      t += s.fold * (0.5 + 0.5 * Math.sin(a * s.folds)) * Math.min(1, (s.foldY - y) / 3);
    }
    if (at) { at.mats.fill(0); at.mats[s.hemMat >= 0 && edge > 0.5 ? s.hemMat : s.mat] = 1; }
    return Math.max(base - t, mask);
  }

  /** Signed distance of the whole character. */
  dist(x: number, y: number, z: number): number {
    const memo = this.memo;
    this.memoOn = true;
    this.cur = this.plansAt(x, y, z);
    let d = this.layerDist(0, x, y, z, null);
    memo[0] = d;
    for (let i = 1; i < this.plans.length; i++) {
      const e = this.layerDist(i, x, y, z, null);
      memo[i] = e;
      d = smin(d, e, this.layerK);
    }
    this.memoOn = false;
    return d;
  }

  /** Distance plus attributes (into `out`). */
  full(x: number, y: number, z: number, out: Attrs): number {
    this.cur = this.plansAt(x, y, z);
    let d = this.layerDist(0, x, y, z, out);
    out.layer = 0;
    for (let i = 1; i < this.plans.length; i++) {
      const tmp = this.tmpA;
      const e = this.layerDist(i, x, y, z, tmp);
      if (e < d) {
        // the shell or gear wins here; shells keep the body's skin weights (they were filled by layerDist via base)
        out.mats.set(tmp.mats);
        out.bones.set(tmp.bones);
        out.layer = i;
      }
      d = smin(d, e, this.layerK);
    }
    void this.tmpB;
    return d;
  }
}

export function newAttrs(m: Model): Attrs {
  return { mats: new Float32Array(m.mats), bones: new Float32Array(m.bones), layer: 0 };
}

function blendInto(at: Attrs, pr: Prim, hMat: number, hBone: number): void {
  if (pr.mat >= 0) blendMat(at, pr.mat, hMat);
  const b = at.bones;
  for (let i = 0; i < b.length; i++) b[i] = b[i]! * hBone;
  b[pr.bone] = b[pr.bone]! + (1 - hBone);
}

function blendMat(at: Attrs, mat: number, h: number): void {
  const m = at.mats;
  for (let i = 0; i < m.length; i++) m[i] = m[i]! * h;
  m[mat] = m[mat]! + (1 - h);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return b * (1 - h) + a * h - k * h * (1 - h);
}
