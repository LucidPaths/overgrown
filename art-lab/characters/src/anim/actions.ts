// Action clips, blocked as key poses. Timing comes from the sim: an attack lasts 0.4 s and its hit lands at tick 3
// of 8 (u = 0.375); a dodge lasts 0.35 s; hurt 0.3 s; death holds its last key forever.
// The rule for every attack: anticipation (coil, squash) -> a strike faster than the eye (stretch, smear) ->
// a held follow-through (the hit has to land on screen) -> recovery.
import type { Clip } from "./clips";
import { EXPR } from "../render/char-shaders";

export const ATTACK_S = 0.4;
export const HIT_U = 0.375;
export const DODGE_S = 0.35;
export const HURT_S = 0.3;

/** Forehand slash: right to left across the body. */
export const SLASH_A: Clip = {
  name: "slash-a",
  keys: [
    { t: 0, b: { armR: [-20, 0, 0], foreR: [-25, 0, 0] } },
    {
      t: 0.24, ease: "out", expr: EXPR.angry, stretch: -0.1, off: [0, -1.1, -0.6],
      b: { spine: [6, -30, 0], chest: [4, -28, 0], head: [-4, 40, 0], armR: [-55, 55, 55], foreR: [-70, 0, 0], armL: [-25, 0, -20], foreL: [-60, 0, 0], weapon: [10, 0, 0] },
      feet: [[0.4, 0, 2.2], [-0.3, 0, -2.0]], footPitch: [0, 0],
    },
    {
      t: 0.38, ease: "in", expr: EXPR.yell, stretch: 0.12, off: [0, -1.4, 2.6], swing: 1,
      b: { spine: [14, 30, 0], chest: [10, 28, 0], head: [0, -36, 0], armR: [-85, -60, 15], foreR: [-8, 0, 0], armL: [10, 0, 20], foreL: [-80, 0, 0], weapon: [0, 0, 0] },
      feet: [[0.4, 0, 3.8], [-0.4, 0, -2.6]],
    },
    {
      t: 0.56, ease: "out", expr: EXPR.yell, stretch: 0.04, off: [0, -1.5, 2.8], swing: 0.4,
      b: { spine: [16, 42, 0], chest: [12, 36, 0], head: [2, -44, 0], armR: [-70, -92, 0], foreR: [-12, 0, 0], armL: [16, 0, 24], foreL: [-80, 0, 0] },
      feet: [[0.4, 0, 3.8], [-0.4, 0, -2.6]],
    },
    { t: 1, ease: "io", expr: EXPR.angry, b: { armR: [-20, 0, 0], foreR: [-25, 0, 0] } },
  ],
};

/** Backhand slash: left to right, the follow-up of a combo. */
export const SLASH_B: Clip = {
  name: "slash-b",
  keys: [
    { t: 0, b: { spine: [8, 30, 0], chest: [6, 24, 0], armR: [-60, -70, 10], foreR: [-20, 0, 0] } },
    {
      t: 0.24, ease: "out", expr: EXPR.angry, stretch: -0.1, off: [0, -1.0, -0.4],
      b: { spine: [8, 38, 0], chest: [6, 34, 0], head: [-4, -40, 0], armR: [-60, -95, -10], foreR: [-80, 0, 0], armL: [-15, 0, -10], weapon: [0, 0, 0] },
      feet: [[-0.2, 0, -1.8], [0.3, 0, 2.0]],
    },
    {
      t: 0.38, ease: "in", expr: EXPR.yell, stretch: 0.12, off: [0, -1.3, 2.4], swing: 1,
      b: { spine: [12, -34, 0], chest: [10, -30, 0], head: [0, 36, 0], armR: [-85, 70, 55], foreR: [-5, 0, 0], armL: [15, 0, 25], foreL: [-60, 0, 0] },
      feet: [[-0.4, 0, -2.4], [0.4, 0, 3.6]],
    },
    {
      t: 0.56, ease: "out", expr: EXPR.yell, stretch: 0.04, off: [0, -1.4, 2.6], swing: 0.4,
      b: { spine: [14, -44, 0], chest: [12, -36, 0], head: [2, 44, 0], armR: [-70, 95, 60], foreR: [-10, 0, 0], armL: [18, 0, 25], foreL: [-60, 0, 0] },
      feet: [[-0.4, 0, -2.4], [0.4, 0, 3.6]],
    },
    { t: 1, ease: "io", expr: EXPR.angry, b: { armR: [-20, 0, 0], foreR: [-25, 0, 0] } },
  ],
};

