class_name OgTile
extends RefCounted
## Ground tile ids (u8). Mirrors sim/src/world/tile.ts.

enum {
	GRASS = 0,
	DIRT = 1,
	SAND = 2,
	STONE = 3,
	CLIFF = 4,
	SHALLOW_WATER = 5,
	DEEP_WATER = 6,
	VERY_DEEP_WATER = 7,
}
