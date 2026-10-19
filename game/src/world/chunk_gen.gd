class_name OgChunkGen
extends RefCounted
## Chunk generator: world seed + chunk coordinates -> tile and biome layers. Mirrors
## sim/src/world/chunk-gen.ts bit for bit (checked against contracts/worldgen-vectors.json by
## tests/test_worldgen.gd). Every field is sampled at world tile coordinates, so chunk borders are seamless.

# Ocean depth bands; Sand from SHALLOW_BELOW up to the coast (tunable).
const VERY_DEEP_BELOW := 0.27
const DEEP_BELOW := 0.32
const SHALLOW_BELOW := 0.355
# River depth: deep only in wide stretches, and only this far in from each bank (tunable).
const RIVER_DEEP_MIN_HALF_WIDTH := 4.0
const RIVER_SHALLOW_RIM := 2.0
# One FORD_WIDTH-tile ford stripe per FORD_CELL-tile cell, per axis (tunable).
const FORD_CELL := 64
const FORD_WIDTH := 3
# Cliffs: steep slope crossing one of CLIFF_TERRACES elevation terraces, gapped where detail is low (tunable).
const CLIFF_TERRACES := 25
const CLIFF_SLOPE := 0.002
const CLIFF_GAP_BELOW := 0.35
const GRASSLAND_DIRT_FROM := 0.68
const FOREST_DIRT_FROM := 0.5

# World tile coords cx * CHUNK_TILES + l must fit in int32, the noise domain.
const CHUNK_MIN := -0x80000000 / OgWorld.CHUNK_TILES
const CHUNK_MAX := 0x80000000 / OgWorld.CHUNK_TILES - 1


static func _in_ford_stripe(ford_seed: int, t: int) -> bool:
	var cell := floori(t / float(FORD_CELL))
	var offset := floori(OgRng.derive_seed(ford_seed, [cell]) / 4294967296.0 * (FORD_CELL - FORD_WIDTH + 1))
	var local := t - cell * FORD_CELL
	return local >= offset and local < offset + FORD_WIDTH


## True on a seeded ford stripe: one FORD_WIDTH-tile stripe per FORD_CELL-tile cell, per axis.
static func is_ford(f: OgBiomeMap.Fields, tx: int, ty: int) -> bool:
	return _in_ford_stripe(f.ford_seed_x, tx) or _in_ford_stripe(f.ford_seed_y, ty)


## The ground tile (an OgTile id) for a biome sample at world tile (tx, ty).
static func pick_tile(f: OgBiomeMap.Fields, s: OgBiomeMap.Sample, biome: int, tx: int, ty: int) -> int:
	var e := s.elevation
	match biome:
		OgBiome.OCEAN:
			if e < VERY_DEEP_BELOW:
				return OgTile.VERY_DEEP_WATER
			if e < DEEP_BELOW:
				return OgTile.DEEP_WATER
			if e < SHALLOW_BELOW:
				return OgTile.SHALLOW_WATER
			return OgTile.SAND
		OgBiome.MOUNTAIN:
			var e_r := f.elevation.sample(tx + 1, ty)
			var e_d := f.elevation.sample(tx, ty + 1)
			var slope := maxf(absf(e_r - e), absf(e_d - e))
			var k := floorf(e * CLIFF_TERRACES)
			var crosses := floorf(e_r * CLIFF_TERRACES) != k or floorf(e_d * CLIFF_TERRACES) != k
			return OgTile.CLIFF if slope >= CLIFF_SLOPE and crosses and f.detail.sample(tx, ty) >= CLIFF_GAP_BELOW else OgTile.STONE
		OgBiome.RIVER:
			if s.river_dist >= s.river_half_width:
				return OgTile.SAND
			if s.river_half_width >= RIVER_DEEP_MIN_HALF_WIDTH and s.river_dist < s.river_half_width - RIVER_SHALLOW_RIM and not is_ford(f, tx, ty):
				return OgTile.DEEP_WATER
			return OgTile.SHALLOW_WATER
		OgBiome.FOREST:
			return OgTile.DIRT if f.detail.sample(tx, ty) >= FOREST_DIRT_FROM else OgTile.GRASS
		_:
			return OgTile.DIRT if f.detail.sample(tx, ty) >= GRASSLAND_DIRT_FROM else OgTile.GRASS


static func _chunk_coord_ok(name: String, value: Variant) -> bool:
	if typeof(value) != TYPE_INT or value < CHUNK_MIN or value > CHUNK_MAX:
		OgWorld.report("%s must be an integer in %d..%d, got %s" % [name, CHUNK_MIN, CHUNK_MAX, str(value)])
		return false
	return true


## Returns {cx, cy, tiles: PackedByteArray(1024), biomes: PackedByteArray(1024)}, local index
## ly * CHUNK_TILES + lx. seed, cx and cy must be TYPE_INT (seed in 0..4294967295, cx and cy in
## CHUNK_MIN..CHUNK_MAX); otherwise the error is reported and the result is the empty Dictionary.
static func generate_chunk(seed: Variant, cx: Variant, cy: Variant) -> Dictionary:
	if typeof(seed) != TYPE_INT or seed < 0 or seed > OgWorld.U32_MAX:
		OgWorld.report("seed must be an integer in 0..4294967295, got %s" % str(seed))
		return {}
	if not _chunk_coord_ok("cx", cx) or not _chunk_coord_ok("cy", cy):
		return {}
	var f := OgBiomeMap.create_world_fields(seed)
	var n := OgWorld.CHUNK_TILES
	var tiles := PackedByteArray()
	tiles.resize(n * n)
	var biomes := PackedByteArray()
	biomes.resize(n * n)
	var tx0: int = cx * n
	var ty0: int = cy * n
	for ly in n:
		for lx in n:
			var tx := tx0 + lx
			var ty := ty0 + ly
			var i := ly * n + lx
			var s := OgBiomeMap.sample_biome(f, tx, ty)
			var b := OgBiomeMap.classify_biome(s)
			biomes[i] = b
			tiles[i] = pick_tile(f, s, b, tx, ty)
	return {"cx": cx, "cy": cy, "tiles": tiles, "biomes": biomes}
