// The body plan: proportions -> joints -> skeleton -> a sculpted base body. Species (species.ts) set the
// proportions and then add their own features (heads, ears, snouts, tails, hair) with the same primitives.
import { Model, alongY, euler, type V3 } from "../sdf/model";
import { B, BONES, makeSkeleton, type Skeleton } from "../rig/skeleton";
import { M, MATS } from "./mats";

export interface Build {
  /** hip joint height (leg length), px */
  hip: number;
  /** knee height as a fraction of hip */
  knee: number;
  /** walks on its toes (fox, rabbit, bird, lizard): a long foot bone lifted off the ground */
  digi: boolean;
  /** pelvis joint to shoulder line, px */
  torso: number;
  neck: number;
  /** head ellipsoid radii (x, y, z) and its centre above the head joint, and forward of it */
  head: V3;
  headUp: number;
  headFwd: number;
  /** shoulder half width, hip joint half width */
  shoulderW: number;
  hipW: number;
  /** chest, belly and pelvis ellipsoid radii */
  chest: V3;
  belly: V3;
  pelvis: V3;
  /** upper arm, forearm, hand length */
  arm: number;
  fore: number;
  hand: number;
  /** limb radii: shoulder, elbow, wrist / hip, knee, ankle */
  armR: [number, number, number];
  legR: [number, number, number];
  /** hand mitten radii */
  handR: V3;
  footLen: number;
  footW: number;
  /** forward lean of the spine (rad): orc hunch, lizard stoop */
  lean: number;
  /** arm angle out from the body in the rest pose (rad) */
  aPose: number;
  /** tail: segment directions are built per species; overall length and root radius */
  tail: { len: number; r0: number; r1: number; up: number } | null;
}

export interface Joints {
  sk: Skeleton;
  pos: V3[];
  /** convenient named points */
  headC: V3;
  shoulderY: number;
}

export function joints(b: Build): Joints {
  const pos: V3[] = Array.from({ length: BONES }, () => [0, 0, 0] as V3);
  const dirs: (V3 | null)[] = Array.from({ length: BONES }, () => null);
  const hipY = b.hip;
  const pelvisY = hipY + 0.6;
  // spine chain, then the lean rotates everything above the pelvis forward about it
  const lean = (y: number, z = 0): V3 => {
    const dy = y - pelvisY;
    return [0, pelvisY + dy * Math.cos(b.lean) - z * Math.sin(b.lean), dy * Math.sin(b.lean) + z * Math.cos(b.lean)];
  };
  pos[B.root] = [0, 0, 0];
  pos[B.pelvis] = [0, pelvisY, 0];
  pos[B.spine] = lean(pelvisY + b.torso * 0.36);
  pos[B.chest] = lean(pelvisY + b.torso * 0.68);
  const shoulderY = pelvisY + b.torso;
  const neckTop = lean(shoulderY + b.neck);
  pos[B.head] = neckTop;
  const headC: V3 = [0, neckTop[1] + b.headUp, neckTop[2] + b.headFwd];
  // arms hang from the leaned shoulders, angled out by aPose (A pose: no fusing with the torso while sculpting)
  for (const [arm, fore, hand, side] of [[B.armL, B.foreL, B.handL, 1], [B.armR, B.foreR, B.handR, -1]] as const) {
    const s = lean(shoulderY - 0.8, -0.2);
    const sh: V3 = [side * b.shoulderW, s[1], s[2]];
    const d: V3 = [side * Math.sin(b.aPose), -Math.cos(b.aPose), 0.04];
    const el: V3 = [sh[0] + d[0] * b.arm, sh[1] + d[1] * b.arm, sh[2] + d[2] * b.arm];
    const d2: V3 = [side * Math.sin(b.aPose), -Math.cos(b.aPose), 0.16];
    const l2 = Math.hypot(...d2);
    const wr: V3 = [el[0] + (d2[0] / l2) * b.fore, el[1] + (d2[1] / l2) * b.fore, el[2] + (d2[2] / l2) * b.fore];
    pos[arm] = sh; pos[fore] = el; pos[hand] = wr;
    dirs[arm] = [-d[0], -d[1], -d[2]];
    dirs[fore] = [-d2[0], -d2[1], -d2[2]];
    dirs[hand] = [-d2[0], -d2[1], -d2[2]];
  }
  // legs
  for (const [thigh, shin, foot, toe, side] of [[B.thighL, B.shinL, B.footL, B.toeL, 1], [B.thighR, B.shinR, B.footR, B.toeR, -1]] as const) {
    const x = side * b.hipW;
    const hp: V3 = [x, hipY, 0];
    let kn: V3, an: V3, ball: V3;
    if (b.digi) {
      // knee forward, hock high and back, a long upright foot bone onto the toes
      kn = [x, hipY * b.knee, 1.1];
      an = [x, b.footLen * 0.78, -b.footLen * 0.36];
      ball = [x, 0.9, b.footLen * 0.12];
    } else {
      kn = [x, hipY * b.knee, 0.35];
      an = [x, b.legR[2] + 0.4, -0.2];
      ball = [x, 0.8, b.footLen * 0.5];
    }
    pos[thigh] = hp; pos[shin] = kn; pos[foot] = an; pos[toe] = ball;
    dirs[thigh] = sub(hp, kn);
    dirs[shin] = sub(kn, an);
    dirs[foot] = sub(an, ball);
    dirs[toe] = [0, 0, -1];
  }
  // tail root behind the pelvis; segments are placed by the species (default: straight back and a little down)
  const tz = -b.pelvis[2] * 0.85;
  const tl = b.tail ? b.tail.len / 4 : 1;
  const up = b.tail ? b.tail.up : 0;
  let tp: V3 = [0, pelvisY + 0.4, tz];
  for (let i = 0; i < 4; i++) {
    const a = -0.2 + up * (i / 3); // segment angle above horizontal
    pos[B.tail1 + i] = tp;
    dirs[B.tail1 + i] = [0, -Math.sin(a), Math.cos(a)]; // +y points back toward the root
    tp = [0, tp[1] + Math.sin(a) * tl, tp[2] - Math.cos(a) * tl];
  }
  // ears, jaw: placed by species (defaults on the head)
  pos[B.earL] = [b.head[0] * 0.8, headC[1] + b.head[1] * 0.4, headC[2]];
  pos[B.earR] = [-b.head[0] * 0.8, headC[1] + b.head[1] * 0.4, headC[2]];
  pos[B.earL2] = [pos[B.earL]![0], pos[B.earL]![1] + 2, pos[B.earL]![2]];
  pos[B.earR2] = [pos[B.earR]![0], pos[B.earR]![1] + 2, pos[B.earR]![2]];
  pos[B.jaw] = [0, headC[1] - b.head[1] * 0.2, headC[2] + b.head[2] * 0.2];
  // held items: in the palm, same frame as the hand (weapons are built along the hand's local +z)
  pos[B.weapon] = palm(pos[B.handR]!, dirs[B.handR]!, b.hand * 0.45);
  pos[B.offhand] = palm(pos[B.handL]!, dirs[B.handL]!, b.hand * 0.45);
  dirs[B.weapon] = dirs[B.handR]!;
  dirs[B.offhand] = dirs[B.handL]!;
  return { sk: makeSkeleton(pos, dirs), pos, headC, shoulderY };
}

