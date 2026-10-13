// Surface nets over a sparse grid: coarse nodes find the blocks the surface passes through, only those get fine
// samples. One vertex per surface cell, projected onto the surface; quads split along the shorter diagonal.
import { newAttrs, type Field } from "./field";

export interface RawMesh {
  /** rest-pose positions (world px) */
  pos: Float32Array;
  nrm: Float32Array;
  /** per vertex: two strongest materials, the blend between them (0..255), ambient occlusion (0..255) */
  mat: Uint8Array;
  /** per vertex: four bone indices and their weights (0..255, summing to 255) */
  boneIdx: Uint8Array;
  boneW: Uint8Array;
  /** per vertex: winning layer (0 body, 1.. shells and gear) */
  layer: Uint8Array;
  index: Uint32Array;
  vertexCount: number;
  ms: number;
}

export interface MeshOpts {
  min: [number, number, number];
  max: [number, number, number];
  /** cell size, world px */
  h: number;
  /** gradient step for normals: larger = smoother shading (a cel shader shows every bump) */
  normalEps?: number;
  /** ambient occlusion probe distances */
  ao?: number[];
}

const B = 4; // cells per block

export function meshField(field: Field, o: MeshOpts): RawMesh {
  const t0 = performance.now();
  const h = o.h;
  const nx = Math.ceil((o.max[0] - o.min[0]) / h / B) * B + 1;
  const ny = Math.ceil((o.max[1] - o.min[1]) / h / B) * B + 1;
  const nz = Math.ceil((o.max[2] - o.min[2]) / h / B) * B + 1;
  const ox = o.min[0], oy = o.min[1], oz = o.min[2];
  const sx = 1, sy = nx, sz = nx * ny;
  const val = new Float32Array(nx * ny * nz);
  const done = new Uint8Array(nx * ny * nz);
  // 1. coarse nodes every B cells
  const cx = (nx - 1) / B + 1, cy = (ny - 1) / B + 1, cz = (nz - 1) / B + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    const d = field.dist(ox + i * B * h, oy + j * B * h, oz + k * B * h);
    coarse[i + j * cx + k * cx * cy] = d;
    const fi = i * B * sx + j * B * sy + k * B * sz;
    val[fi] = d;
    done[fi] = 1;
  }
  // 2. fine samples in blocks the surface may cross (ellipsoid distances are bounds, hence the 1.4 margin)
  const reach = B * h * Math.sqrt(3) * 1.4;
  for (let k = 0; k < cz - 1; k++) for (let j = 0; j < cy - 1; j++) for (let i = 0; i < cx - 1; i++) {
    let far = 0, sign = 0;
    for (let c = 0; c < 8; c++) {
      const d = coarse[(i + (c & 1)) + (j + ((c >> 1) & 1)) * cx + (k + (c >> 2)) * cx * cy]!;
      if (Math.abs(d) >= reach) { far = 1; sign = d; break; }
    }
    for (let kk = 0; kk <= B; kk++) for (let jj = 0; jj <= B; jj++) for (let ii = 0; ii <= B; ii++) {
      const gi = i * B + ii, gj = j * B + jj, gk = k * B + kk;
      const idx = gi + gj * sy + gk * sz;
      if (done[idx]) continue;
      if (far) { val[idx] = sign; continue; } // sign only; another block may still evaluate it for real
      val[idx] = field.dist(ox + gi * h, oy + gj * h, oz + gk * h);
      done[idx] = 1;
    }
  }
  // 3. one vertex per cell with a sign change
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cs = (i: number, j: number, k: number) => i + j * (nx - 1) + k * (nx - 1) * (ny - 1);
  const P: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = val[(i + (c & 1)) + (j + ((c >> 1) & 1)) * sy + (k + (c >> 2)) * sz]!;
      corner[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = corner[a!]!, vb = corner[b!]!;
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      const ax = a! & 1, ay = (a! >> 1) & 1, az = a! >> 2;
      const bx = b! & 1, by = (b! >> 1) & 1, bz = b! >> 2;
      px += ax + (bx - ax) * t; py += ay + (by - ay) * t; pz += az + (bz - az) * t;
      n++;
    }
    cellVert[cs(i, j, k)] = P.length / 3;
    P.push(ox + (i + px / n) * h, oy + (j + py / n) * h, oz + (k + pz / n) * h);
  }
  // 4. quads around every sample edge with a sign change
  const I: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // split along the shorter diagonal
    const d0 = dist2(P, a, c), d1 = dist2(P, b, d);
    if (d0 <= d1) I.push(a, b, c, a, c, d);
    else I.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[i + j * sy + k * sz]! < 0;
    if (i < nx - 1 && v0 !== (val[i + 1 + j * sy + k * sz]! < 0)) {
      // x edge: cells (i, j-1..j, k-1..k)
      quad(cellVert[cs(i, j - 1, k - 1)]!, cellVert[cs(i, j, k - 1)]!, cellVert[cs(i, j, k)]!, cellVert[cs(i, j - 1, k)]!, !v0);
    }
    if (j < ny - 1 && v0 !== (val[i + (j + 1) * sy + k * sz]! < 0)) {
      quad(cellVert[cs(i - 1, j, k - 1)]!, cellVert[cs(i - 1, j, k)]!, cellVert[cs(i, j, k)]!, cellVert[cs(i, j, k - 1)]!, !v0);
    }
    if (k < nz - 1 && v0 !== (val[i + j * sy + (k + 1) * sz]! < 0)) {
      quad(cellVert[cs(i - 1, j - 1, k)]!, cellVert[cs(i, j - 1, k)]!, cellVert[cs(i, j, k)]!, cellVert[cs(i - 1, j, k)]!, !v0);
    }
  }
  // 5. attributes per vertex: project onto the surface, smooth normal, materials, skin weights, occlusion
  const nv = P.length / 3;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3);
  const mat = new Uint8Array(nv * 4), boneIdx = new Uint8Array(nv * 4), boneW = new Uint8Array(nv * 4), layer = new Uint8Array(nv);
  const at = newAttrs(field.model);
  const e = o.normalEps ?? 0.6;
  const aoD = o.ao ?? [1.2, 2.6, 4.5];
  for (let v = 0; v < nv; v++) {
    let x = P[v * 3]!, y = P[v * 3 + 1]!, z = P[v * 3 + 2]!;
    for (let it = 0; it < 2; it++) {
      const d = field.dist(x, y, z);
      const g = grad(field, x, y, z, h * 0.25);
      x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    const n = grad(field, x, y, z, e);
    nrm[v * 3] = n[0]; nrm[v * 3 + 1] = n[1]; nrm[v * 3 + 2] = n[2];
    field.full(x, y, z, at);
    layer[v] = at.layer;
    // two strongest materials
    let m0 = 0, m1 = 0, w0 = -1, w1 = -1;
    for (let m = 0; m < at.mats.length; m++) {
      const w = at.mats[m]!;
      if (w > w0) { m1 = m0; w1 = w0; m0 = m; w0 = w; } else if (w > w1) { m1 = m; w1 = w; }
    }
    if (w1 <= 0) m1 = m0;
    const t = w0 + w1 > 0 ? Math.max(0, w1) / (w0 + Math.max(0, w1)) : 0;
    // occlusion: how much the field closes in along the normal
    let occ = 0, tot = 0;
    for (const s of aoD) {
      const dd = field.dist(x + n[0] * s, y + n[1] * s, z + n[2] * s);
      occ += Math.max(0, (s - dd) / s) / s;
      tot += 1 / s;
    }
    const ao = 1 - Math.min(1, (occ / tot) * 1.6);
    mat[v * 4] = m0; mat[v * 4 + 1] = m1; mat[v * 4 + 2] = Math.round(t * 255); mat[v * 4 + 3] = Math.round(ao * 255);
    // four strongest bones
    top4(at.bones, boneIdx, boneW, v * 4);
  }
  smoothAo(mat, I, nv, 3);
  return { pos, nrm, mat, boneIdx, boneW, layer, index: new Uint32Array(I), vertexCount: nv, ms: performance.now() - t0 };
}