/** Spear thrust: draw back, drive the point straight out, hold. */
export const THRUST: Clip = {
  name: "thrust",
  keys: [
    { t: 0, b: { armR: [-40, 0, 0], foreR: [-50, 0, 0], armL: [-50, 0, -10], foreL: [-60, 0, 0] } },
    {
      t: 0.25, ease: "out", expr: EXPR.angry, stretch: -0.1, off: [0, -1.2, -1.8],
      b: { spine: [2, -24, 0], chest: [0, -20, 0], head: [0, 26, 0], armR: [10, 30, 30], foreR: [-110, 0, 0], armL: [-70, 0, -10], foreL: [-40, 0, 0] },
      feet: [[0.3, 0, 2.6], [-0.3, 0, -2.2]],
    },
    {
      t: 0.38, ease: "in", expr: EXPR.yell, stretch: 0.15, off: [0, -1.6, 4.6], swing: 0,
      b: { spine: [16, 16, 0], chest: [10, 14, 0], head: [-6, -18, 0], armR: [-88, 0, 10], foreR: [0, 0, 0], armL: [-80, 0, -20], foreL: [-10, 0, 0] },
      feet: [[0.4, 0, 5.2], [-0.4, 0, -3.0]], footPitch: [0, 20],
    },
    {
      t: 0.6, ease: "out", expr: EXPR.yell, stretch: 0.06, off: [0, -1.5, 4.4],
      b: { spine: [16, 16, 0], chest: [10, 14, 0], head: [-6, -18, 0], armR: [-86, 0, 10], foreR: [-4, 0, 0], armL: [-78, 0, -20], foreL: [-12, 0, 0] },
      feet: [[0.4, 0, 5.2], [-0.4, 0, -3.0]], footPitch: [0, 20],
    },
    { t: 1, ease: "io", expr: EXPR.angry, b: { armR: [-40, 0, 0], foreR: [-50, 0, 0], armL: [-50, 0, -10], foreL: [-60, 0, 0] } },
  ],
};

/** Overhead chop (axe, hammer): raise high, bring it down with the whole body. */
export const CHOP: Clip = {
  name: "chop",
  keys: [
    { t: 0, b: { armR: [-30, 0, 0], foreR: [-30, 0, 0] } },
    {
      t: 0.26, ease: "out", expr: EXPR.angry, stretch: 0.1, off: [0, 0.6, -1.0],
      b: { spine: [-14, -10, 0], chest: [-12, -8, 0], head: [-14, 0, 0], armR: [-175, 10, 10], foreR: [-40, 0, 0], armL: [-150, 0, -20], foreL: [-30, 0, 0] },
      feet: [[0.3, 0, 1.6], [-0.3, 0, -1.6]], footPitch: [0, 10],
    },
    {
      t: 0.39, ease: "in", expr: EXPR.yell, stretch: -0.16, off: [0, -2.4, 3.0], swing: 1,
      b: { spine: [28, 0, 0], chest: [22, 0, 0], head: [-16, 0, 0], armR: [-60, 0, 0], foreR: [-10, 0, 0], armL: [-50, 0, -10], foreL: [-20, 0, 0] },
      feet: [[0.4, 0, 3.4], [-0.4, 0, -2.4]],
    },
    {
      t: 0.62, ease: "out", expr: EXPR.yell, stretch: -0.1, off: [0, -2.5, 3.0], swing: 0.3,
      b: { spine: [30, 0, 0], chest: [24, 0, 0], head: [-18, 0, 0], armR: [-45, 0, 0], foreR: [-10, 0, 0], armL: [-40, 0, -10], foreL: [-20, 0, 0] },
      feet: [[0.4, 0, 3.4], [-0.4, 0, -2.4]],
    },
    { t: 1, ease: "io", expr: EXPR.angry, b: { armR: [-30, 0, 0], foreR: [-30, 0, 0] } },
  ],
};