/** Re-runs the skeleton frames after a species moved ears or tail joints. */
export function refreshSkeleton(j: Joints, dirs: Partial<Record<number, V3>>): void {
  const old = j.sk;
  const d: (V3 | null)[] = old.rot.map((r) => [r[3], r[4], r[5]] as V3);
  for (const [k, v] of Object.entries(dirs)) d[Number(k)] = v!;
  j.sk = makeSkeleton(j.pos, d);
}

function palm(wrist: V3, dirUp: V3, l: number): V3 {
  const n = Math.hypot(...dirUp);
  return [wrist[0] - (dirUp[0] / n) * l, wrist[1] - (dirUp[1] / n) * l, wrist[2] - (dirUp[2] / n) * l];
}

export function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function lerpV(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function scaleV(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/**
 * The shared base body. Shape language: a soft barrel chest with real shoulders, a pinched waist, a solid
 * pelvis; short limbs that taper toward wrists and ankles; big hands and feet (they carry the actions and
 * plant the figure). Smooth radii are chosen so limbs fuse at the joint without swelling it.
 */
export function sculptBase(b: Build, j: Joints, skinMat: number = M.skin): Model {
  const m = new Model(BONES, MATS);
  const P = j.pos;
  const s = { mat: skinMat };
  const leanRot = euler(0, -b.lean);
  // torso: pelvis (wider at the seat), waist, chest (a barrel, highest and widest at the shoulders)
  m.ellipsoid(add(P[B.pelvis]!, [0, 0.1, -0.15]), b.pelvis, { ...s, bone: B.pelvis, rot: leanRot });
  m.ellipsoid(P[B.spine]!, b.belly, { ...s, bone: B.spine, k: 1.9, ks: 3, rot: leanRot });
  m.ellipsoid(add(P[B.chest]!, [0, 0.7, 0.15]), b.chest, { ...s, bone: B.chest, k: 1.9, ks: 3, rot: leanRot });
  // the trapezius slope from neck to shoulder, so the head sits in the shoulders and does not float on a stick
  for (const side of [1, -1]) {
    const sh = P[side > 0 ? B.armL : B.armR]!;
    m.cone(add(P[B.head]!, [0, -0.9, -0.3]), [sh[0] * 0.8, sh[1] + 0.5, sh[2] - 0.2], b.head[0] * 0.3, b.armR[0] * 0.95, { ...s, bone: B.chest, k: 1.2, ks: 2.4 });
    // deltoid: a ball that caps the arm and widens the silhouette
    m.sphere([sh[0], sh[1] + 0.15, sh[2]], b.armR[0] * 1.18, { ...s, bone: side > 0 ? B.armL : B.armR, k: 1.1, ks: 2.4 });
  }
  // neck
  const nb = add(P[B.chest]!, [0, b.chest[1] * 0.6, 0]);
  m.cone(nb, add(P[B.head]!, [0, 0.8, 0]), b.head[0] * 0.34, b.head[0] * 0.3, { ...s, bone: B.head, k: 1.2, ks: 2.2 });
  // arms: the forearm swells below the elbow, then narrows into a thick wrist
  for (const [arm, fore, hand, side] of [[B.armL, B.foreL, B.handL, 1], [B.armR, B.foreR, B.handR, -1]] as const) {
    m.cone(P[arm]!, P[fore]!, b.armR[0], b.armR[1], { ...s, bone: arm, k: 0.9, ks: 2.2 });
    m.cone(P[fore]!, P[hand]!, b.armR[1], b.armR[2], { ...s, bone: fore, k: 0.6, ks: 2.0 });
    m.ellipsoid(lerpV(P[fore]!, P[hand]!, 0.32), [b.armR[1] * 1.12, b.fore * 0.32, b.armR[1] * 1.05], { ...s, bone: fore, k: 0.8, rot: alongY(sub(P[fore]!, P[hand]!)) });
    handMitten(m, b, j, hand, side, s.mat);
  }
  // legs: thigh into knee, a calf, a slim ankle, a big planted foot with a flat sole
  for (const [thigh, shin, foot, toe] of [[B.thighL, B.shinL, B.footL, B.toeL], [B.thighR, B.shinR, B.footR, B.toeR]] as const) {
    m.cone(P[thigh]!, P[shin]!, b.legR[0], b.legR[1], { ...s, bone: thigh, k: 1.3, ks: 2.6 });
    m.cone(P[shin]!, P[foot]!, b.legR[1], b.legR[2], { ...s, bone: shin, k: 0.8, ks: 2.2 });
    m.ellipsoid(lerpV(P[shin]!, P[foot]!, 0.3), [b.legR[1] * 1.12, Math.hypot(...sub(P[shin]!, P[foot]!)) * 0.3, b.legR[1] * 1.18], { ...s, bone: shin, k: 0.8, rot: alongY(sub(P[shin]!, P[foot]!)) });
    if (b.digi) {
      m.cone(P[foot]!, P[toe]!, b.legR[2], b.legR[2] * 0.9, { ...s, bone: foot, k: 0.8, ks: 1.6 });
      const t = P[toe]!;
      m.dome([t[0], 0.9, t[2] + b.footLen * 0.25], [b.footW, 1.5, b.footLen * 0.45], 0.9, { ...s, bone: toe, k: 0.7, ks: 1.4 });
    } else {
      const a = P[foot]!;
      // heel under the ankle, the ball forward: a flat-bottomed wedge
      m.dome([a[0], 1.0, b.footLen * 0.2], [b.footW, 1.6, b.footLen * 0.6], 1.0, { ...s, bone: foot, k: 0.9, ks: 1.6 });
    }
  }
  return m;
}

/** A mitten hand: palm and fingers as one soft pad, a thumb toward the front. */
export function handMitten(m: Model, b: Build, j: Joints, hand: number, side: number, mat: number): void {
  const w = j.pos[hand]!;
  const dU = j.sk.rot[hand]!; // row-major: rows x, y, z axes
  const ydir: V3 = [dU[3], dU[4], dU[5]]; // points back up the arm
  const zdir: V3 = [dU[6], dU[7], dU[8]];
  const c = add(w, scaleV(ydir, -b.hand * 0.5));
  m.ellipsoid(c, b.handR, { mat, bone: hand, k: 0.6, ks: 1.4, rot: alongY(ydir, zdir) });
  // knuckles: a ridge across the front of the fist
  m.ellipsoid(add(c, add(scaleV(ydir, -b.handR[1] * 0.35), scaleV(zdir, b.handR[2] * 0.3))), [b.handR[0] * 0.92, b.handR[1] * 0.55, b.handR[2] * 0.85], { mat, bone: hand, k: 0.4, rot: alongY(ydir, zdir) });
  const th = add(add(w, scaleV(ydir, -b.hand * 0.3)), scaleV(zdir, b.handR[2] * 0.85));
  m.cone(th, add(th, add(scaleV(ydir, -b.hand * 0.42), scaleV(zdir, 0.35))), b.handR[2] * 0.52, b.handR[2] * 0.42, { mat, bone: hand, k: 0.35, ks: 1.2 });
  void side;
}