/** Averages occlusion over mesh neighbours: a cel terminator shifted by occlusion must not inherit its noise. */
function smoothAo(mat: Uint8Array, I: number[], nv: number, iters: number): void {
  const sum = new Float32Array(nv), cnt = new Float32Array(nv);
  let ao = new Float32Array(nv);
  for (let v = 0; v < nv; v++) ao[v] = mat[v * 4 + 3]!;
  for (let it = 0; it < iters; it++) {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t]!, b = I[t + 1]!, c = I[t + 2]!;
      sum[a] = sum[a]! + ao[b]! + ao[c]!; cnt[a] = cnt[a]! + 2;
      sum[b] = sum[b]! + ao[a]! + ao[c]!; cnt[b] = cnt[b]! + 2;
      sum[c] = sum[c]! + ao[a]! + ao[b]!; cnt[c] = cnt[c]! + 2;
    }
    const n = new Float32Array(nv);
    for (let v = 0; v < nv; v++) n[v] = cnt[v]! > 0 ? (ao[v]! + sum[v]!) / (1 + cnt[v]!) : ao[v]!;
    ao = n;
  }
  for (let v = 0; v < nv; v++) mat[v * 4 + 3] = Math.round(ao[v]!);
}

function dist2(P: number[], a: number, b: number): number {
  const dx = P[a * 3]! - P[b * 3]!, dy = P[a * 3 + 1]! - P[b * 3 + 1]!, dz = P[a * 3 + 2]! - P[b * 3 + 2]!;
  return dx * dx + dy * dy + dz * dz;
}

export function grad(f: Field, x: number, y: number, z: number, e: number): [number, number, number] {
  // tetrahedral gradient: 4 evaluations
  const a = f.dist(x + e, y - e, z - e), b = f.dist(x - e, y - e, z + e), c = f.dist(x - e, y + e, z - e), d = f.dist(x + e, y + e, z + e);
  const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

function top4(w: Float32Array, idx: Uint8Array, out: Uint8Array, o: number): void {
  const bi = [0, 0, 0, 0], bw = [0, 0, 0, 0];
  for (let b = 0; b < w.length; b++) {
    const v = w[b]!;
    if (v <= bw[3]!) continue;
    let s = 3;
    while (s > 0 && v > bw[s - 1]!) { bw[s] = bw[s - 1]!; bi[s] = bi[s - 1]!; s--; }
    bw[s] = v; bi[s] = b;
  }
  const sum = bw[0]! + bw[1]! + bw[2]! + bw[3]! || 1;
  // quantise to bytes that sum to exactly 255 (largest remainder): skinning must never scale a vertex
  const q = bw.map((w) => (w / sum) * 255);
  const fl = q.map(Math.floor);
  let left = 255 - fl.reduce((a, b) => a + b, 0);
  const order = [0, 1, 2, 3].sort((a, b) => (q[b]! - fl[b]!) - (q[a]! - fl[a]!));
  for (const s of order) { if (left <= 0) break; fl[s] = fl[s]! + 1; left--; }
  for (let s = 0; s < 4; s++) { idx[o + s] = bi[s]!; out[o + s] = fl[s]!; }
}
