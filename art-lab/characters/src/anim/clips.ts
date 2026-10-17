// Clips. Locomotion and idle are procedural (they must follow any speed and never slide); actions are key poses
// authored like an animator would block them (degrees, named bones, eased segments), so they can be read and
// tuned by eye. Every clip is a pure function of time: any frame can be reproduced for a capture.
//
// Conventions (see rig/skeleton.ts): a limb hanging along -y swings FORWARD with negative pitch; the left arm
// lifts out sideways with negative roll removed (rest is the A pose: roll -aPose brings the left arm down).
import type { Build } from "../body/build";
import { setRot, type Pose } from "../rig/pose";
import { B, BONE_NAMES } from "../rig/skeleton";
import type { V3 } from "../sdf/model";

export const TAU = Math.PI * 2;
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t) * (1 - t));
export const easeIn = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t);
export const seg = (u: number, a: number, b: number) => (u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a));
const D = Math.PI / 180;

/** How a species moves. */
export interface Gait {
  /** step length as a multiple of hip height (jog) */
  stride: number;
  /** body rise per step, px */
  bounce: number;
  /** foot lift as a fraction of hip height */
  lift: number;
  /** arm swing (rad) and elbow bend while running (rad) */
  swing: number;
  elbow: number;
  /** forward lean while running (rad) */
  lean: number;
  /** pelvis sway (rad) */
  sway: number;
  /** both feet together: a hop */
  hop: boolean;
  /** foot spacing as a multiple of the hip joint spacing */
  width: number;
  /** head bob (bird) */
  headBob: number;
  /** idle: how much the figure fidgets */
  fidget: number;
}

export const GAIT_DEFAULT: Gait = { stride: 1.35, bounce: 1.1, lift: 0.32, swing: 0.75, elbow: 1.2, lean: 0.16, sway: 0.08, hop: false, width: 0.95, headBob: 0, fidget: 1 };

/** Leg targets produced by a clip, in character space; IK solves them after FK. */
export interface Legs {
  /** 0..1: how much IK overrides the FK legs */
  w: number;
  /** ankle (foot joint) target per side, character space */
  ankle: [V3, V3];
  /** foot pitch per side (rad, + = toes down) and toe pitch */
  footPitch: [number, number];
  toePitch: [number, number];
}

export function newLegs(): Legs {
  return { w: 0, ankle: [[0, 0, 0], [0, 0, 0]], footPitch: [0, 0], toePitch: [0, 0] };
}

