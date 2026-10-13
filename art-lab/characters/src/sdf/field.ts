// Evaluating a Model: the distance alone (fast, for meshing) or the distance plus blended material and skin
// weights (once per vertex). Layers combine with a hard min, so a hem or a plate edge is a real step.
import { Op, primDist, type Model, type Prim } from "./model";

export interface Attrs {
  mats: Float32Array;
  bones: Float32Array;
  /** which layer won (0 = body) */
  layer: number;
}

interface LayerPlan {
  prims: Prim[];
  shell: Model["shells"][number];
}

export class Field {
  private plans: LayerPlan[];
  private tmpA: Attrs;
  private tmpB: Attrs;
  /** smooth radius used where layers meet (0 = a crisp step) */
  layerK = 0.25;

  constructor(readonly model: Model) {
    this.plans = model.shells.map((shell, i) => ({ prims: model.prims.filter((p) => p.layer === i), shell }));
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

  private layerDist(i: number, x: number, y: number, z: number, at: Attrs | null): number {
    const plan = this.plans[i]!;
    const s = plan.shell;
    if (!s) return this.chain(plan.prims, x, y, z, at);
    // shell: the base layer grown by `thickness`, kept only inside the union of the mask prims
    const base = this.layerDist(s.base, x, y, z, at);
    const t = s.thickness + (s.flare > 0 ? s.flare * Math.max(0, s.flareY - y) : 0);
    const mask = this.chain(plan.prims, x, y, z, null);
    if (at) { at.mats.fill(0); at.mats[s.mat] = 1; }
    return Math.max(base - t, mask);
  }

  /** Signed distance of the whole character. */
  dist(x: number, y: number, z: number): number {
    let d = this.layerDist(0, x, y, z, null);
    for (let i = 1; i < this.plans.length; i++) d = smin(d, this.layerDist(i, x, y, z, null), this.layerK);
    return d;
  }

  /** Distance plus attributes (into `out`). */
  full(x: number, y: number, z: number, out: Attrs): number {
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
