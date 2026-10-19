class_name OgWorld
extends RefCounted
## World geometry shared by every world file, plus the one error channel for world validation.
## Mirrors sim/src/constants.ts (TILE_PX, CHUNK_TILES).

## Ground tile edge in world pixels.
const TILE_PX := 16
## Chunk edge in tiles; a chunk holds CHUNK_TILES * CHUNK_TILES tiles.
const CHUNK_TILES := 32
const U32_MAX := 0xFFFFFFFF


## Reports a validation error the way the TS worldgen throws one. GDScript has no exceptions, so callers
## return an empty result after this. Goes through OgRng.error_hook when a test set one, else push_error.
static func report(msg: String) -> void:
	if OgRng.error_hook.is_valid():
		OgRng.error_hook.call(msg)
	else:
		push_error(msg)