export interface Ctx {
  b: Build;
  gait: Gait;
  /** rest ankle height and z, per side (from the skeleton) */
  ankleRest: [V3, V3];
  seed: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Idle: breath, weight shift, glances, ears and tail. Feet stay planted (IK).

export function idle(p: Pose, legs: Legs, c: Ctx, t: number): void {
  const b = c.b, f = c.gait.fidget, s = c.seed;
  const a = b.aPose;
  const br = Math.sin(t * 2.0 + s);
  const shift = Math.sin(t * 0.55 + s * 1.7);
  // weight on one leg: the pelvis drifts over it and tilts, the chest counters
  p.off[0] = shift * 0.45 * f;
  p.off[1] = -0.25 - Math.abs(shift) * 0.25 * f + br * 0.08;
  setRot(p, B.pelvis, 0, shift * 0.05 * f, -shift * 0.06 * f);
  setRot(p, B.spine, 0.04 + br * 0.015, 0, shift * 0.04 * f);
  setRot(p, B.chest, 0.02 + br * 0.03, 0, shift * 0.03 * f);
  p.scl[B.chest * 3] = 1 + br * 0.015; p.scl[B.chest * 3 + 2] = 1 + br * 0.02;
  // glance: a slow look that holds, then returns (stepped, so it reads like a decision, not a wobble)
  const look = Math.sin(t * 0.37 + s * 3.1);
  const glance = look > 0.55 ? 0.5 : look < -0.65 ? -0.45 : 0;
  const nod = Math.sin(t * 0.23 + s * 5.3) > 0.8 ? 0.12 : 0;
  setRot(p, B.head, -0.03 - br * 0.02 + nod, glance * f, -shift * 0.04);
  setRot(p, B.armL, 0.02 + br * 0.03, 0.12, -a + 0.14 + br * 0.02);
  setRot(p, B.armR, 0.02 + br * 0.03, -0.12, a - 0.14 - br * 0.02);
  setRot(p, B.foreL, -0.3);
  setRot(p, B.foreR, -0.45);
  setRot(p, B.weapon, 0.5, 0, 0); // a carried blade angles down and forward
  // ears: a twitch now and then; tail: a slow sway
  const tw = Math.max(0, Math.sin(t * 1.3 + s * 7) - 0.93) * 8;
  setRot(p, B.earL, tw * 0.25, 0, -tw * 0.2);
  setRot(p, B.earR, 0, 0, tw * 0.1);
  const wag = Math.sin(t * 1.4 + s);
  for (let i = 0; i < 4; i++) setRot(p, B.tail1 + i, 0.05, wag * (0.08 + i * 0.05), 0);
  // blink: twice every few seconds, seeded
  const bt = (t + s * 3.7) % 3.7;
  p.blink = bt < 0.12 ? 1 : 0;
  // planted feet
  legs.w = 1;
  for (const side of [0, 1] as const) {
    const r = c.ankleRest[side];
    legs.ankle[side] = [r[0] * 1.05, r[1], r[2] + (side === 0 ? 0.4 : -0.3)];
    legs.footPitch[side] = 0;
    legs.toePitch[side] = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Locomotion: a jog that becomes a sprint. Feet follow a path in body space that is planted while in contact
// (it moves back at exactly the body speed), so nothing slides.

/** Step length in px for `speed` (px/s). The animator advances the phase by distance / (2 * stepLen). */
export function stepLen(c: Ctx, speed: number): number {
  // short legs, real speeds: the jog (80 px/s) and the sprint (128) are runs with a flight phase
  const walk = Math.max(0, Math.min(1, speed / 80));
  const sprint = Math.max(0, Math.min(1, (speed - 80) / 48));
  return c.b.hip * c.gait.stride * (0.55 + 0.45 * walk + 0.3 * sprint);
}

/** Fraction of a cycle each foot spends on the ground. */
function dutyOf(c: Ctx, speed: number): number {
  if (c.gait.hop) return 0.3;
  const walk = Math.max(0, Math.min(1, speed / 80));
  const sprint = Math.max(0, Math.min(1, (speed - 80) / 48));
  return 0.62 - 0.24 * walk - 0.08 * sprint;
}

export function locomotion(p: Pose, legs: Legs, c: Ctx, phase: number, speed: number, t: number): void {
  const b = c.b, g = c.gait;
  const run = Math.max(0, Math.min(1, (speed - 40) / 90)); // 0 slow walk .. 1 sprint
  const sl = stepLen(c, speed);
  // duty factor: the fraction of a cycle each foot is on the ground (walk 0.62 .. sprint 0.34)
  // contact time shrinks if the planted foot would have to travel farther than the leg reaches (never slide)
  const duty = Math.min(dutyOf(c, speed), (b.hip * 1.0) / (2 * sl));
  const d = 2 * duty * sl; // the body travels exactly this far over one planted foot
  const a = b.aPose;
  const ph = phase - Math.floor(phase);
  const sw = Math.sin(ph * TAU);
  // body: two bounces per cycle (one per step), lowest just after contact
  const step = (ph * 2) % 1;
  const bounce = g.bounce * (0.6 + 0.6 * run) * (g.hop ? 2.4 : 1);
  const h = g.hop ? Math.sin(Math.min(1, Math.max(0, (ph - duty) / (1 - duty))) * Math.PI) : -Math.cos((step - duty * 0.5) * TAU);
  p.off[1] = (g.hop ? h * bounce * 1.6 - 0.6 : h * bounce * 0.5 - 0.35 * run) - 0.2;
  p.off[2] = 0;
  const lean = g.lean * (0.4 + 0.8 * run);
  setRot(p, B.pelvis, 0, g.hop ? 0 : sw * 0.14, g.hop ? 0 : -sw * g.sway);
  setRot(p, B.spine, lean * 0.5 + (g.hop ? -h * 0.1 : 0), g.hop ? 0 : -sw * 0.1, g.hop ? 0 : sw * g.sway * 0.6);
  setRot(p, B.chest, lean * 0.5, g.hop ? 0 : -sw * 0.12, 0);
  setRot(p, B.head, -lean * 0.8 + (g.headBob > 0 ? Math.sin(step * TAU) * g.headBob : 0), g.hop ? 0 : sw * 0.12, 0);
  // arms: counter-swing, elbows bent with speed
  const swing = g.swing * (0.6 + 0.5 * run) * (g.hop ? 0 : 1);
  const hopArms = g.hop ? -0.5 * h : 0;
  setRot(p, B.armL, sw * swing - 0.1 * run + hopArms, 0.1, -a + 0.22 + run * 0.08);
  setRot(p, B.armR, -sw * swing - 0.1 * run + hopArms, -0.1, a - 0.22 - run * 0.08);
  const el = -(0.45 + g.elbow * run);
  setRot(p, B.foreL, el + Math.max(0, sw) * 0.25);
  setRot(p, B.foreR, el + Math.max(0, -sw) * 0.25);
  setRot(p, B.weapon, 0.9 + 0.5 * run, 0, 0);
  // ears flatten back with speed; tail streams behind and swings
  setRot(p, B.earL, 0.25 * run, 0, 0);
  setRot(p, B.earR, 0.25 * run, 0, 0);
  for (let i = 0; i < 4; i++) setRot(p, B.tail1 + i, -0.15 * run + Math.sin(ph * TAU - i * 0.7) * 0.06, Math.sin(ph * TAU - i * 0.9) * (0.12 + 0.06 * i), 0);
  p.blink = ((t + c.seed * 3.7) % 3.4) < 0.1 ? 1 : 0;
  // feet
  legs.w = 1;
  for (const side of [0, 1] as const) {
    const r = c.ankleRest[side];
    const u = (ph + (g.hop ? 0 : side * 0.5)) % 1;
    let z: number, y: number, fp: number, tp: number;
    if (u < duty) {
      // planted: moves back at body speed
      const s = u / duty;
      z = d / 2 - s * d;
      y = 0;
      fp = 0;
      tp = 0;
      // heel peel at the end of contact (toes stay down)
      if (s > 0.7) { const k = (s - 0.7) / 0.3; fp = k * 0.5; tp = -k * 0.45; y = k * 0.6; }
    } else {
      const s = (u - duty) / (1 - duty);
      const e = ease(s);
      z = -d / 2 + d * e;
      y = Math.sin(s * Math.PI) * b.hip * g.lift * (0.7 + 0.6 * run) + (1 - s) * 0.6;
      // toes trail at lift-off, reach before contact
      fp = (1 - s) * 0.6 - s * 0.25;
      tp = -(1 - s) * 0.3;
    }
    legs.ankle[side] = [r[0] * g.width, r[1] + y, r[2] + z + 0.3 * run];
    legs.footPitch[side] = fp;
    legs.toePitch[side] = tp;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Key-pose clips for actions.

export type Ease = "lin" | "in" | "out" | "io" | "step";

export interface Key {
  /** 0..1 through the clip */
  t: number;
  /** easing INTO this key */
  ease?: Ease;
  /** bone -> [pitch, yaw, roll] in degrees, ADDED to the stance (A-pose arms are already lowered) */
  b?: Partial<Record<keyof typeof B, [number, number, number]>>;
  /** root offset (px) and rotation (deg) */
  off?: V3;
  rot?: V3;
  pivot?: number;
  /** squash and stretch of the chest (x/z widen, y lengthen) */
  stretch?: number;
  /** feet: ankle offsets from rest (x, y, z) per side, and foot pitch (deg) */
  feet?: [V3, V3];
  footPitch?: [number, number];
  expr?: number;
  flash?: number;
  swing?: number;
  /** IK weight (0 = FK legs, e.g. mid-roll) */
  ik?: number;
}

export interface Clip {
  name: string;
  keys: Key[];
}

function easeOf(e: Ease | undefined, t: number): number {
  switch (e) {
    case "in": return easeIn(t);
    case "out": return easeOut(t);
    case "lin": return t;
    case "step": return t < 1 ? 0 : 1;
    default: return ease(t);
  }
}

const BONE_IDX = new Map(BONE_NAMES.map((n, i) => [n, i]));

/**
 * Samples a clip at u (0..1) into the pose and legs. The stance (arms down, knees soft) is laid down first; keys
 * add to it. `hold` > 1 snaps time to that many frames per clip (limited animation: e.g. 12 for 12 poses).
 */
export function sampleClip(clip: Clip, u: number, p: Pose, legs: Legs, c: Ctx, hold = 0): void {
  if (hold > 0) u = Math.floor(u * hold) / hold;
  const ks = clip.keys;
  let i = 0;
  while (i < ks.length - 1 && ks[i + 1]!.t <= u) i++;
  const k0 = ks[i]!, k1 = ks[Math.min(i + 1, ks.length - 1)]!;
  const span = k1.t - k0.t;
  const w = span > 0 ? easeOf(k1.ease, Math.max(0, Math.min(1, (u - k0.t) / span))) : 0;
  stance(p, c.b);
  const mixN = (a: number | undefined, b2: number | undefined) => (a ?? 0) + ((b2 ?? 0) - (a ?? 0)) * w;
  const names = new Set([...Object.keys(k0.b ?? {}), ...Object.keys(k1.b ?? {})]);
  for (const n of names) {
    const bi = BONE_IDX.get(n)!;
    const a = (k0.b as Record<string, V3>)?.[n] ?? [0, 0, 0];
    const bb = (k1.b as Record<string, V3>)?.[n] ?? [0, 0, 0];
    p.rot[bi * 3] = p.rot[bi * 3]! + (a[0] + (bb[0] - a[0]) * w) * D;
    p.rot[bi * 3 + 1] = p.rot[bi * 3 + 1]! + (a[1] + (bb[1] - a[1]) * w) * D;
    p.rot[bi * 3 + 2] = p.rot[bi * 3 + 2]! + (a[2] + (bb[2] - a[2]) * w) * D;
  }
  for (let j = 0; j < 3; j++) p.off[j] = mixN(k0.off?.[j], k1.off?.[j]);
  p.pitch = mixN(k0.rot?.[0], k1.rot?.[0]) * D;
  p.yaw = mixN(k0.rot?.[1], k1.rot?.[1]) * D;
  p.roll = mixN(k0.rot?.[2], k1.rot?.[2]) * D;
  p.pivotY = mixN(k0.pivot, k1.pivot);
  const st = mixN(k0.stretch, k1.stretch);
  if (st !== 0) {
    for (const bone of [B.spine, B.chest]) {
      p.scl[bone * 3] = 1 - st * 0.5; p.scl[bone * 3 + 1] = 1 + st; p.scl[bone * 3 + 2] = 1 - st * 0.5;
    }
  }
  p.expr = (w < 0.5 ? k0.expr : k1.expr) ?? 0;
  p.flash = mixN(k0.flash, k1.flash);
  p.swing = mixN(k0.swing, k1.swing);
  legs.w = mixN(k0.ik ?? 1, k1.ik ?? 1);
  for (const side of [0, 1] as const) {
    const r = c.ankleRest[side];
    const fa = k0.feet?.[side] ?? [0, 0, 0], fb = k1.feet?.[side] ?? [0, 0, 0];
    legs.ankle[side] = [r[0] + fa[0] + (fb[0] - fa[0]) * w, r[1] + fa[1] + (fb[1] - fa[1]) * w, r[2] + fa[2] + (fb[2] - fa[2]) * w];
    legs.footPitch[side] = mixN(k0.footPitch?.[side], k1.footPitch?.[side]) * D;
    legs.toePitch[side] = 0;
  }
}

/** The neutral stance every key adds to: arms lowered from the A pose, elbows soft. */
export function stance(p: Pose, b: Build): void {
  const a = b.aPose;
  p.rot.fill(0);
  p.scl.fill(1);
  setRot(p, B.armL, 0, 0.1, -a + 0.15);
  setRot(p, B.armR, 0, -0.1, a - 0.15);
  setRot(p, B.foreL, -0.35);
  setRot(p, B.foreR, -0.35);
  p.off[0] = p.off[1] = p.off[2] = 0;
  p.pitch = p.yaw = p.roll = p.pivotY = 0;
  p.blink = 0; p.flash = 0; p.swing = 0; p.expr = 0;
}
