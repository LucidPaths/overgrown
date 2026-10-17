// Procedural animation on the shared rig. A pose is one rotation (pitch, yaw, roll) per bone plus a root offset and
// root rotation. Clips are pure functions of time, so every frame is reproducible (captures, replays, tests).
//
// Rotation conventions (compose: R = Ry * Rx * Rz, the character faces +z, its left is +x):
//  - a limb hanging along -y swings FORWARD with negative pitch;
//  - the left arm (+x) lifts sideways with positive roll, the right arm with negative roll;
//  - the torso leans forward with positive pitch.
import { BONE, BONES, type Rig } from "./rig";

export interface Pose {
  rot: Float32Array; // BONES * 3
  /** root offset in character space (px) */
  off: [number, number, number];
  /** root rotation: pitch about the pivot height `pivotY`, then yaw */
  rootPitch: number;
  rootRoll: number;
  pivotY: number;
  /** weapon trail: 0 = none, else 0..1 progress through the swing (drives the slash ribbon) */
  swing: number;
  /** white hit flash 0..1 */
  flash: number;
  /** extra yaw the clip asks for (dodge turns the body into the roll) */
  yaw: number;
}

export function newPose(): Pose {
  return { rot: new Float32Array(BONES * 3), off: [0, 0, 0], rootPitch: 0, rootRoll: 0, pivotY: 0, swing: 0, flash: 0, yaw: 0 };
}

function set(p: Pose, bone: number, pitch: number, yaw = 0, roll = 0): void {
  p.rot[bone * 3] = pitch;
  p.rot[bone * 3 + 1] = yaw;
  p.rot[bone * 3 + 2] = roll;
}
function add(p: Pose, bone: number, pitch: number, yaw = 0, roll = 0): void {
  p.rot[bone * 3] = p.rot[bone * 3]! + pitch;
  p.rot[bone * 3 + 1] = p.rot[bone * 3 + 1]! + yaw;
  p.rot[bone * 3 + 2] = p.rot[bone * 3 + 2]! + roll;
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t) * (1 - t));
const easeIn = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t);
const seg = (u: number, a: number, b: number) => (u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a));
const TAU = Math.PI * 2;

/** Hand rest: weapon held forward, blade up-and-out (a ready stance, not a dangling stick). */
function holdWeapon(p: Pose, rig: Rig): void {
  if (rig.weapon === "none") return;
  if (rig.weapon === "spear") set(p, BONE.weapon, 1.35, 0, 0.0);
  else set(p, BONE.weapon, 1.15, 0, -0.15);
}

/** Idle: breathing, weight shift, the head looks around, ears twitch, tail sways. `seed` desyncs a crowd. */
export function idle(p: Pose, rig: Rig, t: number, seed: number): void {
  const s = rig.species;
  const br = Math.sin(t * 2.1 + seed);
  p.off[1] = 0;
  set(p, BONE.torso, 0.03 + br * 0.025);
  set(p, BONE.hips, 0, Math.sin(t * 0.7 + seed) * 0.05);
  // glance: a slow look that holds, then returns (stepped, so it reads like a decision, not a wobble)
  const look = Math.sin(t * 0.45 + seed * 3.1);
  const glance = look > 0.6 ? 0.55 : look < -0.7 ? -0.5 : 0;
  set(p, BONE.head, -0.04 - br * 0.02, glance, 0);
  set(p, BONE.armL, 0.05 + br * 0.03, 0, 0.1 + br * 0.03);
  set(p, BONE.armR, 0.05 + br * 0.03, 0, -0.1 - br * 0.03);
  set(p, BONE.legL, 0, 0, 0.03);
  set(p, BONE.legR, 0, 0, -0.03);
  const twitch = Math.max(0, Math.sin(t * 1.3 + seed * 7) - 0.92) * 6;
  set(p, BONE.earL, 0, 0, twitch * 0.35);
  set(p, BONE.earR, 0, 0, -twitch * 0.2);
  const wag = Math.sin(t * (s.tail === "fox" ? 2.4 : 1.6) + seed);
  set(p, BONE.tail1, -0.2 + br * 0.05, wag * 0.35, 0);
  set(p, BONE.tail2, 0.1, wag * 0.45, 0);
  holdWeapon(p, rig);
}

