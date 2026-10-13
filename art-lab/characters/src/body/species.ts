// The nine species. Each is a Build (proportions) plus a head and features sculpted with the same primitives.
// Rule: with the colour removed, the silhouette alone must name the species (see DIRECTION.md).
import { Op, euler, type Model, type V3 } from "../sdf/model";
import { B } from "../rig/skeleton";
import { add, joints, sculptBase, type Build, type Joints } from "./build";
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
  /** ear and tail joint placement (called before the skeleton frames are final) */
  place?(j: Joints, b: Build): void;
}

const SKIN_TONES = [0xf2c4a0, 0xd9a07a, 0xa8714e, 0x7a4b32];

export const HUMAN: SpeciesDef = {
  name: "human",
  build: {
    hip: 12.6, knee: 0.5, digi: false, torso: 9.6, neck: 1.3,
    head: [4.5, 4.9, 4.6], headUp: 4.5, headFwd: 0.4,
    shoulderW: 4.3, hipW: 2.15,
    chest: [4.3, 3.5, 3.0], belly: [3.6, 3.1, 2.7], pelvis: [3.7, 2.6, 2.8],
    arm: 5.3, fore: 4.7, hand: 2.6,
    armR: [1.5, 1.2, 1.0], legR: [2.05, 1.45, 1.1], handR: [1.3, 1.55, 0.85],
    footLen: 5.0, footW: 1.5, lean: 0.04, aPose: 0.62, tail: null,
  },
  face: {
    eyeX: 1.75, eyeY: 0.1, eyeW: 0.62, eyeH: 0.95, eyeTilt: 0.0, iris: [0.25, 0.42, 0.62], slit: 0,
    brow: 0.32, browY: 1.55, mouthY: -2.35, mouthW: 0.9, faceZ: 0,
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

export const SPECIES: SpeciesDef[] = [HUMAN];

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
  [M.cloth2]: mat(0xe2d8bf),
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
