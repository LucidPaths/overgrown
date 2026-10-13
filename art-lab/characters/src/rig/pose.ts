// Poses and forward kinematics. A pose is Euler angles and a scale per bone plus a root transform. Clips write
// poses; IK and springs then override individual bones in world space; skin() turns the result into the matrices
// the vertex shader uses (world * scale * inverse rest).
import { BONES, PARENT, type Skeleton } from "./skeleton";

export interface Pose {
  /** pitch, yaw, roll per bone, in the bone's rest frame */
  rot: Float32Array;
  /** scale per bone along its local x, y, z (squash and stretch); children follow the stretched length */
  scl: Float32Array;
  /** root: offset (character space, px), rotation about a pivot height */
  off: [number, number, number];
  pitch: number;
  roll: number;
  yaw: number;
  pivotY: number;
  /** face: 0 open .. 1 closed */
  blink: number;
  /** expression id (see FACE in render/char-shaders) */
  expr: number;
  /** white hit flash 0..1 */
  flash: number;
  /** weapon swing progress for the slash trail, 0 = none */
  swing: number;
}

export function newPose(): Pose {
  const p: Pose = { rot: new Float32Array(BONES * 3), scl: new Float32Array(BONES * 3), off: [0, 0, 0], pitch: 0, roll: 0, yaw: 0, pivotY: 0, blink: 0, expr: 0, flash: 0, swing: 0 };
  p.scl.fill(1);
  return p;
}

export function clearPose(p: Pose): void {
  p.rot.fill(0);
  p.scl.fill(1);
  p.off[0] = p.off[1] = p.off[2] = 0;
  p.pitch = p.roll = p.yaw = p.pivotY = p.blink = p.expr = p.flash = p.swing = 0;
}

export function copyPose(dst: Pose, src: Pose): void {
  dst.rot.set(src.rot);
  dst.scl.set(src.scl);
  dst.off[0] = src.off[0]; dst.off[1] = src.off[1]; dst.off[2] = src.off[2];
  dst.pitch = src.pitch; dst.roll = src.roll; dst.yaw = src.yaw; dst.pivotY = src.pivotY;
  dst.blink = src.blink; dst.expr = src.expr; dst.flash = src.flash; dst.swing = src.swing;
}

/** a += (b - a) * t for every channel; discrete channels (expr, flash, swing) take b's when t > 0.5. */
export function blendPose(a: Pose, b: Pose, t: number): void {
  if (t <= 0) return;
  if (t >= 1) { copyPose(a, b); return; }
  for (let i = 0; i < a.rot.length; i++) a.rot[i] = a.rot[i]! + (b.rot[i]! - a.rot[i]!) * t;
  for (let i = 0; i < a.scl.length; i++) a.scl[i] = a.scl[i]! + (b.scl[i]! - a.scl[i]!) * t;
  for (let i = 0; i < 3; i++) a.off[i] = a.off[i]! + (b.off[i]! - a.off[i]!) * t;
  a.pitch += (b.pitch - a.pitch) * t;
  a.roll += (b.roll - a.roll) * t;
  a.yaw += (b.yaw - a.yaw) * t;
  a.pivotY += (b.pivotY - a.pivotY) * t;
  a.blink += (b.blink - a.blink) * t;
  if (t > 0.5) { a.expr = b.expr; a.swing = b.swing; }
  a.flash = Math.max(a.flash, b.flash * t);
}

export function setRot(p: Pose, b: number, pitch: number, yaw = 0, roll = 0): void {
  p.rot[b * 3] = pitch; p.rot[b * 3 + 1] = yaw; p.rot[b * 3 + 2] = roll;
}
export function addRot(p: Pose, b: number, pitch: number, yaw = 0, roll = 0): void {
  p.rot[b * 3] = p.rot[b * 3]! + pitch; p.rot[b * 3 + 1] = p.rot[b * 3 + 1]! + yaw; p.rot[b * 3 + 2] = p.rot[b * 3 + 2]! + roll;
}
export function setScl(p: Pose, b: number, x: number, y: number, z: number): void {
  p.scl[b * 3] = x; p.scl[b * 3 + 1] = y; p.scl[b * 3 + 2] = z;
}

// ---------------------------------------------------------------------------------------------------------------
// 3x3 / 4x4 helpers (column-major).

/** Column-major rotation Ry(yaw) * Rx(pitch) * Rz(roll). */
export function eulerM(pitch: number, yaw: number, roll: number, o: Float32Array | number[] = new Float32Array(9)): Float32Array | number[] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  o[0] = cy * cr + sy * sp * sr; o[1] = cp * sr; o[2] = -sy * cr + cy * sp * sr;
  o[3] = -cy * sr + sy * sp * cr; o[4] = cp * cr; o[5] = sy * sr + cy * sp * cr;
  o[6] = sy * cp; o[7] = -sp; o[8] = cy * cp;
  return o;
}

export function m3mul(a: ArrayLike<number>, b: ArrayLike<number>, o: Float32Array | number[] = new Float32Array(9)): Float32Array | number[] {
  const t = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) t[c * 3 + r] = a[r]! * b[c * 3]! + a[3 + r]! * b[c * 3 + 1]! + a[6 + r]! * b[c * 3 + 2]!;
  for (let i = 0; i < 9; i++) o[i] = t[i]!;
  return o;
}

export function m3vec(a: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  return [a[0]! * x + a[3]! * y + a[6]! * z, a[1]! * x + a[4]! * y + a[7]! * z, a[2]! * x + a[5]! * y + a[8]! * z];
}

export function m3T(a: ArrayLike<number>): number[] {
  return [a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!];
}

