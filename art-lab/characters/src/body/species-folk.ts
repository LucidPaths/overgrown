// The "folk": human, elf, dwarf, orc. One body plan, four silhouettes: the human is the baseline; the elf is
// long-legged and narrow with ears that reach sideways past the shoulders (they read from straight above); the
// dwarf is half a human tall and twice as wide, a beard where the chest should be; the orc is the biggest
// upper body in the game, hunched, head low and forward, tusks.
import { Op, euler } from "../sdf/model";
import { B } from "../rig/skeleton";
import { add, refreshSkeleton, type Build, type Joints } from "./build";
import { beard, flatEar, hair, placeEars } from "./features";
import { M, mat } from "./mats";
import type { SpeciesDef } from "./species";
import type { Model } from "../sdf/model";

export const SKIN_TONES = [0xf2c4a0, 0xe0a882, 0xb87a56, 0x8a5a3e, 0x5e3a2a];
export const HAIR_COLOURS = [0x5a3422, 0x2a2024, 0xb8742e, 0xe0c27a, 0x8a3a22, 0xd8d0c4];

/** A small soft nose, cheeks and ears: the folk face. */
function folkHead(m: Model, b: Build, j: Joints, nose: number, earSize: number): void {
  const h = j.headC, R = b.head;
  const o = { mat: M.skin, bone: B.head };
  // cranium, a softer jaw that narrows to the chin, round cheeks
  m.ellipsoid(h, R, { ...o, k: 1.2, ks: 1.6 });
  m.ellipsoid(add(h, [0, -R[1] * 0.42, R[2] * 0.18]), [R[0] * 0.8, R[1] * 0.55, R[2] * 0.72], { ...o, k: 1.6 });
  m.ellipsoid(add(h, [0, -R[1] * 0.2, R[2] * 0.95]), [0.55 * nose, 0.72 * nose, 0.6 * nose], { ...o, k: 0.5 });
  if (earSize > 0) {
    for (const s of [1, -1]) m.ellipsoid(add(h, [s * R[0] * 0.96, -R[1] * 0.1, -R[2] * 0.06]), [0.5 * earSize, 1.1 * earSize, 0.8 * earSize], { ...o, k: 0.5, rot: euler(s * 0.3) });
  }
}

const FOLK_FACE = {
  eyeX: 1.8, eyeY: -0.35, eyeW: 0.78, eyeH: 1.1, eyeTilt: 0.0, iris: [0.3, 0.5, 0.72] as [number, number, number], slit: 0,
  brow: 0.3, browY: 1.55, mouthY: -2.75, mouthW: 0.85, faceZ: 0,
};

export const HUMAN: SpeciesDef = {
  name: "human",
  build: {
    hip: 10.6, knee: 0.5, digi: false, torso: 9.0, neck: 0.6,
    head: [4.6, 4.8, 4.4], headUp: 4.5, headFwd: 0.5,
    shoulderW: 4.6, hipW: 1.9,
    chest: [4.5, 3.7, 3.1], belly: [3.5, 2.8, 2.7], pelvis: [3.8, 2.7, 2.9],
    arm: 4.4, fore: 4.0, hand: 3.0,
    armR: [1.4, 1.15, 1.0], legR: [2.0, 1.45, 1.0], handR: [1.75, 1.95, 1.2],
    footLen: 6.0, footW: 1.85, lean: 0.04, aPose: 0.6, tail: null,
  },
  face: FOLK_FACE,
  palette: {
    [M.skin]: mat(SKIN_TONES[0]!, "skin"),
    [M.hair]: mat(HAIR_COLOURS[0]!, "fur", 4),
    [M.inner]: mat(0xd9897a, "skin"),
  },
  variants: SKIN_TONES.flatMap((s, i) => [{ [M.skin]: mat(s, "skin"), [M.hair]: mat(HAIR_COLOURS[(i * 2) % HAIR_COLOURS.length]!, "fur", 4) }]),
  hair: "tousled",
  sculpt(m, b, j, o) {
    folkHead(m, b, j, 1, 1);
    hair(m, b, j, o.hair ?? "tousled");
    if (o.beard) beard(m, b, j, o.beard);
  },
};

