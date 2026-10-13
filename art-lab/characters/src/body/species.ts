// The nine species: the registry, the shared types and the default palette. Each species is a Build
// (proportions) plus a sculpt (head, features, markings) made of the same primitives as the body.
// Rule: with the colour removed, the silhouette from the game camera alone must name the species.
import type { Model, V3 } from "../sdf/model";
import { joints, sculptBase, type Build, type Joints } from "./build";
import type { HairStyle } from "./features";
import { M, hex, mat, type MatDef, type RGB } from "./mats";
import { DWARF, ELF, HUMAN, ORC } from "./species-folk";
import { BEAR, FOX, RABBIT } from "./species-beast";
import { BIRD, LIZARD } from "./species-wild";

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
  /** iris colour; [0,0,0] = all-dark eyes */
  iris: RGB;
  /** pupil: 0 round, 1 vertical slit */
  slit: number;
  /** brow: thickness (0 = none), height above the eye */
  brow: number;
  browY: number;
  /** mouth: y below the head centre, half width (0 = none: the snout carries it) */
  mouthY: number;
  mouthW: number;
  /** unused (kept for the shader's uniform layout) */
  faceZ: number;
}

/** Per-character sculpt options that change geometry (so they are part of the mesh key). */
export interface SculptOpts {
  hair?: HairStyle;
  /** beard length below the chin, px (0 = clean shaven; species without beards ignore it) */
  beard?: number;
}

export interface SpeciesDef {
  name: string;
  build: Build;
  face: Face;
  palette: Partial<Record<number, MatDef>>;
  /** palette variants a crowd draws from (fur colours, skin tones, hair colours) */
  variants?: Partial<Record<number, MatDef>>[];
  /** the species' own default hair style (folk) */
  hair?: HairStyle;
  /** adds head, ears, snout, tail, hair, body markings to the base */
  sculpt(m: Model, b: Build, j: Joints, o: SculptOpts): void;
  /** how it moves (see anim/clips.ts) */
  gait?: Partial<import("../anim/clips").Gait>;
  /** ear and tail joint placement (called before the skeleton frames are final) */
  place?(j: Joints, b: Build): void;
}

/** Indexed by the sim's Species enum: human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk. */
export const SPECIES: SpeciesDef[] = [HUMAN, ELF, DWARF, ORC, FOX, BEAR, RABBIT, BIRD, LIZARD];

export function buildSpecies(s: SpeciesDef, buildOverride: Partial<Build> = {}, o: SculptOpts = {}): { model: Model; j: Joints; b: Build } {
  const b: Build = { ...s.build, ...buildOverride };
  const j = joints(b);
  s.place?.(j, b);
  const m = sculptBase(b, j);
  s.sculpt(m, b, j, o);
  return { model: m, j, b };
}

export const DEFAULT_PALETTE: Record<number, MatDef> = {
  [M.skin]: mat(0xf2c4a0, "skin"),
  [M.skin2]: mat(0xf6eee0, "fur"),
  [M.mark]: mat(0x3a2a2a, "fur"),
  [M.hair]: mat(0x5a3422, "fur", 4),
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
