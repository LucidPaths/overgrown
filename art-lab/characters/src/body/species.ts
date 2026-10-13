// The nine species. Each is a Build (proportions) plus a head and features sculpted with the same primitives.
// Rule: with the colour removed, the silhouette alone must name the species (see DIRECTION.md).
import { Op, alongY, euler, type Model, type V3 } from "../sdf/model";
import { B } from "../rig/skeleton";
import { add, joints, lerpV, refreshSkeleton, scaleV, sculptBase, sub, type Build, type Joints } from "./build";
import { M, mat, hex, type MatDef, type RGB } from "./mats";

/** Face decal parameters (in head space: x left, y up, from the head centre; the eyes look along +z). */
export interface Face {
  /** eye centre: x offset from the midline, y offset from the head centre */
  eyeX: number;
  eyeY: number;
  /** eye half width, half height */
  eyeW: number;
  eyeH: number;
  /** tilt of the eye's outer corner, rad (+ = up: foxy) */
  eyeTilt: number;
  /** iris colour; 0 alpha = all-dark eyes */
  iris: RGB;
  /** pupil: 0 round, 1 vertical slit */
  slit: number;
  /** brow: thickness (0 = none), height above the eye */
  brow: number;
  browY: number;
  /** mouth: y below the head centre, half width (0 = none: the snout carries it) */
  mouthY: number;
  mouthW: number;
  /** the projection axis tilts down by this much (eyes on a snouted head look slightly down the snout) */
  faceZ: number;
}

export interface SpeciesDef {
  name: string;
  build: Build;
  face: Face;
  palette: Partial<Record<number, MatDef>>;
  /** adds head, ears, snout, tail, hair, body markings to the base */
  sculpt(m: Model, b: Build, j: Joints): void;
  /** how it moves (see anim/clips.ts) */
  gait?: Partial<import("../anim/clips").Gait>;
  /** ear and tail joint placement (called before the skeleton frames are final) */
  place?(j: Joints, b: Build): void;
}

const SKIN_TONES = [0xf2c4a0, 0xd9a07a, 0xa8714e, 0x7a4b32];

export const HUMAN: SpeciesDef = {
  name: "human",
  build: {
    hip: 12.2, knee: 0.5, digi: false, torso: 9.4, neck: 1.0,
    head: [4.75, 4.95, 4.6], headUp: 4.6, headFwd: 0.45,
    shoulderW: 4.4, hipW: 2.1,
    chest: [4.4, 3.6, 3.0], belly: [3.3, 3.1, 2.6], pelvis: [3.6, 2.6, 2.8],
    arm: 5.2, fore: 4.6, hand: 2.8,
    armR: [1.5, 1.15, 1.0], legR: [2.0, 1.4, 1.1], handR: [1.45, 1.7, 0.95],
    footLen: 5.4, footW: 1.6, lean: 0.03, aPose: 0.62, tail: null,
  },
  face: {
    eyeX: 1.85, eyeY: -0.35, eyeW: 0.78, eyeH: 1.12, eyeTilt: 0.0, iris: [0.3, 0.5, 0.72], slit: 0,
    brow: 0.3, browY: 1.55, mouthY: -2.75, mouthW: 0.85, faceZ: 0,
  },
  palette: {
    [M.skin]: mat(SKIN_TONES[0]!, "skin"),
    [M.hair]: mat(0x5a3422, "fur"),
    [M.inner]: mat(0xd9897a, "skin"),
  },
  sculpt(m, b, j) {
    const h = j.headC;
    const R = b.head;
    // cranium and a softer jaw: the head narrows to the chin, cheeks stay round
    m.ellipsoid(h, R, { mat: M.skin, bone: B.head, k: 1.2, ks: 1.6 });
    m.ellipsoid(add(h, [0, -R[1] * 0.42, R[2] * 0.18]), [R[0] * 0.82, R[1] * 0.55, R[2] * 0.72], { mat: M.skin, bone: B.head, k: 1.6 });
    // nose: a small soft wedge
    m.ellipsoid(add(h, [0, -R[1] * 0.2, R[2] * 0.95]), [0.62, 0.78, 0.62], { mat: M.skin, bone: B.head, k: 0.5 });
    // ears
    for (const s of [1, -1]) {
      m.ellipsoid(add(h, [s * R[0] * 0.95, -R[1] * 0.08, -R[2] * 0.08]), [0.55, 1.15, 0.85], { mat: M.skin, bone: B.head, k: 0.5, rot: euler(s * 0.3) });
    }
    hairCap(m, b, j, "tousled");
  },
};

