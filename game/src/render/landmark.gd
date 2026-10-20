class_name OgLandmark
extends RefCounted
## Seeded landmark sites (ART-027, docs/art/BIBLE.md "Landmark"): one floating island per REGION_CHUNKS ×
## REGION_CHUNKS chunks, hanging over the world with a pillar of gold light running up to the cosmic eye and a
## rune circle glowing on the ground beneath it. The island floats, so the rules never need to know it exists:
## nothing to collide with, and the ground below stays exactly what worldgen made.
## Pure and static. Sites come from OgRng.derive_seed(world seed, [rx, ry, SALT]) only.

const REGION_CHUNKS := 6
const SALT := 0x1A2D3A4C
## Sites keep this many chunks away from the region edge (so neighbours never crowd each other).
const MARGIN_CHUNKS := 1
## Island underside height above the ground at the site (metres; tunable).
const FLOAT_M := 3.5


## The site of region (rx, ry) in world metres (x, z), and its variation seed: {pos: Vector2, seed: int}.
static func site(seed: int, rx: int, ry: int) -> Dictionary:
	var s := OgRng.derive_seed(seed, [rx, ry, SALT])
	var rng := OgRng.new(s)
	var span := (REGION_CHUNKS - 2 * MARGIN_CHUNKS) * OgChunkStore.CHUNK_M
	var x := (rx * REGION_CHUNKS + MARGIN_CHUNKS) * OgChunkStore.CHUNK_M + rng.next_float() * span
	var z := (ry * REGION_CHUNKS + MARGIN_CHUNKS) * OgChunkStore.CHUNK_M + rng.next_float() * span
	return {"pos": Vector2(x, z), "seed": s}


## The region of a chunk coordinate.
static func region_of(c: int) -> int:
	return floori(c / float(REGION_CHUNKS))


## The site inside chunk (cx, cy), or {} when the chunk holds none.
static func site_in_chunk(seed: int, cx: int, cy: int) -> Dictionary:
	var s := site(seed, region_of(cx), region_of(cy))
	var p: Vector2 = s["pos"]
	if OgChunkStore.chunk_of(p.x) == cx and OgChunkStore.chunk_of(p.y) == cy:
		return s
	return {}