/** Unarmed: a guard, then a straight right with the shoulder behind it. */
export const PUNCH: Clip = {
  name: "punch",
  keys: [
    { t: 0, b: { armR: [-30, 0, 20], foreR: [-110, 0, 0], armL: [-40, 0, -20], foreL: [-110, 0, 0] } },
    {
      t: 0.24, ease: "out", expr: EXPR.angry, stretch: -0.1, off: [0, -1.0, -0.6],
      b: { spine: [4, -32, 0], chest: [2, -26, 0], head: [0, 30, 0], armR: [10, 10, 30], foreR: [-130, 0, 0], armL: [-60, 0, -20], foreL: [-110, 0, 0] },
      feet: [[0.3, 0, 2.0], [-0.3, 0, -2.0]],
    },
    {
      t: 0.37, ease: "in", expr: EXPR.yell, stretch: 0.12, off: [0, -1.1, 2.8],
      b: { spine: [10, 30, 0], chest: [8, 26, 0], head: [-4, -28, 0], armR: [-90, -10, 0], foreR: [0, 0, 0], armL: [-20, 0, -30], foreL: [-120, 0, 0] },
      feet: [[0.4, 0, 3.4], [-0.4, 0, -2.4]], footPitch: [0, 15],
    },
    {
      t: 0.55, ease: "out", expr: EXPR.yell, off: [0, -1.1, 2.8],
      b: { spine: [10, 30, 0], chest: [8, 26, 0], head: [-4, -28, 0], armR: [-88, -10, 0], foreR: [-4, 0, 0], armL: [-20, 0, -30], foreL: [-120, 0, 0] },
      feet: [[0.4, 0, 3.4], [-0.4, 0, -2.4]], footPitch: [0, 15],
    },
    { t: 1, ease: "io", expr: EXPR.angry, b: { armR: [-30, 0, 20], foreR: [-110, 0, 0], armL: [-40, 0, -20], foreL: [-110, 0, 0] } },
  ],
};

/** Dodge roll: squash, launch, a tucked forward roll about the body centre, land, rise. */
export function dodgeClip(pivot: number): Clip {
  const tuck = { spine: [55, 0, 0], chest: [35, 0, 0], head: [40, 0, 0], armL: [-80, 0, -20], foreL: [-90, 0, 0], armR: [-80, 0, 20], foreR: [-90, 0, 0], thighL: [-120, 0, 0], shinL: [130, 0, 0], thighR: [-110, 0, 0], shinR: [125, 0, 0], tail1: [40, 0, 0], earL: [-40, 0, 0], earR: [-40, 0, 0] } as const;
  return {
    name: "dodge",
    keys: [
      { t: 0, ik: 1, b: {} },
      { t: 0.1, ease: "out", ik: 1, stretch: -0.16, off: [0, -2.2, 0.5], expr: EXPR.angry, b: { spine: [30, 0, 0], head: [10, 0, 0], armL: [-40, 0, 0], armR: [-40, 0, 0] }, feet: [[0, 0, 1], [0, 0, -0.5]] },
      { t: 0.22, ease: "in", ik: 0, stretch: 0.1, pivot, off: [0, 3.5, 2], rot: [100, 0, 0], expr: EXPR.hurt, b: tuck as never },
      { t: 0.5, ease: "lin", ik: 0, pivot, off: [0, 5.0, 4], rot: [230, 0, 0], expr: EXPR.hurt, b: tuck as never },
      { t: 0.74, ease: "lin", ik: 0, pivot, off: [0, 2.0, 5], rot: [345, 0, 0], expr: EXPR.hurt, b: tuck as never },
      { t: 0.86, ease: "out", ik: 1, stretch: -0.14, pivot, off: [0, -2.0, 5.5], rot: [360, 0, 0], expr: EXPR.angry, b: { spine: [30, 0, 0], head: [5, 0, 0], armL: [-30, 0, -20], armR: [-30, 0, 20] }, feet: [[0, 0, 0.5], [0, 0, -0.5]] },
      { t: 1, ease: "io", ik: 1, pivot, off: [0, 0, 5.5], rot: [360, 0, 0], b: {} },
    ],
  };
}