/** Hair as a solid layer: a crisp hairline, volume on the crown and back, a fringe that frames the face. */
export function hairCap(m: Model, b: Build, j: Joints, style: "tousled" | "long" | "bun" | "braid" | "shaved"): void {
  if (style === "shaved") return;
  const h = j.headC;
  const R = b.head;
  const L = m.beginSolid();
  void L;
  const o = { mat: M.hair, bone: B.head };
  // the main mass: a slightly larger cranium pushed back and up, cut away from the face below the brow
  m.ellipsoid(add(h, [0, R[1] * 0.18, -R[2] * 0.1]), [R[0] * 1.1, R[1] * 0.92, R[2] * 1.06], { ...o });
  // face window: carve the front below the fringe line
  m.box(add(h, [0, -R[1] * 0.55, R[2] * 0.9]), [R[0] * 0.92, R[1] * 0.9, R[2] * 0.9], 0.8, { ...o, op: Op.Subtract, k: 0.6 });
  // carve the lower back of the head unless the hair is long
  if (style !== "long" && style !== "braid") m.box(add(h, [0, -R[1] * 1.15, -R[2] * 0.2]), [R[0] * 1.4, R[1] * 0.75, R[2] * 1.4], 0.5, { ...o, op: Op.Subtract, k: 0.8 });
  // fringe locks: three soft wedges over the brow
  for (const [x, rot, len] of [[-1.6, 0.35, 1.0], [0.2, -0.1, 1.15], [1.9, -0.45, 0.9]] as const) {
    m.ellipsoid(add(h, [x, R[1] * 0.55, R[2] * 0.72]), [1.6, 1.2 * len, 0.9], { ...o, k: 0.6, rot: euler(0, -0.5, rot) });
  }
  if (style === "tousled") {
    // a cowlick and side tufts break the helmet
    m.ellipsoid(add(h, [-1.2, R[1] * 0.95, -0.8]), [1.2, 1.0, 1.4], { ...o, k: 0.7, rot: euler(0.4, 0.3, 0.5) });
    for (const s of [1, -1]) m.ellipsoid(add(h, [s * R[0] * 1.0, -R[1] * 0.1, -R[2] * 0.15]), [0.8, 1.5, 1.4], { ...o, k: 0.6 });
  }
  if (style === "long") {
    m.ellipsoid(add(h, [0, -R[1] * 0.7, -R[2] * 0.62]), [R[0] * 1.02, R[1] * 1.15, R[2] * 0.55], { ...o, k: 1.2 });
    for (const s of [1, -1]) m.ellipsoid(add(h, [s * R[0] * 0.95, -R[1] * 0.55, R[2] * 0.0]), [0.9, R[1] * 0.85, 1.4], { ...o, k: 0.8 });
  }
  if (style === "bun") m.sphere(add(h, [0, R[1] * 0.85, -R[2] * 0.75]), 1.9, { ...o, k: 0.6 });
  if (style === "braid") {
    for (let i = 0; i < 4; i++) m.sphere(add(h, [0, -R[1] * 0.6 - i * 1.6, -R[2] * 0.95 - i * 0.25]), 1.15 - i * 0.12, { ...o, k: 0.3, bone: i < 1 ? B.head : B.chest });
  }
  m.useLayer(0);
}


