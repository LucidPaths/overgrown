class_name OgBiome
extends RefCounted
## Biome ids (u8), one per tile in a chunk's biomes layer. Mirrors sim/src/world/biome.ts.

enum {
	GRASSLAND = 0,
	FOREST = 1,
	RIVER = 2,
	MOUNTAIN = 3,
	OCEAN = 4,
}
