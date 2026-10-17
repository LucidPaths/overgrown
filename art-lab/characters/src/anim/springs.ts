// Secondary motion: ears and tails lag, overshoot and settle. Each spring bone is a damped pendulum driven by the
// acceleration of its joint in the world (so it reacts to the character's real motion, turns and hits, not to a
// cycle). Its deflection is added to the pose before FK on the next frame.
import { setRot, type Pose, type Posed } from "../rig/pose";
import { B, type Skeleton } from "../rig/skeleton";

interface Spring {
  bone: number;
  k: number;
  c: number;
  gain: number;
  /** +1: the bone's local +y points to its tip (ears); -1: to its root (tails) */
  dir: number;
  tx: number;
  tz: number;
  wx: number;
  wz: number;
  prev: [number, number, number] | null;
  vel: [number, number, number];
}

const SPRINGS: [number, number, number, number, number][] = [
  // bone, stiffness, damping, gain, direction
  [B.earL, 160, 10, 1, 1], [B.earL2, 140, 8, 1.2, 1], [B.earR, 160, 10, 1, 1], [B.earR2, 140, 8, 1.2, 1],
  [B.tail1, 70, 7, 0.6, -1], [B.tail2, 60, 6, 0.8, -1], [B.tail3, 55, 5.5, 1, -1], [B.tail4, 50, 5, 1.1, -1],
];

export class Springs {
  private s: Spring[];
  constructor(sk: Skeleton) {
    this.s = SPRINGS.filter(([b]) => sk.len[b]! > 0.2 || b === B.earL2 || b === B.earR2 || b === B.tail4)
      .map(([bone, k, c, gain, dir]) => ({ bone, k, c, gain, dir, tx: 0, tz: 0, wx: 0, wz: 0, prev: null, vel: [0, 0, 0] }));
  }

  /** Adds the current deflections to the pose (call before FK). */
  apply(p: Pose): void {
    for (const s of this.s) {
      const r = p.rot;
      setRot(p, s.bone, r[s.bone * 3]! + s.tx, r[s.bone * 3 + 1]!, r[s.bone * 3 + 2]! + s.tz);
    }
  }

  /** Advances the pendulums from the posed skeleton (character space) and its world placement. */
  step(_sk: Skeleton, _p: Pose, ps: Posed, place: Float32Array, dt: number): void {
    if (dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    for (const s of this.s) {
      const b = s.bone;
      // joint in world
      const x = ps.P[b * 3]!, y = ps.P[b * 3 + 1]!, z = ps.P[b * 3 + 2]!;
      const w: [number, number, number] = [place[0]! * x + place[4]! * y + place[8]! * z + place[12]!, place[1]! * x + place[5]! * y + place[9]! * z + place[13]!, place[2]! * x + place[6]! * y + place[10]! * z + place[14]!];
      if (!s.prev) { s.prev = w; continue; }
      const v: [number, number, number] = [(w[0] - s.prev[0]) / dt, (w[1] - s.prev[1]) / dt, (w[2] - s.prev[2]) / dt];
      const a: [number, number, number] = [(v[0] - s.vel[0]) / dt, (v[1] - s.vel[1]) / dt, (v[2] - s.vel[2]) / dt];
      s.prev = w; s.vel = v;
      // inertial force (opposes the joint's acceleration), expressed in the bone's local frame (world R = place * R)
      const R = ps.R.subarray(b * 9, b * 9 + 9);
      const lx = [R[0]!, R[1]!, R[2]!], lz = [R[6]!, R[7]!, R[8]!];
      const wx = [place[0]! * lx[0]! + place[4]! * lx[1]! + place[8]! * lx[2]!, place[1]! * lx[0]! + place[5]! * lx[1]! + place[9]! * lx[2]!, place[2]! * lx[0]! + place[6]! * lx[1]! + place[10]! * lx[2]!];
      const wz = [place[0]! * lz[0]! + place[4]! * lz[1]! + place[8]! * lz[2]!, place[1]! * lz[0]! + place[5]! * lz[1]! + place[9]! * lz[2]!, place[2]! * lz[0]! + place[6]! * lz[1]! + place[10]! * lz[2]!];
      const ax = -(a[0] * wx[0]! + a[1] * wx[1]! + a[2] * wx[2]!), az = -(a[0] * wz[0]! + a[1] * wz[1]! + a[2] * wz[2]!);
      // a force along local +z swings a +y-pointing bone forward: rotation about local x by -angle (pitch < 0)
      const g = (s.gain * s.dir) / 60;
      const alphaPitch = -az * g, alphaRoll = ax * g;
      s.wx += (alphaPitch - s.k * s.tx - s.c * s.wx) * dt;
      s.wz += (alphaRoll - s.k * s.tz - s.c * s.wz) * dt;
      s.tx = clamp(s.tx + s.wx * dt, -0.9, 0.9);
      s.tz = clamp(s.tz + s.wz * dt, -0.9, 0.9);
    }
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