/** A flat ear: a tapered cone pressed thin by a slab, with a painted inside and an optional coloured tip. */
export function flatEar(m: Model, base: V3, tip: V3, r0: number, r1: number, thick: number, bone: number, mat: number, inner: number, tipMat = -1, tipFrac = 0.3, cup = 0.0): void {
  const d = sub(tip, base);
  const rot = alongY(d, [0, 0.35, 1]);
  m.group((g) => {
    g.cone(base, tip, r0, r1, { bone, mat });
    // a slab through the ear's plane keeps it flat (local z = the ear's facing)
    const c = lerpV(base, tip, 0.5);
    g.box(c, [r0 * 2.2, Math.hypot(...d), thick], 0, { bone, mat, op: Op.Intersect, k: 0.25, rot });
    if (cup > 0) g.ellipsoid(add(lerpV(base, tip, 0.45), scaleV([rot[6], rot[7], rot[8]], thick * 1.3)), [r0 * 0.6, Math.hypot(...d) * 0.42, thick], { bone, mat, op: Op.Subtract, k: 0.3, rot });
  }, { bone, mat, k: 0.7, ks: 1.2 });
  // inner ear: paint on the front face
  const fwd: V3 = [rot[6], rot[7], rot[8]];
  m.ellipsoid(add(lerpV(base, tip, 0.42), scaleV(fwd, thick * 0.9)), [r0 * 0.55, Math.hypot(...d) * 0.4, thick * 0.9], { bone, mat: inner, op: Op.Paint, k: 0.12, rot });
  if (tipMat >= 0) m.sphere(tip, Math.hypot(...d) * tipFrac + r1, { bone, mat: tipMat, op: Op.Paint, k: 0.1 });
}

/** Places ear joints (base and mid) and points their frames along the ear. */
function placeEars(j: Joints, base: V3, tip: V3): void {
  const P = j.pos;
  for (const [e, e2, s] of [[B.earL, B.earL2, 1], [B.earR, B.earR2, -1]] as const) {
    const b0: V3 = [base[0] * s, base[1], base[2]], t0: V3 = [tip[0] * s, tip[1], tip[2]];
    P[e] = b0;
    P[e2] = lerpV(b0, t0, 0.5);
  }
  refreshSkeleton(j, {
    [B.earL]: sub([tip[0], tip[1], tip[2]], base), [B.earL2]: sub([tip[0], tip[1], tip[2]], base),
    [B.earR]: sub([-tip[0], tip[1], tip[2]], [-base[0], base[1], base[2]]), [B.earR2]: sub([-tip[0], tip[1], tip[2]], [-base[0], base[1], base[2]]),
  });
}

/** Tail joints along a curve given as points (root first); frames point back toward the root. */
function placeTail(j: Joints, pts: V3[]): void {
  const dirs: Record<number, V3> = {};
  for (let i = 0; i < 4; i++) {
    j.pos[B.tail1 + i] = pts[i]!;
    dirs[B.tail1 + i] = sub(pts[i]!, pts[i + 1]!);
  }
  refreshSkeleton(j, dirs);
}

const FOX_BUILD: Build = {
  hip: 12.8, knee: 0.64, digi: true, torso: 9.2, neck: 1.6,
  head: [4.0, 3.9, 3.9], headUp: 3.9, headFwd: 0.5,
  shoulderW: 3.8, hipW: 1.95,
  chest: [3.7, 3.4, 2.8], belly: [3.0, 2.9, 2.5], pelvis: [3.3, 2.5, 2.7],
  arm: 5.1, fore: 4.6, hand: 2.3,
  armR: [1.3, 1.0, 0.85], legR: [2.2, 1.25, 0.8], handR: [1.15, 1.4, 0.8],
  footLen: 6.4, footW: 1.25, lean: 0.07, aPose: 0.62, tail: { len: 14, r0: 1.6, r1: 3.6, up: 0.9 },
};

