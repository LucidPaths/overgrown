// The nine playable species on one body plan. Species differ by proportions, head features, tail and colour:
// shape first, colour second (a silhouette must name the species with every colour removed).
import { hex, type RGB } from "../geo/builder";

export type Ears = "none" | "round" | "pointy" | "elf" | "fox" | "bear" | "rabbit" | "fin";
export type Tail = "none" | "fox" | "bear" | "rabbit" | "bird" | "lizard";
export type Snout = "none" | "short" | "fox" | "bear" | "beak" | "lizard" | "tusks";

export interface SpeciesDef {
  name: string;
  /** hip height (leg length), torso height, torso half-width, torso depth, head radius, arm length */
  leg: number;
  torso: number;
  width: number;
  depth: number;
  head: number;
  arm: number;
  /** limb thickness */
  limb: number;
  skin: RGB;
  /** secondary covering: muzzle, belly, beard... */
  accent: RGB;
  hair?: RGB;
  hairStyle?: "cap" | "long" | "bun" | "mohawk" | "none";
  beard?: boolean;
  ears: Ears;
  tail: Tail;
  snout: Snout;
  crest?: RGB;
  /** feet colour override (bird/lizard feet) */
  feet?: RGB;
  /** walk bounce and stride character */
  gait: { bob: number; stride: number; swing: number };
}

export const SPECIES: SpeciesDef[] = [
  {
    name: "human", leg: 7, torso: 8, width: 4.2, depth: 3.4, head: 6.2, arm: 7.5, limb: 1.5,
    skin: hex(0xf0b98e), accent: hex(0xe39a7a), hair: hex(0x6b3d26), hairStyle: "cap",
    ears: "round", tail: "none", snout: "none", gait: { bob: 1, stride: 1, swing: 1 },
  },
  {
    name: "elf", leg: 8.5, torso: 8.5, width: 3.6, depth: 3, head: 5.9, arm: 8.2, limb: 1.3,
    skin: hex(0xf6d3b0), accent: hex(0xeab89a), hair: hex(0xf2df8c), hairStyle: "long",
    ears: "elf", tail: "none", snout: "none", gait: { bob: 0.7, stride: 1.15, swing: 0.8 },
  },
  {
    name: "dwarf", leg: 5, torso: 8, width: 5.2, depth: 4.2, head: 6.4, arm: 6.8, limb: 1.8,
    skin: hex(0xe8a582), accent: hex(0xd6844a), hair: hex(0xc4562a), hairStyle: "bun", beard: true,
    ears: "round", tail: "none", snout: "none", gait: { bob: 1.3, stride: 0.75, swing: 1.1 },
  },
  {
    name: "orc", leg: 7.5, torso: 9.5, width: 5.8, depth: 4.4, head: 6.4, arm: 8.6, limb: 2.1,
    skin: hex(0x7fae5a), accent: hex(0xf2ead2), hair: hex(0x2d2a35), hairStyle: "mohawk",
    ears: "pointy", tail: "none", snout: "tusks", gait: { bob: 1.2, stride: 1.05, swing: 1.2 },
  },
  {
    name: "foxfolk", leg: 7, torso: 8, width: 4, depth: 3.4, head: 6.2, arm: 7.4, limb: 1.4,
    skin: hex(0xe8782e), accent: hex(0xfbefdc), ears: "fox", tail: "fox", snout: "fox",
    feet: hex(0x3a2a2a), gait: { bob: 1.1, stride: 1.05, swing: 0.9 },
  },
  {
    name: "bearfolk", leg: 7, torso: 10, width: 6.4, depth: 5.2, head: 7, arm: 8.4, limb: 2.3,
    skin: hex(0x8a5a3a), accent: hex(0xd9b48a), ears: "bear", tail: "bear", snout: "bear",
    gait: { bob: 1.4, stride: 0.9, swing: 1.1 },
  },
  {
    name: "rabbitfolk", leg: 7.5, torso: 7.5, width: 3.8, depth: 3.2, head: 6, arm: 7, limb: 1.35,
    skin: hex(0xeee6dc), accent: hex(0xf6b6c0), ears: "rabbit", tail: "rabbit", snout: "short",
    gait: { bob: 1.6, stride: 1, swing: 0.8 },
  },
  {
    name: "birdfolk", leg: 7.5, torso: 8, width: 4, depth: 3.6, head: 5.8, arm: 7.6, limb: 1.4,
    skin: hex(0x3f86d8), accent: hex(0xf6efe0), crest: hex(0xe8463a), ears: "none", tail: "bird", snout: "beak",
    feet: hex(0xf0a43a), gait: { bob: 1.2, stride: 0.95, swing: 0.7 },
  },
  {
    name: "lizardfolk", leg: 7.2, torso: 8.6, width: 4.4, depth: 3.8, head: 5.8, arm: 7.8, limb: 1.6,
    skin: hex(0x3fa06c), accent: hex(0xe8d47a), crest: hex(0xe0723a), ears: "fin", tail: "lizard", snout: "lizard",
    gait: { bob: 0.8, stride: 1.1, swing: 1 },
  },
];

/** Cloth dyes: medium chroma, so magic, hits and loot (the pop colours) always out-shout them. */
export const DYES: RGB[] = [
  hex(0xc8473e), hex(0x3f7fc0), hex(0xd9a23a), hex(0x6f8f3a), hex(0x8a4fa8), hex(0x3a9a8f), hex(0xd06a8a), hex(0x8a6a4a), hex(0xe8e0cc),
];
export const TROUSERS: RGB[] = [hex(0x4a4058), hex(0x5a4636), hex(0x3d4a5a), hex(0x6a5a48)];