/** Walk or run cycle. `phase` in cycles (two steps), `run` 0..1 blends walk -> sprint. */
export function locomotion(p: Pose, rig: Rig, phase: number, run: number, t: number): void {
  const g = rig.species.gait;
  const a = phase * TAU;
  const sw = Math.sin(a), cw = Math.cos(a);
  const stride = (0.8 + run * 0.3) * g.stride;
  const lean = 0.08 + run * 0.22;
  // the body rises twice per cycle (once per step); a light hop when running
  const bob = Math.abs(cw) * (0.6 + run * 0.9) * g.bob;
  p.off[1] = bob;
  set(p, BONE.legL, -sw * stride, 0, 0.02);
  set(p, BONE.legR, sw * stride, 0, -0.02);
  set(p, BONE.hips, 0, sw * 0.12, 0);
  set(p, BONE.torso, lean, -sw * (0.1 + run * 0.06), sw * 0.03);
  set(p, BONE.head, -lean * 0.7 + Math.abs(cw) * 0.04, sw * 0.08, 0);
  const arm = (0.55 + run * 0.45) * g.swing;
  set(p, BONE.armL, sw * arm - run * 0.25, 0, 0.12 + run * 0.15);
  set(p, BONE.armR, -sw * arm - run * 0.25, 0, -0.12 - run * 0.15);
  // ears and tail lag behind the bounce
  const lag = Math.sin(a * 2 - 1.2);
  set(p, BONE.earL, -0.15 * run + lag * 0.08, 0, lag * 0.06);
  set(p, BONE.earR, -0.15 * run + lag * 0.08, 0, -lag * 0.06);
  set(p, BONE.tail1, -0.35 - run * 0.4 + lag * 0.08, -sw * 0.35, 0);
  set(p, BONE.tail2, 0.15 - run * 0.2, -Math.sin(a - 0.8) * 0.45, 0);
  holdWeapon(p, rig);
  if (rig.weapon !== "none") {
    // the weapon arm swings less: a carried blade, not a pendulum
    set(p, BONE.armR, -sw * arm * 0.35 - 0.35 - run * 0.2, 0, -0.18);
  }
  void t;
}

export const ATTACK_S = 0.4; // sim ATTACK_TICKS / TICK_HZ
export const DODGE_S = 0.35;

/**
 * Attack, u = 0..1 over the sim's attack window. Three beats: wind-up (0-0.3), strike (0.3-0.5), recover.
 * The strike is fast and the pose holds a moment at the end: the hit has to land on screen, not in between frames.
 */
