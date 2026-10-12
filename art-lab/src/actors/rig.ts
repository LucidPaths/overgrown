// Character meshes: one shared skeleton, rigid parts (each vertex belongs to exactly one bone).
// The character faces +z in its own space; its left is +x. Units are world px. Feet point = origin.
import { Geo, MAT, hex, mixc, shade, type RGB } from "../geo/builder";
import { compose } from "../gl/math";
import { DYES, SPECIES, TROUSERS, type SpeciesDef } from "./species";

export const BONE = { root: 0, hips: 1, torso: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7, tail1: 8, tail2: 9, earL: 10, earR: 11, weapon: 12 } as const;
export const BONES = 13;
export const PARENT = [-1, 0, 1, 2, 2, 2, 1, 1, 1, 8, 3, 3, 5];

export type Weapon = "none" | "sword" | "axe" | "spear" | "dagger";

export interface Rig {
  species: SpeciesDef;
  /** Rest pivot of each bone in its parent's space. */
  rest: [number, number, number][];
  geo: Geo;
  /** head centre height above the head pivot, head radius */
  headC: number;
  tailLen: number;
  weapon: Weapon;
  /** height of the top of the head above the feet, for labels and cutaways */
  height: number;
}

const EYE = hex(0x221a2c);
const BOOT = hex(0x4a3428);
const STEEL = hex(0xd8dde8), STEEL_D = hex(0x9aa2b4), GRIP = hex(0x5a3a2a), GOLD = hex(0xd8a83a);

