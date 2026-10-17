// Two-bone leg IK in character space. The thigh and shin are solved so the ankle reaches a target, with the knee
// bending toward a pole (forward for every species: digitigrade legs bend their "knee" forward too, the long
// foot bone takes the backward angle). The foot and toe get world rotations so soles sit on the ground.
import { m3mul, m3T, type Posed } from "../rig/pose";
import { B, PARENT, type Skeleton } from "../rig/skeleton";
import type { V3 } from "../sdf/model";

type M = number[] | Float32Array;

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Column-major frame whose columns are (x, y, z). */
function frame(x: V3, y: V3, z: V3): number[] {
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}

/**
 * Rotation R (world) for a bone so that its rest child direction `restDir` (in the bone's local frame) points
 * along `dir`, twisting so the local `restPole` lands as close as possible to `pole`.
 */
export function aimRot(restDir: V3, restPole: V3, dir: V3, pole: V3): number[] {
  // rest basis in local space: a = restDir, b = pole orthogonalised, c = a x b
  const a0 = norm(restDir);
  const b0 = norm(sub(restPole, scale(a0, dot(restPole, a0))));
  const c0 = cross(a0, b0);
  const a1 = norm(dir);
  let b1 = sub(pole, scale(a1, dot(pole, a1)));
  if (Math.hypot(...b1) < 1e-5) b1 = [0, 0, 1];
  b1 = norm(b1);
  const c1 = cross(a1, b1);
  // R maps (a0, b0, c0) -> (a1, b1, c1): R = F1 * F0^T
  return m3mul(frame(a1, b1, c1), m3T(frame(a0, b0, c0)), new Array(9)) as number[];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/**
 * Solves one leg. `ankle` is the target for the foot joint (character space), `kneeDir` the pole (unit, character
 * space), `footRot` and `toeRot` the desired world rotations of the foot and toe bones (column-major), or null to
 * keep their FK result. Writes R/P for thigh, shin, foot, toe and sets their `fixed` flags; call fk(..., thigh)
 * afterwards is NOT needed: positions are written here.
 */
export function solveLeg(sk: Skeleton, ps: Posed, side: 0 | 1, ankle: V3, kneeDir: V3, footRot: M | null, toeRot: M | null): void {
  const thigh = side === 0 ? B.thighL : B.thighR;
  const shin = thigh + 1, foot = thigh + 2, toe = thigh + 3;
  const hip: V3 = [ps.P[thigh * 3]!, ps.P[thigh * 3 + 1]!, ps.P[thigh * 3 + 2]!];
  const L1 = sk.len[thigh]!, L2 = sk.len[shin]!;
  let d = sub(ankle, hip);
  let dl = Math.hypot(...d);
  const maxL = (L1 + L2) * 0.999;
  if (dl > maxL) { d = scale(d, maxL / dl); dl = maxL; }
  if (dl < Math.abs(L1 - L2) + 0.01) { d = scale(norm(d), Math.abs(L1 - L2) + 0.01); dl = Math.abs(L1 - L2) + 0.01; }
  const dn = norm(d);
  // knee position: in the plane of (d, pole)
  const cosA = (L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let pole = sub(kneeDir, scale(dn, dot(kneeDir, dn)));
  if (Math.hypot(...pole) < 1e-5) pole = [0, 0, 1];
  pole = norm(pole);
  const knee: V3 = [hip[0] + (dn[0] * cosA + pole[0] * sinA) * L1, hip[1] + (dn[1] * cosA + pole[1] * sinA) * L1, hip[2] + (dn[2] * cosA + pole[2] * sinA) * L1];
  // rest directions of the thigh and shin in their own frames (to the child joint)
  const thighChild = sk.localPos[shin]!, shinChild = sk.localPos[foot]!;
  // the pole in each bone's local frame: local +z (forward) for both
  const Rt = aimRot(thighChild, [0, 0, 1], sub(knee, hip), pole);
  const ankleP: V3 = [hip[0] + d[0], hip[1] + d[1], hip[2] + d[2]];
  const Rs = aimRot(shinChild, [0, 0, 1], sub(ankleP, knee), pole);
  // R is the bone's world-from-local rotation: it maps the local child direction onto the solved one
  setR(ps, thigh, Rt);
  setP(ps, shin, knee);
  setR(ps, shin, Rs);
  setP(ps, foot, ankleP);
  if (footRot) setR(ps, foot, footRot as number[]);
  else {
    // keep the rest relation to the shin
    const lr = sk.localRot[foot]!;
    setR(ps, foot, m3mul(ps.R.subarray(shin * 9, shin * 9 + 9), lr, new Array(9)) as number[]);
  }
  // toe joint follows the foot
  const FR = ps.R.subarray(foot * 9, foot * 9 + 9);
  const lp = sk.localPos[toe]!;
  setP(ps, toe, [ankleP[0] + FR[0]! * lp[0] + FR[3]! * lp[1] + FR[6]! * lp[2], ankleP[1] + FR[1]! * lp[0] + FR[4]! * lp[1] + FR[7]! * lp[2], ankleP[2] + FR[2]! * lp[0] + FR[5]! * lp[1] + FR[8]! * lp[2]]);
  if (toeRot) setR(ps, toe, toeRot as number[]);
  else setR(ps, toe, m3mul(FR, sk.localRot[toe]!, new Array(9)) as number[]);
  ps.fixed[thigh] = ps.fixed[shin] = ps.fixed[foot] = ps.fixed[toe] = 1;
  void PARENT;
}

/** The rest world rotation of a bone (column-major). */
export function restW(sk: Skeleton, b: number): number[] {
  const r = sk.rot[b]!;
  return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]];
}

function setR(ps: Posed, b: number, R: number[]): void {
  for (let i = 0; i < 9; i++) ps.R[b * 9 + i] = R[i]!;
}
function setP(ps: Posed, b: number, p: V3): void {
  ps.P[b * 3] = p[0]; ps.P[b * 3 + 1] = p[1]; ps.P[b * 3 + 2] = p[2];
}