export function attack(p: Pose, rig: Rig, u: number): void {
  const wind = easeOut(seg(u, 0, 0.3));
  const strike = easeOut(seg(u, 0.3, 0.5));
  const back = ease(seg(u, 0.7, 1));
  const k = wind - back * 0; // wind stays applied until the strike carries it through
  if (rig.weapon === "none") {
    // a punch: twist back, then a straight jab with the right fist and a forward step
    const tw = 0.6 * wind * (1 - strike) - 0.5 * strike * (1 - back);
    set(p, BONE.torso, 0.1 + strike * 0.2 * (1 - back), tw, 0);
    set(p, BONE.hips, 0, tw * 0.4, 0);
    set(p, BONE.armR, (0.5 * wind) * (1 - strike) - 1.5 * strike * (1 - back), 0, -0.2);
    set(p, BONE.armL, -0.6 * (1 - back), 0, 0.3);
    set(p, BONE.legL, -0.45 * strike * (1 - back), 0, 0.05);
    set(p, BONE.legR, 0.3 * strike * (1 - back), 0, -0.05);
    p.off[2] = 2 * strike * (1 - back);
    p.swing = 0;
    return;
  }
  if (rig.weapon === "spear") {
    // thrust: draw back, then drive the point straight out
    set(p, BONE.torso, 0.15 * strike, 0.5 * wind * (1 - strike) - 0.3 * strike * (1 - back), 0);
    set(p, BONE.armR, -1.4 + 0.5 * wind * (1 - strike) - 0.15 * strike, 0, -0.1);
    set(p, BONE.weapon, Math.PI, 0, 0);
    set(p, BONE.armL, -1.2, 0, 0.5);
    set(p, BONE.legL, -0.5 * strike * (1 - back), 0, 0.05);
    set(p, BONE.legR, 0.35 * strike * (1 - back), 0, -0.05);
    p.off[2] = (-2 * wind * (1 - strike) + 5 * strike) * (1 - back);
    p.swing = 0;
    return;
  }
  // blades and axes: a horizontal sweep from back-right to front-left, the arm extended, blade on the arm's line
  const from = -0.9, to = 2.35;
  const sweep = from + (to - from) * strike;
  const yaw = wind * (1 - strike) * from + strike * sweep * (1 - back) + back * 0.2;
  const lift = 1 - back;
  set(p, BONE.armR, -0.25 * lift, yaw * lift, -1.32 * lift - 0.1);
  set(p, BONE.weapon, Math.PI * lift + 1.15 * (1 - lift), 0, -0.15 * (1 - lift));
  // the body leads the arm: torso twists through, hips follow less, head stays on target
  const twist = (-0.55 * wind * (1 - strike) + 0.7 * strike) * (1 - back);
  set(p, BONE.torso, 0.12 * strike * (1 - back) + 0.04, twist, 0);
  set(p, BONE.hips, 0, twist * 0.45, 0);
  set(p, BONE.head, -0.05, -twist * 0.7, 0);
  set(p, BONE.armL, -0.4 * strike * (1 - back), 0, 0.35 + 0.4 * wind * (1 - back));
  set(p, BONE.legL, -0.4 * strike * (1 - back), 0, 0.08);
  set(p, BONE.legR, 0.3 * strike * (1 - back), 0, -0.08);
  p.off[1] = -0.6 * strike * (1 - back);
  p.off[2] = 2.5 * strike * (1 - back);
  p.swing = u > 0.28 && u < 0.62 ? seg(u, 0.28, 0.62) : 0;
  void k;
}

/** Dodge roll, u = 0..1: crouch, tuck, one full forward roll about the hips, land. */
export function dodge(p: Pose, rig: Rig, u: number): void {
  const s = rig.species;
  const roll = easeIn(seg(u, 0.08, 0.3)) * 0.25 + ease(seg(u, 0.12, 0.85)) * 0.75;
  const tuck = Math.sin(Math.min(1, seg(u, 0.03, 0.92)) * Math.PI);
  // a tight ball turning about its own centre, which hops a little so no part of it dips into the ground
  const ball = s.leg * 0.45 + s.torso * 0.45;
  p.pivotY = ball;
  p.rootPitch = roll * TAU;
  p.off[1] = Math.sin(roll * Math.PI) * 6.5;
  set(p, BONE.torso, 1.25 * tuck);
  set(p, BONE.head, 0.9 * tuck);
  set(p, BONE.legL, -2.1 * tuck, 0, 0.12);
  set(p, BONE.legR, -2.0 * tuck, 0, -0.12);
  set(p, BONE.armL, -1.5 * tuck, 0, 0.3 * tuck);
  set(p, BONE.armR, -1.5 * tuck, 0, -0.3 * tuck);
  set(p, BONE.tail1, -1.0 * tuck, 0, 0);
  set(p, BONE.earL, -1.1 * tuck, 0, 0);
  set(p, BONE.earR, -1.1 * tuck, 0, 0);
  holdWeapon(p, rig);
  // dust kicked up at the start and the landing (read by the FX layer)
  p.swing = 0;
}

