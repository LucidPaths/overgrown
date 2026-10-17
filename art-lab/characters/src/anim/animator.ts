// One animator per character: turns sim state (action, its start, velocity) into a pose, solves the legs, and runs
// the springs that make ears, tails and cloth follow through. Presentation only: it never feeds back into the sim.
import type { Build } from "../body/build";
import type { WeaponId } from "../body/gear";
import { blendPose, clearPose, copyPose, fk, m3mul, newPose, type Pose, type Posed } from "../rig/pose";
import { B, type Skeleton } from "../rig/skeleton";
import type { V3 } from "../sdf/model";
import { ATTACK_S, CHOP, DEATH_S, DODGE_S, HURT, HURT_S, PUNCH, SLASH_A, SLASH_B, THRUST, deathClip, dodgeClip } from "./actions";
import { GAIT_DEFAULT, idle, locomotion, newLegs, sampleClip, stepLen, type Clip, type Ctx, type Gait, type Legs } from "./clips";
import { solveLeg } from "./ik";
import { Springs } from "./springs";

export const ACT = { Idle: 0, Walk: 1, Attack: 2, Dodge: 3, Hurt: 4, Death: 5 } as const;

export interface AnimInput {
  action: number;
  /** seconds since the action started */
  t: number;
  /** a counter that changes with every new action instance (alternates the slash) */
  serial: number;
  /** speed over the ground, px/s */
  speed: number;
}

function attackClip(w: WeaponId, serial: number): Clip {
  switch (w) {
    case "spear":
    case "staff":
      return THRUST;
    case "axe":
    case "hammer":
      return CHOP;
    case "none":
      return PUNCH;
    default:
      return serial % 2 === 0 ? SLASH_A : SLASH_B;
  }
}

export class Animator {
  readonly ctx: Ctx;
  readonly pose = newPose();
  private base = newPose();
  private act = newPose();
  private legsBase = newLegs();
  private legsAct = newLegs();
  readonly legs = newLegs();
  phase = 0;
  speed = 0;
  /** weight of the action layer, eased so clips never pop */
  private actW = 0;
  private lastAction = -1;
  private lastSerial = -1;
  readonly springs: Springs;
  private dodge: Clip;
  private death: Clip;
  /** world time, for idle */
  time = 0;
  /** footstep events since the last update (side 0/1), for dust and sound */
  steps: number[] = [];
  private lastStep = 0;

  constructor(readonly sk: Skeleton, readonly b: Build, readonly weapon: WeaponId, gait: Partial<Gait>, seed: number) {
    const ar = (side: 0 | 1): V3 => {
      const f = side === 0 ? B.footL : B.footR;
      return [sk.pos[f]![0], sk.pos[f]![1], sk.pos[f]![2]];
    };
    this.ctx = { b, gait: { ...GAIT_DEFAULT, ...gait }, ankleRest: [ar(0), ar(1)], seed };
    this.springs = new Springs(sk);
    this.dodge = dodgeClip(b.hip * 0.62 + b.torso * 0.3);
    this.death = deathClip(Math.max(b.chest[2], b.belly[2]) * 0.9 - 0.3);
    this.time = seed * 10;
  }

  update(dt: number, inp: AnimInput): void {
    this.time += dt;
    const c = this.ctx;
    this.speed += (inp.speed - this.speed) * Math.min(1, dt * 12);
    const moving = this.speed > 6 && inp.action !== ACT.Death;
    // base layer: idle <-> locomotion by speed
    clearPose(this.base);
    idle(this.base, this.legsBase, c, this.time);
    if (moving) {
      const sl = stepLen(c, this.speed);
      const before = this.phase;
      this.phase += (this.speed * dt) / (2 * sl);
      const n0 = Math.floor(before * 2), n1 = Math.floor(this.phase * 2);
      if (n1 !== n0) this.steps.push(n1 & 1);
      const loco = newPoseCached(this);
      const ll = newLegsCached(this);
      locomotion(loco, ll, c, this.phase, this.speed, this.time);
      const w = Math.min(1, this.speed / 30);
      blendPose(this.base, loco, w);
      blendLegs(this.legsBase, ll, w);
    }
    // action layer
    const a = inp.action;
    if (a !== this.lastAction || inp.serial !== this.lastSerial) {
      if (a === ACT.Attack || a === ACT.Dodge || a === ACT.Hurt || a === ACT.Death) this.actW = a === ACT.Hurt || a === ACT.Death ? 1 : Math.max(this.actW, 0.4);
      this.lastAction = a;
      this.lastSerial = inp.serial;
    }
    let clip: Clip | null = null, u = 0;
    if (a === ACT.Attack) { clip = attackClip(this.weapon, inp.serial); u = inp.t / ATTACK_S; }
    else if (a === ACT.Dodge) { clip = this.dodge; u = inp.t / DODGE_S; }
    else if (a === ACT.Hurt) { clip = HURT; u = inp.t / HURT_S; }
    else if (a === ACT.Death) { clip = this.death; u = inp.t / DEATH_S; }
    if (clip) {
      this.actW = Math.min(1, this.actW + dt * 16);
      sampleClip(clip, Math.min(1, Math.max(0, u)), this.act, this.legsAct, c);
      copyPose(this.pose, this.base);
      blendPose(this.pose, this.act, this.actW);
      copyLegs(this.legs, this.legsBase);
      blendLegs(this.legs, this.legsAct, this.actW);
      // ears and tail keep living through actions unless the clip moves them
      if (a !== ACT.Death) this.pose.blink = this.base.blink;
    } else {
      this.actW = Math.max(0, this.actW - dt * 8);
      if (this.actW > 0 && this.lastClipU >= 0) {
        // fade out of the last action's final key into the base
        copyPose(this.pose, this.act);
        blendPose(this.pose, this.base, 1 - this.actW);
        copyLegs(this.legs, this.legsAct);
        blendLegs(this.legs, this.legsBase, 1 - this.actW);
      } else {
        copyPose(this.pose, this.base);
        copyLegs(this.legs, this.legsBase);
      }
    }
    this.lastClipU = clip ? u : this.lastClipU;
  }
  private lastClipU = -1;

