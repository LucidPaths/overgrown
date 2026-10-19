class_name OgWalkability
extends RefCounted
## The one walkability rule set: which tiles a foot box can enter, how fast it moves over them, and how
## deep the water is. Mirrors sim/src/world/walkability.ts (TILE_RULES).

const SHALLOW_WATER_SPEED := 0.6 # OQ-019, tunable

## Tile id -> {walkable, speed, depth}. speed multiplies displacement while the box centre is over the tile
## (1 on blocked tiles); depth is dry 0, shallow 1, deep 2, very deep 3. An entry per OgTile id (a test checks).
const TILE_RULES := {
	OgTile.GRASS: {"walkable": true, "speed": 1.0, "depth": 0},
	OgTile.DIRT: {"walkable": true, "speed": 1.0, "depth": 0},
	OgTile.SAND: {"walkable": true, "speed": 1.0, "depth": 0},
	OgTile.STONE: {"walkable": true, "speed": 1.0, "depth": 0},
	OgTile.CLIFF: {"walkable": false, "speed": 1.0, "depth": 0},
	OgTile.SHALLOW_WATER: {"walkable": true, "speed": SHALLOW_WATER_SPEED, "depth": 1},
	OgTile.DEEP_WATER: {"walkable": false, "speed": 1.0, "depth": 2},
	OgTile.VERY_DEEP_WATER: {"walkable": false, "speed": 1.0, "depth": 3},
}
