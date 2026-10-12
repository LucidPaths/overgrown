// Biome ids (u8), one per tile in ChunkData.biomes (WLD-002). Contract: CLAUDE.md "World tiles and chunk layout".
export const Biome = {
  Grassland: 0, Forest: 1, River: 2, Mountain: 3, Ocean: 4,
} as const;
export type BiomeValue = (typeof Biome)[keyof typeof Biome];
