// Ground tile ids (u8). Contract: CLAUDE.md "World tiles and chunk layout".
// Water depth (WLD-004) is derived from the three water tiles: ShallowWater 1, DeepWater 2, VeryDeepWater 3; dry ground 0.
export const Tile = {
  Grass: 0, Dirt: 1, Sand: 2, Stone: 3, Cliff: 4, ShallowWater: 5, DeepWater: 6, VeryDeepWater: 7,
} as const;
export type TileValue = (typeof Tile)[keyof typeof Tile];