  /** FK, leg IK and springs into `ps` (character space). `place` is the character's world matrix (for springs). */
  solve(ps: Posed, place: Float32Array, dt: number): void {
    ps.fixed.fill(0);
    this.springs.apply(this.pose);
    fk(this.sk, this.pose, ps);
    const L = this.legs;
    if (L.w > 0.01) {
      for (const side of [0, 1] as const) {
        const thigh = side === 0 ? B.thighL : B.thighR;
        const foot = thigh + 2, toe = thigh + 3;
        // the IK target blends with the FK ankle by the IK weight
        const fkA: V3 = [ps.P[foot * 3]!, ps.P[foot * 3 + 1]!, ps.P[foot * 3 + 2]!];
        const tgt = L.ankle[side];
        const a: V3 = [fkA[0] + (tgt[0] - fkA[0]) * L.w, fkA[1] + (tgt[1] - fkA[1]) * L.w, fkA[2] + (tgt[2] - fkA[2]) * L.w];
        // the foot keeps its rest frame turned by the root yaw, pitched by the clip
        const fr = rotX(L.footPitch[side]);
        const footR = m3mul(rootYaw(this.pose), m3mul(fr, restR(this.sk, foot), new Array(9)), new Array(9)) as number[];
        const toeR = m3mul(rootYaw(this.pose), m3mul(rotX(L.toePitch[side] + L.footPitch[side] * 0.2), restR(this.sk, toe), new Array(9)), new Array(9)) as number[];
        solveLeg(this.sk, ps, side, a, kneePole(this.pose), footR, toeR);
      }
    }
    this.springs.step(this.sk, this.pose, ps, place, dt);
  }
}

// scratch poses (one set per animator, created lazily)
const scratch = new WeakMap<Animator, { p: Pose; l: Legs }>();
function newPoseCached(a: Animator): Pose {
  let s = scratch.get(a);
  if (!s) { s = { p: newPose(), l: newLegs() }; scratch.set(a, s); }
  clearPose(s.p);
  return s.p;
}
function newLegsCached(a: Animator): Legs {
  return scratch.get(a)!.l;
}

function blendLegs(a: Legs, b: Legs, t: number): void {
  if (t <= 0) return;
  a.w += (b.w - a.w) * t;
  for (const s of [0, 1] as const) {
    for (let i = 0; i < 3; i++) a.ankle[s][i] = a.ankle[s][i]! + (b.ankle[s][i]! - a.ankle[s][i]!) * t;
    a.footPitch[s] += (b.footPitch[s] - a.footPitch[s]) * t;
    a.toePitch[s] += (b.toePitch[s] - a.toePitch[s]) * t;
  }
}
function copyLegs(a: Legs, b: Legs): void {
  a.w = b.w;
  for (const s of [0, 1] as const) {
    a.ankle[s] = [...b.ankle[s]] as V3;
    a.footPitch[s] = b.footPitch[s];
    a.toePitch[s] = b.toePitch[s];
  }
}

function rotX(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  // column-major: x axis, y axis, z axis. Positive = toes down (the toe points along +z: rotate +z toward -y)
  return [1, 0, 0, 0, c, s, 0, -s, c];
}
function restR(sk: Skeleton, b: number): number[] {
  const r = sk.rot[b]!;
  return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]];
}
function rootYaw(p: Pose): number[] {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}
function kneePole(p: Pose): V3 {
  return [Math.sin(p.yaw), 0, Math.cos(p.yaw)];
}
