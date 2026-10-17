// Who wears what: a seeded outfit per character (gear, weapon, dyes, fur or skin tone). Deterministic from the
// world seed and the entity, so the same NPC always looks the same.
import type { GearId, WeaponId } from "./gear";
import type { Look } from "./look";
import { DYES, M, mat, type MatDef } from "./mats";

/** A cosmetic hash in [0, 1) (no Math.random in seeded paths). */
export function hash01(a: number, b: number, c: number): number {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x1b873593, 0x27d4eb2f);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

const WEAPONS: WeaponId[] = ["sword", "axe", "spear", "dagger", "hammer", "sword", "none", "staff"];
const OUTFITS: GearId[][] = [
  ["tunic", "trousers", "boots", "belt"],
  ["shirt", "trousers", "boots", "belt", "cloak"],
  ["tunic", "trousers", "boots", "belt", "pauldron"],
  ["shirt", "kilt", "boots", "belt"],
  ["tunic", "trousers", "boots", "belt", "scarf"],
  ["breastplate", "trousers", "boots", "belt", "helmet"],
  ["shirt", "shorts", "belt", "bracers"],
];

export function npcLook(species: number, seed: number, id: number): Look {
  const h = (k: number) => hash01(seed, id, k);
  const gear = OUTFITS[Math.floor(h(1) * OUTFITS.length)]!;
  const weapon = WEAPONS[Math.floor(h(2) * WEAPONS.length)]!;
  const d1 = DYES[Math.floor(h(3) * DYES.length)]!, d2 = DYES[Math.floor(h(4) * DYES.length)]!;
  const palette: Partial<Record<number, MatDef>> = { [M.cloth1]: mat(d1), [M.cloth2]: mat(darker(d2)) };
  return { species, gear, weapon, palette };
}

export function playerLook(species: number): Look {
  return { species, gear: ["tunic", "trousers", "boots", "belt", "scarf"], weapon: "sword", palette: { [M.cloth1]: mat(DYES[1]!), [M.cloth2]: mat(darker(DYES[2]!)) } };
}

function darker(c: [number, number, number]): [number, number, number] {
  return [c[0] * 0.72, c[1] * 0.68, c[2] * 0.66];
}
