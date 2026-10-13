// A Look is everything that decides how one character appears: species, build (age, bulk), gear, weapon, and
// palette (skin/fur tone, dyes, greying). Geometry is keyed without the palette: recolouring is free.
import { Field } from "../sdf/field";
import { meshField, type RawMesh } from "../sdf/mesher";
import type { Skeleton } from "../rig/skeleton";
import type { Build } from "./build";
import { applyGear, applyWeapon, type GearId, type WeaponId } from "./gear";
import { M, type MatDef, type RGB } from "./mats";
import { SPECIES, buildSpecies, paletteOf, type Face } from "./species";
import { proxyNormals } from "./normals";

export interface Look {
  species: number;
  /** proportion changes: age and bulk (see age.ts) */
  build?: Partial<Build>;
  gear: GearId[];
  weapon: WeaponId;
  palette?: Partial<Record<number, MatDef>>;
  /** extra sculpt steps keyed by name (scars, a missing ear...) */
  marks?: string[];
}

export interface Built {
  key: string;
  raw: RawMesh;
  sk: Skeleton;
  build: Build;
  headC: [number, number, number];
  face: Face;
  /** grip to tip along the weapon bone's +z */
  weaponLen: number;
  height: number;
}

export function geoKey(l: Look): string {
  return JSON.stringify([l.species, l.build ?? {}, l.gear, l.weapon, l.marks ?? []]);
}

const cache = new Map<string, Built>();

export function buildLook(l: Look, cellPx = 0.36): Built {
  const key = geoKey(l) + "@" + cellPx;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = SPECIES[l.species]!;
  const { model, j, b } = buildSpecies(s, l.build);
  applyGear(model, b, j, l.gear);
  const w = applyWeapon(model, j, l.weapon);
  const f = new Field(model);
  // bounds: generous around the rest pose (A pose arms, tails, ears, weapons)
  const top = j.headC[1] + b.head[1] * 2.6 + 4;
  const raw = meshField(f, { min: [-16, -1.5, -18 - (b.tail?.len ?? 0)], max: [16, top, 22], h: cellPx });
  proxyNormals(raw, j.sk, b, j.headC, 0.6);
  const built: Built = { key, raw, sk: j.sk, build: b, headC: j.headC, face: s.face, weaponLen: w.len, height: top };
  cache.set(key, built);
  return built;
}

export function lookPalette(l: Look): MatDef[] {
  return paletteOf(SPECIES[l.species]!, l.palette);
}

export type { RGB };
export { M };