/** World state of one posed skeleton: rotation (3x3) and position per bone. */
export interface Posed {
  R: Float32Array; // BONES * 9
  P: Float32Array; // BONES * 3
  /** world-rotation overrides set by IK/springs before fk(): 1 = use R as given */
  fixed: Uint8Array;
}

export function newPosed(): Posed {
  return { R: new Float32Array(BONES * 9), P: new Float32Array(BONES * 3), fixed: new Uint8Array(BONES) };
}

const tmpA = new Float32Array(9), tmpB = new Float32Array(9);

/**
 * Forward kinematics in CHARACTER space (feet origin, facing +z). Bones whose `fixed` flag is set keep the world
 * rotation already in `out.R` (IK and springs write those); their positions still follow the parent.
 * `from` restricts the pass to bones >= from (bones are ordered parent-first).
 */
export function fk(sk: Skeleton, p: Pose, out: Posed, from = 0): void {
  for (let b = from; b < BONES; b++) {
    const par = PARENT[b]!;
    const lr = sk.localRot[b]!;
    if (par < 0) {
      // root: pivot rotation (pitch/roll about pivotY), yaw, offset
      eulerM(p.pitch, p.yaw, p.roll, tmpA);
      const R = out.R.subarray(0, 9);
      m3mul(tmpA, lr, R);
      const piv = p.pivotY;
      // position: off + Rot * (rest - pivot) + pivot
      const lp = sk.localPos[0]!;
      const v = m3vec(tmpA, lp[0], lp[1] - piv, lp[2]);
      out.P[0] = p.off[0] + v[0]; out.P[1] = p.off[1] + v[1] + piv; out.P[2] = p.off[2] + v[2];
      continue;
    }
    const PR = out.R.subarray(par * 9, par * 9 + 9);
    const lp = sk.localPos[b]!;
    // the parent's stretch moves this joint
    const sx = p.scl[par * 3]!, sy = p.scl[par * 3 + 1]!, sz = p.scl[par * 3 + 2]!;
    const v = m3vec(PR, lp[0] * sx, lp[1] * sy, lp[2] * sz);
    out.P[b * 3] = out.P[par * 3]! + v[0];
    out.P[b * 3 + 1] = out.P[par * 3 + 1]! + v[1];
    out.P[b * 3 + 2] = out.P[par * 3 + 2]! + v[2];
    if (out.fixed[b]) continue;
    eulerM(p.rot[b * 3]!, p.rot[b * 3 + 1]!, p.rot[b * 3 + 2]!, tmpA);
    m3mul(lr, tmpA, tmpB);
    m3mul(PR, tmpB, out.R.subarray(b * 9, b * 9 + 9));
  }
}

/**
 * Skin matrices (column-major 4x4 per bone) into `dst`: M = T(world) * Rworld * S * Rrest^T * T(-rest).
 * `world` places the character: a column-major 4x4 (feet position, facing yaw).
 */
export function skin(sk: Skeleton, p: Pose, ps: Posed, world: Float32Array, dst: Float32Array): void {
  for (let b = 0; b < BONES; b++) {
    const R = ps.R.subarray(b * 9, b * 9 + 9);
    const rr = sk.rot[b]!; // row-major local-from-world rest = (rest world-from-local)^T
    const sx = p.scl[b * 3]!, sy = p.scl[b * 3 + 1]!, sz = p.scl[b * 3 + 2]!;
    // A = R * S * restLFW   (3x3, column-major); restLFW column-major = transpose of the row-major array
    // restLFW (column-major): columns are rows of rr transposed -> element (r, c) = rr[r*3 + c]
    const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 3; c++) {
      // column c of restLFW = (rr[0*3+c], rr[1*3+c], rr[2*3+c])
      const x = rr[c]! * sx, y = rr[3 + c]! * sy, z = rr[6 + c]! * sz;
      m[c * 3] = R[0]! * x + R[3]! * y + R[6]! * z;
      m[c * 3 + 1] = R[1]! * x + R[4]! * y + R[7]! * z;
      m[c * 3 + 2] = R[2]! * x + R[5]! * y + R[8]! * z;
    }
    const rp = sk.pos[b]!;
    // translation: P - A * rest
    const tx = ps.P[b * 3]! - (m[0]! * rp[0] + m[3]! * rp[1] + m[6]! * rp[2]);
    const ty = ps.P[b * 3 + 1]! - (m[1]! * rp[0] + m[4]! * rp[1] + m[7]! * rp[2]);
    const tz = ps.P[b * 3 + 2]! - (m[2]! * rp[0] + m[5]! * rp[1] + m[8]! * rp[2]);
    // dst = world * [m | t]
    const o = b * 16;
    for (let c = 0; c < 3; c++) {
      const x = m[c * 3]!, y = m[c * 3 + 1]!, z = m[c * 3 + 2]!;
      dst[o + c * 4] = world[0]! * x + world[4]! * y + world[8]! * z;
      dst[o + c * 4 + 1] = world[1]! * x + world[5]! * y + world[9]! * z;
      dst[o + c * 4 + 2] = world[2]! * x + world[6]! * y + world[10]! * z;
      dst[o + c * 4 + 3] = 0;
    }
    dst[o + 12] = world[0]! * tx + world[4]! * ty + world[8]! * tz + world[12]!;
    dst[o + 13] = world[1]! * tx + world[5]! * ty + world[9]! * tz + world[13]!;
    dst[o + 14] = world[2]! * tx + world[6]! * ty + world[10]! * tz + world[14]!;
    dst[o + 15] = 1;
  }
}

/** Character placement: feet at (x, y, z), turned by yaw. */
export function placeM(x: number, y: number, z: number, yaw: number, s = 1, o: Float32Array = new Float32Array(16)): Float32Array {
  const c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s;
  o.fill(0);
  o[0] = c; o[2] = -sn; o[5] = s; o[8] = sn; o[10] = c; o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
  return o;
}