export const FOX: SpeciesDef = {
  name: "foxfolk",
  build: FOX_BUILD,
  face: {
    eyeX: 1.55, eyeY: 0.55, eyeW: 0.62, eyeH: 0.82, eyeTilt: 0.32, iris: [0.86, 0.6, 0.18], slit: 0,
    brow: 0.0, browY: 1.5, mouthY: -9, mouthW: 0, faceZ: 0,
  },
  palette: {
    [M.skin]: mat(0xe0702a, "fur"),
    [M.skin2]: mat(0xfbf1e2, "fur"),
    [M.mark]: mat(0x3a2626, "fur"),
    [M.inner]: mat(0x3a2626, "fur"),
  },
  place(j, b) {
    const h = j.headC, R = b.head;
    placeEars(j, [R[0] * 0.5, h[1] + R[1] * 0.62, h[2] - 0.4], [R[0] * 0.95, h[1] + R[1] * 0.62 + 5.6, h[2] - 0.9]);
    const t0 = j.pos[B.tail1]!;
    placeTail(j, [t0, add(t0, [0, -1.8, -3.2]), add(t0, [0, -1.4, -7.0]), add(t0, [0, 0.6, -10.4]), add(t0, [0, 3.2, -12.6])]);
  },
  sculpt(m, b, j) {
    const h = j.headC, R = b.head;
    const o = { mat: M.skin, bone: B.head };
    m.ellipsoid(h, R, { ...o, k: 1.2 });
    // cheek ruff: fluff that points out and down, the fox's jaw line
    for (const s of [1, -1]) m.ellipsoid(add(h, [s * R[0] * 0.72, -R[1] * 0.42, R[2] * 0.05]), [1.8, 1.5, 1.9], { ...o, k: 1.0, rot: euler(0, 0, s * 0.6) });
    // the snout: long and narrow, slightly down
    const sb = add(h, [0, -R[1] * 0.3, R[2] * 0.55]);
    const st = add(h, [0, -R[1] * 0.52, R[2] + 4.0]);
    m.cone(sb, st, 1.9, 0.62, { ...o, k: 1.2 });
    m.sphere(add(st, [0, 0.25, 0.3]), 0.72, { mat: M.dark, bone: B.head, k: 0.25 });
    // white muzzle, cheeks and chest blaze (paint)
    m.ellipsoid(add(h, [0, -R[1] * 0.78, R[2] * 0.62]), [R[0] * 0.95, 1.6, 3.9], { mat: M.skin2, bone: B.head, op: Op.Paint, k: 0.25 });
    for (const s of [1, -1]) m.ellipsoid(add(h, [s * R[0] * 0.78, -R[1] * 0.62, R[2] * 0.1]), [1.6, 1.35, 1.8], { mat: M.skin2, bone: B.head, op: Op.Paint, k: 0.2 });
    m.ellipsoid(add(j.pos[B.chest]!, [0, 0.5, b.chest[2] * 0.85]), [1.9, 3.6, 1.6], { mat: M.skin2, bone: B.chest, op: Op.Paint, k: 0.3 });
    // ears: tall triangles, dark tips, dark insides
    for (const [e, e2] of [[B.earL, B.earL2], [B.earR, B.earR2]] as const) {
      const base = j.pos[e]!, mid = j.pos[e2]!;
      const tip = add(base, scaleV(sub(mid, base), 2));
      flatEar(m, base, tip, 1.95, 0.3, 0.95, e, M.skin, M.inner, M.mark, 0.22, 0.4);
    }
    // dark socks and gloves
    for (const f of [B.footL, B.footR]) m.ellipsoid(j.pos[f]!, [2.2, 4.4, 2.2], { mat: M.mark, bone: f, op: Op.Paint, k: 0.4 });
    for (const f of [B.toeL, B.toeR]) m.sphere(add(j.pos[f]!, [0, 0, 1.2]), 3.2, { mat: M.mark, bone: f, op: Op.Paint, k: 0.2 });
    for (const hd of [B.handL, B.handR]) m.sphere(j.pos[hd]!, 2.6, { mat: M.mark, bone: hd, op: Op.Paint, k: 0.3 });
    // the tail: the fox's biggest shape, a bushy brush with a white tip
    const T = [0, 1, 2, 3].map((i) => j.pos[B.tail1 + i]!);
    const tipP = add(T[3]!, [0, 2.0, -1.4]);
    const radii = [1.5, 2.6, 3.3, 2.9];
    for (let i = 0; i < 4; i++) {
      const a = T[i]!, bb = i < 3 ? T[i + 1]! : tipP;
      m.ellipsoid(lerpV(a, bb, 0.55), [radii[i]!, radii[i]! * 1.02, Math.hypot(...sub(bb, a)) * 0.75 + radii[i]! * 0.5], { mat: M.skin, bone: B.tail1 + i, k: 1.6, ks: 2.5, rot: alongY(sub(bb, a), [0, 1, 0]) as never });
    }
    m.ellipsoid(add(tipP, [0, -0.4, 0.3]), [2.3, 2.6, 2.3], { mat: M.skin2, bone: B.tail4, k: 1.2 });
    m.sphere(tipP, 2.9, { mat: M.skin2, bone: B.tail4, op: Op.Paint, k: 0.3 });
  },
};

