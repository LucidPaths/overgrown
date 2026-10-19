class_name OgTerrain
extends RefCounted
## The height rules: tile heights, the per-chunk corner grids (ground, water surface, normals) and the
## ground height under a world point. Pure static functions of the world fields and world tile
## coordinates, so a corner shared by two chunks gets the same value in both, by construction.
##
## Units: one tile is OgWorld.TILE_M (1 m). Tile (tx, ty) covers x in [tx, tx + 1) and z in [ty, ty + 1);
## tile y-down is +z (south), +y is up. Corner (tx, ty) is the top-left (north-west) corner of tile (tx, ty).
## Each tile quad is split along its TL-BR diagonal into the triangles (TL, TR, BR) and (TL, BR, BL); the
## mesh (render/terrain_mesher.gd) and interpolate() both use this split.
## Float maths uses only + - * /, floor, abs, min, max (and sqrt for normals, which rules never read), so
## a later host and client agree (CLAUDE.md: engine-dependent float math).

## Land height per unit of elevation above OgBiomeMap.OCEAN_BELOW (tunable).
const LAND_SCALE_M := 60.0
## Land height at elevation OgBiomeMap.OCEAN_BELOW. Lifts the beach sand (elevation just below
## OCEAN_BELOW, still the Ocean biome) above sea level (tunable).
const SHORE_M := 2.0
## Extra height per elevation terrace (OgChunkGen.CLIFF_TERRACES) above the mountain line (tunable).
const TERRACE_STEP_M := 4.0
## Ocean floor per depth band, below sea level (tunable). Shallow is shallow enough that a corner shared by
## shallow water and beach sand stays dry, so the drawn shoreline is where the water plane meets the ground,
## not the stepped edge of the water tiles.
const OCEAN_SHALLOW_FLOOR_M := -0.3
const OCEAN_DEEP_FLOOR_M := -2.0
const OCEAN_VERY_DEEP_FLOOR_M := -4.5
## How far river water tiles are carved below the land height of their elevation (tunable).
const RIVER_SHALLOW_CARVE_M := 1.6
const RIVER_DEEP_CARVE_M := 2.8
## River water surface: this far below the mean land height around the corner (tunable). Between 3/4 of
## RIVER_SHALLOW_CARVE_M and all of it, so a bank corner (up to 3 of its 4 tiles water) stays dry and every
## all-water corner is under water: the shoreline runs inside the bank tiles, like the coast.
const RIVER_SURFACE_DROP_M := 1.25
const SEA_LEVEL_M := 0.0

const N := OgWorld.CHUNK_TILES
## Corners per chunk edge: corner l in 0..N.
const CORNERS := N + 1
## Tiles sampled beyond each chunk side. Corners -1..N+1 (normals need one corner past each edge) touch
## tiles -2..N+1.
const RING := 2
const RING_W := N + 2 * RING
## The colour ring handed to the mesher: tiles -1..N, the 4 tiles around each corner 0..N.
const COLOR_RING_W := N + 2

const _MOUNTAIN_TERRACE := floori(OgBiomeMap.MOUNTAIN_FROM * OgChunkGen.CLIFF_TERRACES)


## Dry ground height for an elevation: the land ramp, continuous through the coast and the mountain line.
static func land_height(e: float) -> float:
	return SHORE_M + (e - OgBiomeMap.OCEAN_BELOW) * LAND_SCALE_M


static func is_water(tile: int) -> bool:
	return tile == OgTile.SHALLOW_WATER or tile == OgTile.DEEP_WATER or tile == OgTile.VERY_DEEP_WATER


## Height of tile id `tile` whose elevation sample is e. Ocean water lies below OgBiomeMap.OCEAN_BELOW and
## river water above it (classify_biome checks Ocean first), so the elevation tells the two apart.
static func tile_height(tile: int, e: float) -> float:
	match tile:
		OgTile.STONE, OgTile.CLIFF:
			# Stone and Cliff only occur in the Mountain biome. One step per terrace boundary, the same
			# boundaries pick_tile puts CLIFF tiles on.
			var terrace := maxf(floorf(e * OgChunkGen.CLIFF_TERRACES) - _MOUNTAIN_TERRACE, 0.0)
			return land_height(e) + terrace * TERRACE_STEP_M
		OgTile.SHALLOW_WATER, OgTile.DEEP_WATER, OgTile.VERY_DEEP_WATER:
			if e < OgBiomeMap.OCEAN_BELOW:
				if tile == OgTile.SHALLOW_WATER:
					return OCEAN_SHALLOW_FLOOR_M
				return OCEAN_DEEP_FLOOR_M if tile == OgTile.DEEP_WATER else OCEAN_VERY_DEEP_FLOOR_M
			return land_height(e) - (RIVER_SHALLOW_CARVE_M if tile == OgTile.SHALLOW_WATER else RIVER_DEEP_CARVE_M)
		_:
			return land_height(e)


## Height inside one tile quad from its corners (h00 = TL, h10 = TR, h01 = BL, h11 = BR) at the tile
## fraction (fx, fz) in [0, 1]: the plane of the triangle (TL, TR, BR) where fx >= fz, else (TL, BR, BL).
static func interpolate(h00: float, h10: float, h01: float, h11: float, fx: float, fz: float) -> float:
	if fx >= fz:
		return h00 + (h10 - h00) * fx + (h11 - h10) * fz
	return h00 + (h01 - h00) * fz + (h11 - h01) * fx


