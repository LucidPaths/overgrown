// Seeded prop placement: which prop stands on which tile. Pure (no DOM), shared by the renderer and the lab's sim
// worker (trunks and boulders block their tile through the sim's own collision). Same seed -> same props.
import { B, Ground, T, hash01 } from "./ground";

export const P = {
  None: 0, Oak: 1, Pine: 2, Bush: 3, Flowers: 4, Rock: 5, Boulder: 6, Fern: 7, Mushroom: 8, Reeds: 9,
  Lily: 10, Log: 11, Stump: 12, Palm: 13, Driftwood: 14, Birch: 15, TallGrass: 16, Shell: 17,
} as const;
export type PropKind = (typeof P)[keyof typeof P];

/** Props that block their tile for movement. */
export const BLOCKING = new Set<number>([P.Oak, P.Pine, P.Boulder, P.Palm, P.Birch]);

export interface Placement {
  kind: PropKind;
  /** offset inside the tile, 0..1 */
  ox: number;
  oy: number;
  /** 0..1 variation seed */
  v: number;
}

const NONE: Placement = { kind: P.None, ox: 0.5, oy: 0.5, v: 0 };

/** Tiles around these points stay clear (the spawn). Set by whoever knows the spawn. */
export const clearings: { tx: number; ty: number; r: number }[] = [];

function nearWater(g: Ground, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.tile(tx + dx, ty + dy) >= T.Shallow) return true;
  return false;
}

export function propAt(g: Ground, tx: number, ty: number): Placement {
  for (const c of clearings) if (Math.max(Math.abs(tx - c.tx), Math.abs(ty - c.ty)) <= c.r) return NONE;
  const t = g.tile(tx, ty);
  const b = g.biome(tx, ty);
  const s = g.seed;
  const h = hash01(s, tx, ty, 101);
  const v = hash01(s, tx, ty, 102);
  const ox = 0.3 + hash01(s, tx, ty, 103) * 0.4, oy = 0.3 + hash01(s, tx, ty, 104) * 0.4;
  const pl = (kind: PropKind): Placement => ({ kind, ox, oy, v });
  // groves: a low-frequency field makes trees cluster instead of sprinkling evenly
  const grove = g.fields.detail(tx * 0.37 + 1000, ty * 0.37 - 1000);
  const temp = g.fields.temperature(tx, ty);
  switch (b) {
    case B.Forest: {
      if (t !== T.Grass && t !== T.Dirt) return NONE;
      if (nearWater(g, tx, ty)) return h < 0.08 ? pl(P.Fern) : NONE;
      if (t === T.Dirt && h > 0.9) return pl(h > 0.96 ? P.Rock : P.TallGrass);
      const treeP = 0.07 + grove * 0.1;
      if (h < treeP) return pl(v < 0.28 ? P.Pine : v < 0.38 ? P.Birch : P.Oak);
      if (h < treeP + 0.07) return pl(P.Fern);
      if (h < treeP + 0.1) return pl(P.Bush);
      if (h < treeP + 0.115) return pl(P.Mushroom);
      if (h < treeP + 0.12) return pl(P.Log);
      if (h < treeP + 0.125) return pl(P.Stump);
      if (h < treeP + 0.135) return pl(P.Rock);
      return NONE;
    }
    case B.Grassland: {
      // bare earth: stones and dry tufts, so a big patch reads as worn ground, not a hole in the grass
      if (t === T.Dirt) return h < 0.03 ? pl(P.Rock) : h < 0.1 + grove * 0.06 ? pl(P.TallGrass) : h < 0.105 ? pl(P.Stump) : NONE;
      if (t !== T.Grass) return NONE;
      if (h < 0.006 + grove * 0.018) return pl(v < 0.75 ? P.Oak : P.Birch);
      if (h < 0.04) return pl(P.Bush);
      if (h < 0.11) return pl(P.Flowers);
      if (h < 0.16 + grove * 0.06) return pl(P.TallGrass);
      if (h < 0.166) return pl(P.Rock);
      if (h < 0.168) return pl(P.Boulder);
      return NONE;
    }
    case B.River: {
      if (t === T.Sand) return nearWater(g, tx, ty) ? (h < 0.22 ? pl(P.Reeds) : h < 0.25 ? pl(P.Rock) : NONE) : h < 0.08 ? pl(P.TallGrass) : NONE;
      if (t === T.Shallow) return h < 0.05 ? pl(P.Lily) : h < 0.065 ? pl(P.Rock) : NONE;
      if (t === T.Grass) return h < 0.1 ? pl(P.Flowers) : NONE;
      return NONE;
    }
    case B.Mountain: {
      if (t !== T.Stone) return NONE;
      const e = g.fields.elevation(tx, ty);
      if (e < 0.66 && h < 0.03 + grove * 0.05) return pl(P.Pine);
      if (h < 0.1) return pl(P.Rock);
      if (h < 0.118) return pl(P.Boulder);
      if (e < 0.68 && h < 0.16) return pl(P.TallGrass);
      return NONE;
    }
    case B.Ocean: {
      if (t === T.Sand) {
        if (nearWater(g, tx, ty)) return h < 0.03 ? pl(P.Shell) : h < 0.04 ? pl(P.Rock) : NONE;
        if (temp > 0.55 && h < 0.03) return pl(P.Palm);
        if (h < 0.012) return pl(P.Driftwood);
        if (h < 0.1) return pl(P.TallGrass);
        if (h < 0.11) return pl(P.Rock);
        return NONE;
      }
      if (t === T.Shallow) return h < 0.015 ? pl(P.Rock) : NONE;
      return NONE;
    }
  }
  return NONE;
}

/** A tile is blocked for movement if the ground blocks it or a blocking prop stands on it. */
export function propBlocks(g: Ground, tx: number, ty: number): boolean {
  return BLOCKING.has(propAt(g, tx, ty).kind);
}