export const BEAR: SpeciesDef = {
  name: "bearfolk",
  build: {
    hip: 11.2, knee: 0.5, digi: false, torso: 12.4, neck: 0.7,
    head: [5.1, 4.7, 4.8], headUp: 3.7, headFwd: 0.9,
    shoulderW: 5.9, hipW: 2.9,
    chest: [6.0, 4.8, 4.3], belly: [6.1, 5.1, 5.1], pelvis: [5.2, 3.6, 4.1],
    arm: 5.6, fore: 5.1, hand: 2.9,
    armR: [2.5, 2.1, 1.8], legR: [3.0, 2.5, 2.1], handR: [1.9, 2.1, 1.4],
    footLen: 6.6, footW: 2.3, lean: 0.1, aPose: 0.72, tail: { len: 2, r0: 1.4, r1: 1.0, up: 0.3 },
  },
  face: {
    eyeX: 2.0, eyeY: 0.8, eyeW: 0.52, eyeH: 0.62, eyeTilt: 0.0, iris: [0, 0, 0], slit: 0,
    brow: 0.0, browY: 1.5, mouthY: -9, mouthW: 0, faceZ: 0,
  },
  palette: {
    [M.skin]: mat(0x8a5634, "fur"),
    [M.skin2]: mat(0xd8b088, "fur"),
    [M.inner]: mat(0xd8b088, "fur"),
  },
  place(j, b) {
    const h = j.headC, R = b.head;
    placeEars(j, [R[0] * 0.66, h[1] + R[1] * 0.72, h[2] - 0.6], [R[0] * 0.95, h[1] + R[1] * 0.72 + 2.6, h[2] - 0.8]);
  },
  sculpt(m, b, j) {
    const h = j.headC, R = b.head;
    const o = { mat: M.skin, bone: B.head };
    m.ellipsoid(h, R, { ...o, k: 1.6 });
    // jowls widen the lower head: a bear's head is broadest at the cheeks
    m.ellipsoid(add(h, [0, -R[1] * 0.3, R[2] * 0.1]), [R[0] * 1.08, R[1] * 0.68, R[2] * 0.85], { ...o, k: 1.6 });
    // short broad muzzle, lighter, with a big dark nose
    const mz = add(h, [0, -R[1] * 0.4, R[2] * 0.82]);
    m.ellipsoid(mz, [2.5, 1.9, 2.3], { mat: M.skin2, bone: B.head, k: 1.0 });
    m.ellipsoid(add(mz, [0, 0.9, 1.9]), [1.15, 0.75, 0.75], { mat: M.dark, bone: B.head, k: 0.4 });
    // small round ears on top, lighter inside
    for (const e of [B.earL, B.earR]) {
      const base = j.pos[e]!;
      const mid = j.pos[e + 1]!;
      m.ellipsoid(add(base, scaleV(sub(mid, base), 0.9)), [1.75, 1.7, 0.95], { mat: M.skin, bone: e, k: 0.8 });
      m.ellipsoid(add(add(base, scaleV(sub(mid, base), 0.9)), [0, 0, 0.7]), [1.0, 1.0, 0.6], { mat: M.inner, bone: e, op: Op.Paint, k: 0.15 });
    }
    // belly patch
    m.ellipsoid(add(j.pos[B.spine]!, [0, 0.5, b.belly[2] * 0.85]), [3.6, 4.6, 1.8], { mat: M.skin2, bone: B.spine, op: Op.Paint, k: 0.4 });
    // stub tail
    m.sphere(j.pos[B.tail1]!, 1.5, { mat: M.skin, bone: B.tail1, k: 0.8 });
    // claws on the hands
    for (const hd of [B.handL, B.handR]) {
      const r = j.sk.rot[hd]!;
      const down: V3 = [-r[3], -r[4], -r[5]], fwd: V3 = [r[6], r[7], r[8]];
      const tip = add(j.pos[hd]!, scaleV(down, b.hand + 0.4));
      for (const s of [-1, 0, 1]) m.cone(add(tip, add(scaleV(fwd, 0.5), [s * 0.6, 0.6, 0])), add(tip, add(scaleV(fwd, 0.9), [s * 0.6, -0.5, 0])), 0.3, 0.12, { mat: M.horn, bone: hd, k: 0.15 });
    }
  },
};