## The corner grids of chunk (cx, cy), from its generate_chunk tiles plus the ring sampled directly at world
## tile coordinates (never read from neighbour chunks). Returns {heights, water: PackedFloat32Array(33 * 33),
## normals: PackedVector3Array(33 * 33), ring_tiles, ring_biomes: PackedByteArray(34 * 34)}. Corner index
## ly * CORNERS + lx; colour-ring index (ly + 1) * COLOR_RING_W + (lx + 1) for tile (lx, ly), lx, ly in -1..N.
## water is NaN where no water tile touches the corner. Pure: call it from any thread.
static func corner_grids(f: OgBiomeMap.Fields, cx: int, cy: int, tiles: PackedByteArray, biomes: PackedByteArray) -> Dictionary:
	var tx0 := cx * N - RING
	var ty0 := cy * N - RING
	# Per ring tile (index ry * RING_W + rx, world tile (tx0 + rx, ty0 + ry)): elevation, tile, biome.
	var elev := PackedFloat64Array()
	elev.resize(RING_W * RING_W)
	var rtile := PackedByteArray()
	rtile.resize(RING_W * RING_W)
	var rbiome := PackedByteArray()
	rbiome.resize(RING_W * RING_W)
	var th := PackedFloat64Array()
	th.resize(RING_W * RING_W)
	for ry in RING_W:
		for rx in RING_W:
			var tx := tx0 + rx
			var ty := ty0 + ry
			var i := ry * RING_W + rx
			var lx := rx - RING
			var ly := ry - RING
			var e: float
			if lx >= 0 and lx < N and ly >= 0 and ly < N:
				e = f.elevation.sample(tx, ty)
				rtile[i] = tiles[ly * N + lx]
				rbiome[i] = biomes[ly * N + lx]
			else:
				var s := OgBiomeMap.sample_biome(f, tx, ty)
				var b := OgBiomeMap.classify_biome(s)
				e = s.elevation
				rtile[i] = OgChunkGen.pick_tile(f, s, b, tx, ty)
				rbiome[i] = b
			elev[i] = e
			th[i] = tile_height(rtile[i], e)

	# Ground corners -1..N+1 (extended grid, width CORNERS + 2) for the normals; corner (lx, ly) touches
	# ring tiles (lx - 1 .. lx, ly - 1 .. ly), at ring index offset RING.
	var ew := CORNERS + 2
	var ext := PackedFloat64Array()
	ext.resize(ew * ew)
	for ey in ew:
		for ex in ew:
			var a := (ey - 1 - 1 + RING) * RING_W + (ex - 1 - 1 + RING)
			ext[ey * ew + ex] = (th[a] + th[a + 1] + th[a + RING_W] + th[a + RING_W + 1]) * 0.25

	var heights := PackedFloat32Array()
	heights.resize(CORNERS * CORNERS)
	var water := PackedFloat32Array()
	water.resize(CORNERS * CORNERS)
	var normals := PackedVector3Array()
	normals.resize(CORNERS * CORNERS)
	for ly in CORNERS:
		for lx in CORNERS:
			var ci := ly * CORNERS + lx
			var e0 := (ly + 1) * ew + (lx + 1)
			heights[ci] = ext[e0]
			# Central differences over 2 m: normal (h_west - h_east, 2, h_north - h_south), normalised.
			normals[ci] = Vector3(ext[e0 - 1] - ext[e0 + 1], 2.0, ext[e0 - ew] - ext[e0 + ew]).normalized()
			water[ci] = _water_surface(rtile, elev, (ly - 1 + RING) * RING_W + (lx - 1 + RING))

	var ring_tiles := PackedByteArray()
	ring_tiles.resize(COLOR_RING_W * COLOR_RING_W)
	var ring_biomes := PackedByteArray()
	ring_biomes.resize(COLOR_RING_W * COLOR_RING_W)
	for y in COLOR_RING_W:
		for x in COLOR_RING_W:
			var i := (y - 1 + RING) * RING_W + (x - 1 + RING)
			ring_tiles[y * COLOR_RING_W + x] = rtile[i]
			ring_biomes[y * COLOR_RING_W + x] = rbiome[i]
	return {"heights": heights, "water": water, "normals": normals, "ring_tiles": ring_tiles, "ring_biomes": ring_biomes}


## Water surface at the corner whose top-left touching tile is ring index a: sea level if an ocean water tile
## touches it, else (river water) RIVER_SURFACE_DROP_M below the mean land height of the 4 tiles, else NaN.
static func _water_surface(rtile: PackedByteArray, elev: PackedFloat64Array, a: int) -> float:
	var any_water := false
	var land := 0.0
	for i: int in [a, a + 1, a + RING_W, a + RING_W + 1]:
		if is_water(rtile[i]):
			if elev[i] < OgBiomeMap.OCEAN_BELOW:
				return SEA_LEVEL_M
			any_water = true
		land += land_height(elev[i])
	if not any_water:
		return NAN
	return land * 0.25 - RIVER_SURFACE_DROP_M
