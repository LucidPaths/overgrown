// One skeleton for every humanoid species: 30 bones with rest frames. Species change where the joints are, never
// which joints exist, so every clip, every piece of gear and every IK rule works on every species.
//
// Bone frames: local +y runs from the child back to the joint (up a hanging limb), +z is forward, +x is the
// character's left. A limb hanging along -y swings FORWARD with negative pitch (rotation about local x), out to
// the side with roll (about local z: + for the left side, - for the right), and twists with yaw (about local y).
import { alongY, type M3, type V3 } from "../sdf/model";

export const B = {
  root: 0, pelvis: 1, spine: 2, chest: 3, head: 4,
  armL: 5, foreL: 6, handL: 7,
  armR: 8, foreR: 9, handR: 10,
  thighL: 11, shinL: 12, footL: 13, toeL: 14,
  thighR: 15, shinR: 16, footR: 17, toeR: 18,
  tail1: 19, tail2: 20, tail3: 21, tail4: 22,
  earL: 23, earL2: 24, earR: 25, earR2: 26,
  jaw: 27, weapon: 28, offhand: 29,
} as const;
export const BONES = 30;
export const PARENT: number[] = [
  -1, 0, 1, 2, 3,
  3, 5, 6,
  3, 8, 9,
  1, 11, 12, 13,
  1, 15, 16, 17,
  1, 19, 20, 21,
  4, 23, 4, 25,
  4, 10, 7,
];
export const BONE_NAMES = Object.keys(B);

export interface Skeleton {
  /** rest joint position, object space */
  pos: V3[];
  /** rest frame (row-major local axes), object space */
  rot: M3[];
  /** rest offset from the parent joint, in the parent's frame */
  localPos: V3[];
  /** rest rotation relative to the parent's frame (column-major 3x3 as a 9-array: world = parent * local) */
  localRot: number[][];
  /** bone length to its main child (for IK and stretch) */
  len: number[];
}

/** Builds rest frames from joint positions. `dirs[b]` (optional) is the direction local +y points along. */
export function makeSkeleton(pos: V3[], dirs: (V3 | null)[]): Skeleton {
  const rot: M3[] = pos.map((_, b) => {
    const d = dirs[b];
    return d ? alongY(d) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  });
  const localPos: V3[] = [], localRot: number[][] = [], len: number[] = [];
  for (let b = 0; b < BONES; b++) {
    const p = PARENT[b]!;
    if (p < 0) {
      localPos.push([...pos[b]!]);
      localRot.push(worldFromRow(rot[b]!));
    } else {
      const pr = rot[p]!;
      const d: V3 = [pos[b]![0] - pos[p]![0], pos[b]![1] - pos[p]![1], pos[b]![2] - pos[p]![2]];
      // parent-local = R_p (row-major local-from-world) * d
      localPos.push([pr[0] * d[0] + pr[1] * d[1] + pr[2] * d[2], pr[3] * d[0] + pr[4] * d[1] + pr[5] * d[2], pr[6] * d[0] + pr[7] * d[1] + pr[8] * d[2]]);
      // local = Wp^T * Wb  (W = world-from-local, column-major)
      localRot.push(mul3(transpose3(worldFromRow(pr)), worldFromRow(rot[b]!)));
    }
    len.push(0);
  }
  for (let b = 0; b < BONES; b++) {
    // main child: the first bone whose parent is b
    const c = PARENT.indexOf(b);
    if (c >= 0) len[b] = Math.hypot(pos[c]![0] - pos[b]![0], pos[c]![1] - pos[b]![1], pos[c]![2] - pos[b]![2]);
  }
  return { pos, rot, localPos, localRot, len };
}

/** Row-major local-from-world -> column-major world-from-local (3x3 as 9 numbers, column-major). */
export function worldFromRow(r: M3): number[] {
  // world-from-local W has the local axes as columns; column-major storage lists columns: x axis, y axis, z axis
  return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]];
}

/** Column-major 3x3 multiply. */
export function mul3(a: number[], b: number[]): number[] {
  const o = new Array<number>(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r]! * b[c * 3]! + a[3 + r]! * b[c * 3 + 1]! + a[6 + r]! * b[c * 3 + 2]!;
  return o;
}

export function transpose3(a: number[]): number[] {
  return [a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!];
}