export const ELF: SpeciesDef = {
  name: "elf",
  build: {
    hip: 12.8, knee: 0.5, digi: false, torso: 9.6, neck: 1.0,
    head: [4.2, 4.7, 4.2], headUp: 4.5, headFwd: 0.4,
    shoulderW: 4.0, hipW: 1.7,
    chest: [3.9, 3.5, 2.7], belly: [3.0, 2.7, 2.4], pelvis: [3.4, 2.6, 2.6],
    arm: 5.0, fore: 4.6, hand: 3.0,
    armR: [1.2, 1.0, 0.85], legR: [1.75, 1.25, 0.85], handR: [1.5, 1.85, 1.05],
    footLen: 6.2, footW: 1.6, lean: -0.02, aPose: 0.58, tail: null,
  },
  face: { ...FOLK_FACE, eyeX: 1.65, eyeY: -0.25, eyeW: 0.82, eyeH: 0.95, eyeTilt: 0.22, iris: [0.36, 0.66, 0.42], brow: 0.22, browY: 1.45, mouthW: 0.7 },
  palette: {
    [M.skin]: mat(0xf4d6bc, "skin"),
    [M.hair]: mat(0xe8dca8, "fur", 4),
    [M.inner]: mat(0xe0a090, "skin"),
  },
  variants: [
    { [M.skin]: mat(0xf4d6bc, "skin"), [M.hair]: mat(0xe8dca8, "fur", 4) },
    { [M.skin]: mat(0xc89a7c, "skin"), [M.hair]: mat(0x2c2a3a, "fur", 4) },
    { [M.skin]: mat(0xe8c4b0, "skin"), [M.hair]: mat(0xd6d8e0, "fur", 4) },
    { [M.skin]: mat(0x9a7a8a, "skin"), [M.hair]: mat(0xf0f0f4, "fur", 4) },
  ],
  hair: "long",
  place(j, b) {
    const h = j.headC, R = b.head;
    // ears sweep out and back, a little up: wider than the shoulders from above
    placeEars(j, [R[0] * 0.86, h[1] - R[1] * 0.02, h[2] - 0.5], [R[0] * 0.86 + 5.6, h[1] + R[1] * 0.42, h[2] - 2.6], refreshSkeleton);
  },
  sculpt(m, b, j, o) {
    folkHead(m, b, j, 0.85, 0);
    for (const [e, e2] of [[B.earL, B.earL2], [B.earR, B.earR2]] as const) {
      const base = j.pos[e]!, mid = j.pos[e2]!;
      const tip = add(base, [(mid[0] - base[0]) * 2, (mid[1] - base[1]) * 2, (mid[2] - base[2]) * 2]);
      flatEar(m, base, tip, 1.15, 0.12, 0.6, e, M.skin, M.inner, -1, 0, 0.2, [0, 1, 0.5]);
    }
    hair(m, b, j, o.hair ?? "long");
  },
  gait: { stride: 1.45, bounce: 0.8, sway: 0.05 },
};

export const DWARF: SpeciesDef = {
  name: "dwarf",
  build: {
    hip: 6.8, knee: 0.5, digi: false, torso: 8.6, neck: 0.2,
    head: [4.7, 4.6, 4.5], headUp: 4.0, headFwd: 0.8,
    shoulderW: 5.8, hipW: 2.4,
    chest: [5.5, 4.2, 4.0], belly: [5.2, 3.8, 4.2], pelvis: [4.7, 2.9, 3.6],
    arm: 4.0, fore: 3.8, hand: 3.2,
    armR: [1.95, 1.65, 1.4], legR: [2.4, 1.9, 1.4], handR: [2.1, 2.25, 1.5],
    footLen: 6.4, footW: 2.3, lean: 0.06, aPose: 0.72, tail: null,
  },
  face: { ...FOLK_FACE, eyeX: 1.7, eyeY: 0.0, eyeW: 0.6, eyeH: 0.72, iris: [0.28, 0.4, 0.6], brow: 0.0, browY: 1.2, mouthY: -9, mouthW: 0 },
  palette: {
    [M.skin]: mat(0xe8a888, "skin"),
    [M.hair]: mat(0xb8542a, "fur", 4),
    [M.inner]: mat(0xd9897a, "skin"),
  },
  variants: [
    { [M.skin]: mat(0xe8a888, "skin"), [M.hair]: mat(0xb8542a, "fur", 4) },
    { [M.skin]: mat(0xc88a6a, "skin"), [M.hair]: mat(0x3a2a24, "fur", 4) },
    { [M.skin]: mat(0xf0b898, "skin"), [M.hair]: mat(0xd8d2c8, "fur", 4) },
    { [M.skin]: mat(0x9a6a4e, "skin"), [M.hair]: mat(0x8a5030, "fur", 4) },
  ],
  hair: "crop",
  sculpt(m, b, j, o) {
    const h = j.headC, R = b.head;
    folkHead(m, b, j, 0, 0.9);
    // the nose: a big soft bulb, the dwarf's whole face
    m.sphere(add(h, [0, -R[1] * 0.12, R[2] * 0.98]), 1.35, { mat: M.skin, bone: B.head, k: 0.6 });
    // a heavy brow of hair over small eyes
    m.beginSolid();
    for (const s of [1, -1]) m.cone(add(h, [s * 0.5, R[1] * 0.3, R[2] * 0.9]), add(h, [s * 3.0, R[1] * 0.42, R[2] * 0.62]), 0.75, 0.45, { mat: M.hair, bone: B.head, k: 0.3 });
    m.useLayer(0);
    hair(m, b, j, o.hair ?? "crop");
    beard(m, b, j, o.beard ?? 7.5);
  },
  gait: { stride: 1.6, bounce: 0.9, swing: 0.6, sway: 0.12, width: 1.05 },
};