/** Indexed by the sim's Species enum: human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk. */
export const SPECIES: SpeciesDef[] = [HUMAN, HUMAN, HUMAN, HUMAN, FOX, BEAR, HUMAN, HUMAN, HUMAN];

export function buildSpecies(s: SpeciesDef, buildOverride: Partial<Build> = {}): { model: Model; j: Joints; b: Build } {
  const b: Build = { ...s.build, ...buildOverride };
  const j = joints(b);
  s.place?.(j, b);
  const m = sculptBase(b, j);
  s.sculpt(m, b, j);
  return { model: m, j, b };
}

export const DEFAULT_PALETTE: Record<number, MatDef> = {
  [M.skin]: mat(0xf2c4a0, "skin"),
  [M.skin2]: mat(0xf6eee0, "fur"),
  [M.mark]: mat(0x3a2a2a, "fur"),
  [M.hair]: mat(0x5a3422, "fur"),
  [M.cloth1]: mat(0x3d6fae),
  [M.cloth2]: mat(0x6a5a4a),
  [M.leather]: mat(0x8a5a3a, "hard"),
  [M.metal]: mat(0xc8ccd8, "metal", 1),
  [M.wood]: mat(0x8a6040, "hard"),
  [M.boot]: mat(0x4a3428, "hard"),
  [M.horn]: mat(0xe8dcc0, "hard", 2),
  [M.dark]: mat(0x2a2028, "hard", 2),
  [M.gold]: mat(0xe0b040, "metal", 1),
  [M.inner]: mat(0xe89a9a, "skin"),
  [M.scar]: mat(0xe8b0a0, "skin"),
  [M.glow]: { lit: hex(0x9ff0ff), shade: hex(0x9ff0ff), kind: 3 },
};

export function paletteOf(s: SpeciesDef, over: Partial<Record<number, MatDef>> = {}): MatDef[] {
  const p: MatDef[] = [];
  for (let i = 0; i < 16; i++) p.push(over[i] ?? s.palette[i] ?? DEFAULT_PALETTE[i]!);
  return p;
}

export type { V3 };