export function buildRig(speciesIndex: number, dye: number, weapon: Weapon, trousers = 0): Rig {
  const s = SPECIES[speciesIndex]!;
  const g = new Geo();
  const R = s.head;
  const headC = R * 0.86;
  const cloth = DYES[dye % DYES.length]!;
  const pants = TROUSERS[trousers % TROUSERS.length]!;
  const furred = s.snout !== "none" && s.snout !== "tusks";
  const st = (col: RGB, bone: number, mat: number = MAT.Actor) => ({ col, bone, mat });

  // --- legs (bone-local: pivot at hip, leg hangs to -leg) ---
  const hipX = s.width * 0.45;
  for (const [bone, side] of [[BONE.legL, 1], [BONE.legR, -1]] as const) {
    void side;
    const footCol = s.feet ?? (furred ? shade(s.skin, 0.8) : BOOT);
    g.cylinder(compose(0, -s.leg + 1.6, 0), 5, s.limb, s.limb * 1.05, s.leg - 1.2, (i) => st(i === 1 ? shade(pants, 0.9) : pants, bone), false);
    if (s.feet && (s.tail === "bird")) {
      // bird feet: three toes
      for (const a of [-0.5, 0, 0.5]) g.box(compose(Math.sin(a) * 1.2, -s.leg, Math.cos(a) * 1.2 + 0.4, a), 0.8, 0.8, 3.2, st(footCol, bone));
    } else {
      g.box(compose(0, -s.leg, 0.6), s.limb * 2.1, 1.9, s.limb * 2 + 2.2, (f) => st(f === 0 ? shade(footCol, 1.15) : footCol, bone));
    }
  }

  // --- torso (pivot at waist) ---
  const tw = s.width, td = s.depth;
  const torsoCol = cloth;
  g.cylinder(compose(0, -1.2, 0, 0, 0, 0, tw, 1, td), 6, 1, 0.82, s.torso + 1.2, (i, top) => st(top ? shade(torsoCol, 1.05) : i === 1 || i === 2 ? shade(torsoCol, 1.0) : torsoCol, BONE.torso), true, 0.5);
  // belt
  g.cylinder(compose(0, 1.2, 0, 0, 0, 0, tw * 1.03, 1, td * 1.05), 6, 1, 1, 1.1, st(hex(0x5a3a2a), BONE.torso), false, 0.5);
  g.box(compose(0, 1.15, td * 1.03), 1.6, 1.3, 0.6, st(GOLD, BONE.torso));
  // tunic skirt on the hips (does not swing with the legs)
  g.cylinder(compose(0, -2.6, 0, 0, 0, 0, tw * 1.05, 1, td * 1.05), 6, 1.08, 1, 2.8, st(shade(torsoCol, 0.92), BONE.hips), false, 0.5);
  // fur bodies show a belly patch instead of a plain tunic front
  if (s.name === "bearfolk" || s.name === "lizardfolk" || s.name === "birdfolk") {
    g.blob(compose(0, s.torso * 0.62, td * 0.62, 0, 0, 0, tw * 0.55, s.torso * 0.32, 0.9), 0, 0, 3, st(s.accent, BONE.torso));
  }
  // collar / neck
  g.cylinder(compose(0, s.torso - 0.2, 0), 6, 1.7, 1.6, 1.4, st(s.skin, BONE.torso), false);

  // --- arms (pivot at shoulder, hang to -arm) ---
  for (const bone of [BONE.armL, BONE.armR]) {
    const wing = s.name === "birdfolk";
    g.cylinder(compose(0, -s.arm * 0.48, 0), 5, s.limb * 0.92, s.limb, s.arm * 0.48 + 0.6, st(wing ? s.skin : shade(torsoCol, 0.95), bone), true);
    g.cylinder(compose(0, -s.arm + 1.4, 0), 5, s.limb * 0.8, s.limb * 0.9, s.arm * 0.52 - 1.2, st(s.skin, bone), false);
    if (wing) {
      g.box(compose(0, -s.arm + 1.5, -0.6, 0, 0.15), 0.8, 4.5, 3.4, st(shade(s.skin, 0.8), bone));
      g.box(compose(0, -s.arm + 0.8, 0.6), 1.4, 2, 1.4, st(s.accent, bone));
    } else {
      g.blob(compose(0, -s.arm + 0.7, 0, 0, 0, 0, s.limb * 1.15, s.limb * 1.15, s.limb * 1.15), 0, 0, 1, st(furred ? shade(s.skin, 0.85) : s.skin, bone));
    }
  }

  // --- head (pivot at the neck) ---
  g.blob(compose(0, headC, 0, 0, 0, 0, R, R * 0.92, R * 0.95), 1, 0.0, 5, (n) => st(n[1]! < -0.35 && furred ? mixc(s.skin, s.accent, 0.0) : s.skin, BONE.head), true);
  const eyeY = headC + R * 0.08, eyeZ = R * 0.86, eyeX = R * 0.4;
  for (const sx of [-1, 1]) g.box(compose(sx * eyeX, eyeY - 0.9, eyeZ), 1.1, 1.9, 0.9, st(EYE, BONE.head));
  // cheeks: a warm blush keeps the faces friendly at a glance
  if (!furred || s.snout === "short") for (const sx of [-1, 1]) g.box(compose(sx * R * 0.58, headC - R * 0.25, R * 0.74), 1.4, 0.8, 0.7, st(mixc(s.skin, hex(0xf07a7a), 0.5), BONE.head));

  // hair
  const hair = s.hair;
  if (hair && s.hairStyle && s.hairStyle !== "none") {
    if (s.hairStyle === "mohawk") {
      g.box(compose(0, headC + R * 0.6, -R * 0.2, 0, -0.3), 1.6, R * 0.8, R * 1.5, st(hair, BONE.head));
    } else {
      g.blob(compose(0, headC + R * 0.2, -R * 0.14, 0, 0, 0, R * 1.07, R * 0.9, R * 1.02), 1, 0.06, 9, (n) => st(n[2]! > 0.55 && n[1]! < 0.3 ? s.skin : hair, BONE.head), true);
      // fringe
      g.box(compose(0, headC + R * 0.62, R * 0.62, 0, 0.5), R * 1.5, R * 0.42, R * 0.5, st(shade(hair, 1.08), BONE.head));
      if (s.hairStyle === "long") g.box(compose(0, headC - R * 0.75, -R * 0.62), R * 1.7, R * 1.5, R * 0.5, st(hair, BONE.head));
      if (s.hairStyle === "bun") g.blob(compose(0, headC + R * 0.95, -R * 0.4, 0, 0, 0, R * 0.42, R * 0.42, R * 0.42), 0, 0, 2, st(hair, BONE.head));
    }
  }
  if (s.beard && hair) {
    g.blob(compose(0, headC - R * 0.55, R * 0.48, 0, 0.2, 0, R * 0.85, R * 0.75, R * 0.55), 1, 0.08, 11, st(hair, BONE.head), true);
    g.cone(compose(0, headC - R * 1.15, R * 0.62, 0, Math.PI), 5, R * 0.45, R * 0.6, st(shade(hair, 0.9), BONE.head));
    // moustache sits over the beard so the face still reads
    g.box(compose(0, headC - R * 0.22, R * 0.88), R * 1.0, 0.9, 0.8, st(shade(hair, 1.12), BONE.head));
  }

  // snouts
  switch (s.snout) {
    case "fox":
      g.cone(compose(0, headC - R * 0.32, R * 0.62, 0, Math.PI / 2), 6, R * 0.42, R * 0.7, st(s.accent, BONE.head));
      g.blob(compose(0, headC - R * 0.3, R * 1.3, 0, 0, 0, 0.8, 0.7, 0.7), 0, 0, 1, st(EYE, BONE.head));
      // white cheeks
      g.blob(compose(0, headC - R * 0.45, R * 0.35, 0, 0, 0, R * 0.8, R * 0.42, R * 0.6), 0, 0.05, 3, st(s.accent, BONE.head));
      break;
    case "bear":
      g.blob(compose(0, headC - R * 0.32, R * 0.72, 0, 0, 0, R * 0.48, R * 0.36, R * 0.42), 1, 0, 2, st(s.accent, BONE.head), true);
      g.blob(compose(0, headC - R * 0.18, R * 1.1, 0, 0, 0, 1.1, 0.8, 0.7), 0, 0, 1, st(EYE, BONE.head));
      break;
    case "beak":
      g.cone(compose(0, headC - R * 0.22, R * 0.75, 0, Math.PI / 2), 4, R * 0.32, R * 0.75, st(hex(0xf0a43a), BONE.head), 0.5);
      g.blob(compose(0, headC - R * 0.5, R * 0.3, 0, 0, 0, R * 0.7, R * 0.4, R * 0.62), 0, 0.05, 3, st(s.accent, BONE.head));
      break;
    case "lizard":
      g.blob(compose(0, headC - R * 0.35, R * 0.8, 0, 0, 0, R * 0.55, R * 0.4, R * 0.75), 1, 0, 2, st(s.skin, BONE.head), true);
      g.box(compose(0, headC - R * 0.62, R * 0.95), R * 0.8, 0.6, R * 0.6, st(s.accent, BONE.head));
      for (const sx of [-1, 1]) g.box(compose(sx * 0.9, headC - R * 0.12, R * 1.45), 0.5, 0.5, 0.4, st(EYE, BONE.head));
      break;
    case "short":
      g.blob(compose(0, headC - R * 0.3, R * 0.78, 0, 0, 0, R * 0.42, R * 0.3, R * 0.3), 0, 0, 1, st(hex(0xffffff), BONE.head));
      g.blob(compose(0, headC - R * 0.12, R * 0.98, 0, 0, 0, 0.8, 0.6, 0.5), 0, 0, 1, st(s.accent, BONE.head));
      break;
    case "tusks":
      g.box(compose(0, headC - R * 0.5, R * 0.62), R * 1.1, R * 0.38, R * 0.5, st(shade(s.skin, 0.9), BONE.head));
      for (const sx of [-1, 1]) g.cone(compose(sx * R * 0.38, headC - R * 0.42, R * 0.86), 4, 0.65, 2.0, st(s.accent, BONE.head));
      break;
    default:
      g.box(compose(0, headC - R * 0.15, R * 0.95), 0.9, 1.2, 0.8, st(shade(s.skin, 0.9), BONE.head));
  }
  // crests
  if (s.crest && s.name === "birdfolk") {
    for (let i = 0; i < 3; i++) g.cone(compose((i - 1) * 0.9, headC + R * 0.8, -R * 0.15 - i * 0.6, 0, -0.5 - i * 0.25), 4, 0.9, 4.2 - Math.abs(i - 1) * 0.8, st(s.crest, BONE.head));
  }
  if (s.crest && s.name === "lizardfolk") {
    for (let i = 0; i < 4; i++) g.cone(compose(0, headC + R * 0.85 - i * 1.6, -R * 0.3 - i * 1.2, 0, -0.6 - i * 0.2), 4, 0.9, 2.2, st(s.crest, BONE.head));
    for (let i = 0; i < 3; i++) g.cone(compose(0, s.torso - 1 - i * 2.6, -td * 0.85, 0, -1.1), 4, 0.8, 1.8, st(s.crest, BONE.torso));
  }

  // --- ears (bone-local: pivot at the ear root) ---
  const rest: [number, number, number][] = Array.from({ length: BONES }, () => [0, 0, 0]);
  let earPos: [number, number, number] = [R * 0.95, headC, 0];
  for (const [bone, sx] of [[BONE.earL, 1], [BONE.earR, -1]] as const) {
    switch (s.ears) {
      case "round":
        g.blob(compose(0, 0, 0, 0, 0, 0, 1.1, 1.5, 1.0), 0, 0, 1, st(shade(s.skin, 0.95), bone));
        earPos = [R * 0.97, headC, 0];
        break;
      case "elf":
        g.cone(compose(0, 0, 0, 0, 0, sx * -1.15), 4, 1.2, 5.2, st(s.skin, bone));
        earPos = [R * 0.88, headC + 0.4, -0.4];
        break;
      case "pointy":
        g.cone(compose(0, 0, 0, 0, 0, sx * -1.3), 4, 1.2, 3.2, st(s.skin, bone));
        earPos = [R * 0.9, headC + 0.3, 0];
        break;
      case "fox":
        g.cone(compose(0, 0, 0, sx * 0.3, -0.1, sx * -0.38), 4, 2.4, 5.6, st(s.skin, bone), 0.5);
        g.cone(compose(sx * 1.25, 3.4, 0.45, sx * 0.3, -0.1, sx * -0.38), 4, 0.95, 2.4, st(hex(0x2a2026), bone), 0.5);
        earPos = [R * 0.48, headC + R * 0.68, -0.4];
        break;
      case "bear":
        g.blob(compose(0, 0.6, 0, 0, 0, 0, 2.2, 2.0, 1.2), 1, 0, 1, (n) => st(n[2]! > 0.4 ? s.accent : s.skin, bone), true);
        earPos = [R * 0.66, headC + R * 0.66, -0.3];
        break;
      case "rabbit":
        g.blob(compose(0, 4.2, 0, 0, 0, 0, 1.45, 4.6, 0.9), 1, 0, 1, (n) => st(n[2]! > 0.5 ? s.accent : s.skin, bone), true);
        earPos = [R * 0.36, headC + R * 0.8, -0.5];
        break;
      case "fin":
        g.cone(compose(0, 0, 0, 0, -0.7, sx * -1.0), 4, 1.3, 3.2, st(s.crest ?? s.skin, bone));
        earPos = [R * 0.78, headC + 0.6, -R * 0.35];
        break;
      case "none":
        break;
    }
    rest[bone] = [sx * earPos[0], earPos[1], earPos[2]];
  }

  // --- tails (pivot at the base, pointing back = -z) ---
  let tailLen = 0;
  switch (s.tail) {
    case "fox":
      g.blob(compose(0, 0.8, -3.6, 0, -0.5, 0, 2.6, 2.4, 4.4), 1, 0.08, 4, st(s.skin, BONE.tail1), true);
      g.blob(compose(0, 0.4, -2.0, 0, -0.2, 0, 2.2, 2.1, 2.6), 1, 0.08, 6, st(s.accent, BONE.tail2), true);
      tailLen = 7;
      break;
    case "bear":
      g.blob(compose(0, 0, -0.8, 0, 0, 0, 1.6, 1.6, 1.4), 0, 0, 2, st(s.skin, BONE.tail1));
      break;
    case "rabbit":
      g.blob(compose(0, 0, -1.0, 0, 0, 0, 2.1, 2.1, 2.0), 1, 0.12, 2, st(hex(0xffffff), BONE.tail1), true);
      break;
    case "bird":
      for (const a of [-0.45, 0, 0.45]) g.box(compose(0, 0, 0, a, 0.55), 1.8, 0.7, 6, (f) => st(f === 0 ? shade(s.skin, 1.1) : shade(s.skin, 0.85), BONE.tail1), 0);
      for (const a of [-0.45, 0, 0.45]) g.box(compose(Math.sin(a) * -2.7, 0.3, -2.4 * Math.cos(a), a, 0.55), 1.4, 0.6, 2, st(s.accent, BONE.tail1));
      break;
    case "lizard":
      g.cylinder(compose(0, 0, 0, 0, -Math.PI / 2 - 0.35), 6, 1.9, 1.3, 6.5, st(s.skin, BONE.tail1), false);
      g.cylinder(compose(0, 0, 0, 0, -Math.PI / 2 - 0.1), 5, 1.3, 0.2, 6.5, st(s.skin, BONE.tail2), true);
      tailLen = 6.2;
      break;
    case "none":
      break;
  }

  // --- weapon (bone-local at the hand: the blade points along the hand's +y after the grip rotation) ---
  switch (weapon) {
    case "sword":
      g.box(compose(0, 0, 0.6), 1.1, 3.2, 1.1, st(GRIP, BONE.weapon), -1.2);
      g.box(compose(0, 0, 0.6), 4.4, 0.9, 1.3, st(GOLD, BONE.weapon), 2.0);
      g.box(compose(0, 0, 0.6), 0.7, 10.5, 1.9, (f) => st(f === 3 || f === 4 ? STEEL : f === 0 ? STEEL : STEEL_D, BONE.weapon), 2.9);
      g.cone(compose(0, 13.4, 0.6), 4, 1.1, 1.7, st(STEEL, BONE.weapon), 0.5);
      break;
    case "axe":
      g.box(compose(0, 0, 0.6), 1.1, 12.5, 1.1, st(GRIP, BONE.weapon), -1.5);
      g.box(compose(0, 9.2, 2.4), 0.9, 4.6, 4.2, (f) => st(f === 1 ? STEEL : STEEL_D, BONE.weapon));
      break;
    case "spear":
      g.box(compose(0, 0, 0.6), 0.9, 19, 0.9, st(GRIP, BONE.weapon), -5);
      g.cone(compose(0, 14, 0.6), 4, 1.3, 4.2, st(STEEL, BONE.weapon), 0.5);
      break;
    case "dagger":
      g.box(compose(0, 0, 0.6), 0.9, 2.4, 0.9, st(GRIP, BONE.weapon), -0.8);
      g.box(compose(0, 0, 0.6), 0.6, 5.2, 1.5, st(STEEL, BONE.weapon), 1.6);
      break;
    case "none":
      break;
  }

  rest[BONE.hips] = [0, s.leg, 0];
  rest[BONE.torso] = [0, 0.8, 0];
  rest[BONE.head] = [0, s.torso + 0.4, 0];
  rest[BONE.armL] = [tw + s.limb * 0.55, s.torso - 1.2, 0];
  rest[BONE.armR] = [-(tw + s.limb * 0.55), s.torso - 1.2, 0];
  rest[BONE.legL] = [hipX, 0.6, 0];
  rest[BONE.legR] = [-hipX, 0.6, 0];
  rest[BONE.tail1] = [0, 1.6, -td * 0.85];
  rest[BONE.tail2] = s.tail === "fox" ? [0, 1.6, -6.6] : [0, -2.2, -6.1];
  rest[BONE.weapon] = [0, -s.arm + 0.7, 0.2];
  return { species: s, rest, geo: g, headC, tailLen, weapon, height: s.leg + 0.8 + s.torso + 0.4 + headC + R };
}