export const ORC: SpeciesDef = {
  name: "orc",
  build: {
    hip: 11.2, knee: 0.5, digi: false, torso: 10.8, neck: 0.0,
    head: [4.3, 4.2, 4.3], headUp: 3.0, headFwd: 2.0,
    shoulderW: 6.6, hipW: 2.3,
    chest: [6.2, 4.6, 4.2], belly: [4.6, 3.3, 3.6], pelvis: [4.3, 2.9, 3.3],
    arm: 5.4, fore: 5.0, hand: 3.4,
    armR: [2.35, 2.0, 1.6], legR: [2.5, 1.85, 1.35], handR: [2.35, 2.5, 1.6],
    footLen: 6.8, footW: 2.3, lean: 0.24, aPose: 0.62, tail: null,
  },
  face: { ...FOLK_FACE, eyeX: 1.75, eyeY: 0.35, eyeW: 0.62, eyeH: 0.62, iris: [0.95, 0.75, 0.25], brow: 0.0, mouthY: -9, mouthW: 0 },
  palette: {
    [M.skin]: mat(0x7d9a5a, "skin"),
    [M.hair]: mat(0x2a2224, "fur", 4),
    [M.horn]: mat(0xf0e6c8, "hard", 2),
    [M.inner]: mat(0x6a4a44, "skin"),
  },
  variants: [
    { [M.skin]: mat(0x7d9a5a, "skin") },
    { [M.skin]: mat(0x8a9a8a, "skin") },
    { [M.skin]: mat(0x5f7a52, "skin") },
    { [M.skin]: mat(0xa09060, "skin"), [M.hair]: mat(0x6a2a1e, "fur", 4) },
  ],
  hair: "mohawk",
  place(j, b) {
    const h = j.headC, R = b.head;
    placeEars(j, [R[0] * 0.9, h[1] + R[1] * 0.05, h[2] - 0.6], [R[0] * 0.9 + 2.8, h[1] + R[1] * 0.35, h[2] - 1.6], refreshSkeleton);
  },
  sculpt(m, b, j, o) {
    const h = j.headC, R = b.head;
    const sk = { mat: M.skin, bone: B.head };
    m.ellipsoid(h, R, { ...sk, k: 1.2 });
    // the jaw: wider than the skull, an underbite
    m.ellipsoid(add(h, [0, -R[1] * 0.5, R[2] * 0.32]), [R[0] * 1.05, R[1] * 0.58, R[2] * 0.8], { ...sk, k: 1.4 });
    // the brow ridge, a flat broad nose
    m.ellipsoid(add(h, [0, R[1] * 0.18, R[2] * 0.8]), [R[0] * 0.86, 0.95, 1.2], { ...sk, k: 0.8 });
    m.ellipsoid(add(h, [0, -R[1] * 0.12, R[2] * 0.98]), [1.1, 0.8, 0.8], { ...sk, k: 0.5 });
    // tusks out of the lower jaw
    for (const s of [1, -1]) m.cone(add(h, [s * 1.5, -R[1] * 0.62, R[2] * 0.9]), add(h, [s * 2.0, -R[1] * 0.05, R[2] * 1.12]), 0.62, 0.16, { mat: M.horn, bone: B.head, k: 0.25 });
    // small pointed ears out to the side
    for (const [e, e2] of [[B.earL, B.earL2], [B.earR, B.earR2]] as const) {
      const base = j.pos[e]!, mid = j.pos[e2]!;
      const tip = add(base, [(mid[0] - base[0]) * 2, (mid[1] - base[1]) * 2, (mid[2] - base[2]) * 2]);
      flatEar(m, base, tip, 1.2, 0.15, 0.7, e, M.skin, M.inner, -1, 0, 0.2, [0, 0.8, 0.6]);
    }
    // a scarred, lumpy back: two muscle humps the hunch shows off
    for (const s of [1, -1]) m.ellipsoid(add(j.pos[B.chest]!, [s * 2.4, 1.6, -b.chest[2] * 0.55]), [2.4, 2.2, 1.8], { mat: M.skin, bone: B.chest, k: 1.6 });
    hair(m, b, j, o.hair ?? "mohawk");
    if (o.beard) beard(m, b, j, o.beard);
    void Op;
  },
  gait: { stride: 1.3, bounce: 1.3, swing: 0.55, elbow: 1.0, lean: 0.12, sway: 0.14, width: 1.15 },
};