/** Hurt: snap away from the hit (squash, flash), arms flung, recover. */
export const HURT: Clip = {
  name: "hurt",
  keys: [
    { t: 0, flash: 1, expr: EXPR.hurt, stretch: -0.2, off: [0, -0.8, -2.2], b: { spine: [-26, 0, 8], chest: [-18, 0, 6], head: [-24, 10, -12], armL: [-30, 0, -40], armR: [-30, 0, 40], foreL: [-40, 0, 0], foreR: [-40, 0, 0], earL: [40, 0, 30], earR: [40, 0, -30], tail1: [-30, 0, 0] }, feet: [[0, 0, -0.5], [0, 0, -1.5]] },
    { t: 0.18, ease: "step", flash: 0, expr: EXPR.hurt, stretch: 0.08, off: [0, 0.3, -2.6], b: { spine: [-20, 0, 6], chest: [-14, 0, 4], head: [-18, 8, -10], armL: [-36, 0, -34], armR: [-36, 0, 34], foreL: [-50, 0, 0], foreR: [-50, 0, 0], earL: [30, 0, 20], earR: [30, 0, -20] }, feet: [[0, 0, -0.5], [0, 0, -1.5]] },
    { t: 1, ease: "io", expr: EXPR.angry, off: [0, 0, -2.6], b: {}, feet: [[0, 0, -0.5], [0, 0, -1.5]] },
  ],
};

/** Death (u = seconds / DEATH_S): buckle, fall back, bounce, and lie there with the legs in the air. */
export const DEATH_S = 1.1;
export function deathClip(lieY: number): Clip {
  return {
    name: "death",
    keys: [
      { t: 0, flash: 1, expr: EXPR.hurt, stretch: -0.2, b: { spine: [-20, 0, 0], head: [-20, 0, 0], armL: [-30, 0, -40], armR: [-30, 0, 40] } },
      { t: 0.18, ease: "out", expr: EXPR.dead, stretch: -0.1, off: [0, -3, -1], b: { spine: [30, 0, 10], chest: [20, 0, 0], head: [30, 20, 0], armL: [-20, 0, 10], armR: [-20, 0, -10], foreL: [-60, 0, 0], foreR: [-60, 0, 0] }, feet: [[0.5, 0, 0.8], [-0.5, 0, -0.4]] },
      { t: 0.45, ease: "in", expr: EXPR.dead, ik: 0, pivot: 0, off: [0, lieY, -4], rot: [-90, 0, 0], b: { spine: [-5, 0, 0], head: [-20, 30, 0], armL: [-150, 0, 30], armR: [-140, 0, -30], foreL: [-20, 0, 0], foreR: [-20, 0, 0], thighL: [-95, 0, 10], thighR: [-80, 0, -10], shinL: [30, 0, 0], shinR: [50, 0, 0] } },
      { t: 0.56, ease: "out", expr: EXPR.dead, ik: 0, pivot: 0, off: [0, lieY + 1.6, -4.4], rot: [-82, 0, 0], b: { spine: [-5, 0, 0], head: [-20, 30, 0], armL: [-155, 0, 35], armR: [-145, 0, -35], foreL: [-20, 0, 0], foreR: [-20, 0, 0], thighL: [-105, 0, 14], thighR: [-90, 0, -14], shinL: [25, 0, 0], shinR: [45, 0, 0] } },
      { t: 0.7, ease: "in", expr: EXPR.dead, ik: 0, pivot: 0, off: [0, lieY, -4.6], rot: [-90, 0, 0], b: { spine: [-5, 0, 0], head: [-24, 34, 0], armL: [-160, 0, 40], armR: [-150, 0, -40], foreL: [-15, 0, 0], foreR: [-15, 0, 0], thighL: [-100, 0, 12], thighR: [-88, 0, -12], shinL: [30, 0, 0], shinR: [50, 0, 0] } },
      { t: 1, ease: "out", expr: EXPR.dead, ik: 0, pivot: 0, off: [0, lieY, -4.6], rot: [-90, 0, 0], b: { spine: [-5, 0, 0], head: [-24, 34, 0], armL: [-165, 0, 45], armR: [-155, 0, -45], foreL: [-10, 0, 0], foreR: [-10, 0, 0], thighL: [-92, 0, 10], thighR: [-82, 0, -10], shinL: [20, 0, 0], shinR: [35, 0, 0] } },
    ],
  };
}