/** Hurt, u = 0..1: snap back from the hit, arms fly out, recover. White flash on the first frames. */
export function hurt(p: Pose, rig: Rig, u: number): void {
  const hit = 1 - easeOut(seg(u, 0.15, 1));
  set(p, BONE.torso, -0.45 * hit, 0, 0.12 * hit);
  set(p, BONE.head, -0.4 * hit, 0, -0.2 * hit);
  set(p, BONE.armL, -0.5 * hit, 0, 0.9 * hit);
  set(p, BONE.armR, -0.5 * hit, 0, -0.9 * hit);
  set(p, BONE.legL, 0.25 * hit, 0, 0.1);
  set(p, BONE.legR, -0.2 * hit, 0, -0.1);
  set(p, BONE.earL, 0.6 * hit, 0, 0.5 * hit);
  set(p, BONE.earR, 0.6 * hit, 0, -0.5 * hit);
  set(p, BONE.tail1, 0.6 * hit, 0, 0);
  p.off[1] = 0.8 * hit;
  p.flash = u < 0.22 ? 1 : 0;
  holdWeapon(p, rig);
}

/** Death, u = 0..∞ seconds: buckle, fall onto the back, one small bounce, then still. */
export function death(p: Pose, rig: Rig, secs: number): void {
  const s = rig.species;
  const buckle = easeOut(seg(secs, 0, 0.25));
  const fall = easeIn(seg(secs, 0.15, 0.6));
  const bounce = Math.sin(seg(secs, 0.6, 0.85) * Math.PI) * 0.12;
  p.rootPitch = -(Math.PI / 2) * fall + bounce;
  p.pivotY = 0;
  p.off[1] = s.depth * 0.5 * fall;
  p.off[2] = -1.5 * fall;
  set(p, BONE.torso, 0.35 * buckle * (1 - fall) - 0.05 * fall);
  set(p, BONE.head, 0.4 * buckle * (1 - fall) - 0.3 * fall, 0.5 * fall, 0);
  set(p, BONE.armL, -0.6 * buckle * (1 - fall) - 2.4 * fall, 0, 0.5 * fall);
  set(p, BONE.armR, -0.6 * buckle * (1 - fall) - 2.0 * fall, 0, -0.9 * fall);
  set(p, BONE.legL, -0.5 * buckle * (1 - fall) - 0.15 * fall, 0, 0.25 * fall);
  set(p, BONE.legR, 0.1 * fall, 0, -0.15 * fall);
  set(p, BONE.earL, 0.4 * fall, 0, 0.8 * fall);
  set(p, BONE.earR, 0.4 * fall, 0, -0.8 * fall);
  set(p, BONE.tail1, 0.9 * fall, 0, 0);
  holdWeapon(p, rig);
  if (rig.weapon !== "none") set(p, BONE.weapon, 1.15 + 1.2 * fall, 0, 0.6 * fall);
}

/** Blends `b` into `a` by t (rotations and offsets; flags take b's). */
export function blend(a: Pose, b: Pose, t: number): void {
  if (t <= 0) return;
  for (let i = 0; i < a.rot.length; i++) a.rot[i] = a.rot[i]! + (b.rot[i]! - a.rot[i]!) * t;
  for (let i = 0; i < 3; i++) a.off[i] = a.off[i]! + (b.off[i]! - a.off[i]!) * t;
  a.rootPitch += (b.rootPitch - a.rootPitch) * t;
  a.rootRoll += (b.rootRoll - a.rootRoll) * t;
  a.pivotY = b.pivotY;
  a.swing = b.swing;
  a.flash = b.flash;
  a.yaw += (b.yaw - a.yaw) * t;
}

export function clearPose(p: Pose): void {
  p.rot.fill(0);
  p.off[0] = p.off[1] = p.off[2] = 0;
  p.rootPitch = p.rootRoll = p.pivotY = p.swing = p.flash = p.yaw = 0;
}

export { add as addRot };
