class_name OgTerrainMesher
extends RefCounted
## Builds the mesh arrays of one chunk from its OgChunkStore.Chunk: a 32 x 32 quad grid of the ground with
## vertex colours and the chunk's smooth normals, and one water surface over the water tiles. Pure and
## static: runs on WorkerThreadPool threads and only reads the chunk (never modified after load).
##
## Vertices are chunk-local metres (the MeshInstance3D sits at the chunk's world origin). Each quad is
## split along its TL-BR diagonal, the split OgTerrain.interpolate (and so height_at) uses. Triangles are
## clockwise seen from above (Godot's front face).

const N := OgWorld.CHUNK_TILES
const CORNERS := OgTerrain.CORNERS
const RW := OgTerrain.COLOR_RING_W

## Placeholder palette until G1 (sRGB): mood-board direction, warm gold and orange land, cool stone,
## teal water. Tile colour times the biome tint.
const TILE_COLORS := {
	OgTile.GRASS: Color(0.36, 0.46, 0.22),
	OgTile.DIRT: Color(0.50, 0.38, 0.24),
	OgTile.SAND: Color(0.84, 0.72, 0.50),
	OgTile.STONE: Color(0.50, 0.53, 0.58),
	OgTile.CLIFF: Color(0.28, 0.29, 0.36),
	OgTile.SHALLOW_WATER: Color(0.62, 0.56, 0.40),
	OgTile.DEEP_WATER: Color(0.30, 0.36, 0.34),
	OgTile.VERY_DEEP_WATER: Color(0.16, 0.24, 0.27),
}
const BIOME_TINTS := {
	OgBiome.GRASSLAND: Color(1.10, 1.02, 0.80),
	OgBiome.FOREST: Color(0.62, 0.82, 0.84),
	OgBiome.RIVER: Color(0.92, 0.94, 0.88),
	OgBiome.MOUNTAIN: Color(0.96, 0.98, 1.04),
	OgBiome.OCEAN: Color(1.00, 1.00, 1.00),
}
## Brightness jitter per tile, +- this fraction (breaks up flat fields).
const TILE_JITTER := 0.08
## Water vertex colour (sRGB, alpha = opacity) from shallow to WATER_DEEP_M of depth.
const WATER_SHALLOW := Color(0.36, 0.78, 0.74, 0.42)
const WATER_DEEP := Color(0.06, 0.30, 0.38, 0.88)
const WATER_DEEP_M := 3.0


## Returns {"ground": Array (Mesh.ARRAY_MAX surface arrays), "water": Array (surface arrays, or empty when
## the chunk has no water tile)}.
static func build(c: OgChunkStore.Chunk) -> Dictionary:
	return {"ground": _ground(c), "water": _water(c)}


static func _tile_color(tile: int, biome: int, tx: int, ty: int) -> Color:
	var k := 1.0 + TILE_JITTER * (OgRng.mix_seed_part(OgRng.mix_seed_part(0x51ED, tx), ty) / 2147483648.0 - 1.0)
	var col: Color = TILE_COLORS[tile] * BIOME_TINTS[biome]
	return Color(col.r * k, col.g * k, col.b * k)


static func _ground(c: OgChunkStore.Chunk) -> Array:
	# Colour per ring tile first (each is shared by 4 corners), then the corner mean.
	var tile_cols := PackedColorArray()
	tile_cols.resize(RW * RW)
	for y in RW:
		for x in RW:
			var i := y * RW + x
			tile_cols[i] = _tile_color(c.ring_tiles[i], c.ring_biomes[i], c.cx * N + x - 1, c.cy * N + y - 1)
	var verts := PackedVector3Array()
	verts.resize(CORNERS * CORNERS)
	var colors := PackedColorArray()
	colors.resize(CORNERS * CORNERS)
	for ly in CORNERS:
		for lx in CORNERS:
			var ci := ly * CORNERS + lx
			verts[ci] = Vector3(lx * OgWorld.TILE_M, c.heights[ci], ly * OgWorld.TILE_M)
			var a := ly * RW + lx # ring tile (lx - 1, ly - 1), the top-left one touching the corner
			colors[ci] = (tile_cols[a] + tile_cols[a + 1] + tile_cols[a + RW] + tile_cols[a + RW + 1]) * 0.25
	var indices := PackedInt32Array()
	indices.resize(N * N * 6)
	var k := 0
	for ly in N:
		for lx in N:
			var tl := ly * CORNERS + lx
			k = _quad(indices, k, tl, tl + 1, tl + CORNERS, tl + CORNERS + 1)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = c.normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	return arrays


## Writes the two triangles (TL, TR, BR) and (TL, BR, BL) at indices[k]; returns the next k.
static func _quad(indices: PackedInt32Array, k: int, tl: int, tr: int, bl: int, br: int) -> int:
	indices[k] = tl
	indices[k + 1] = tr
	indices[k + 2] = br
	indices[k + 3] = tl
	indices[k + 4] = br
	indices[k + 5] = bl
	return k + 6


static func _water(c: OgChunkStore.Chunk) -> Array:
	# One vertex per corner of a water tile (all 4 have a water height by construction).
	var vertex_of := PackedInt32Array()
	vertex_of.resize(CORNERS * CORNERS)
	vertex_of.fill(-1)
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	for ly in N:
		for lx in N:
			if not OgTerrain.is_water(c.tiles[ly * N + lx]):
				continue
			var q: Array[int] = []
			for corner: Vector2i in [Vector2i(lx, ly), Vector2i(lx + 1, ly), Vector2i(lx, ly + 1), Vector2i(lx + 1, ly + 1)]:
				var ci := corner.y * CORNERS + corner.x
				if vertex_of[ci] < 0:
					vertex_of[ci] = verts.size()
					verts.append(Vector3(corner.x * OgWorld.TILE_M, c.water[ci], corner.y * OgWorld.TILE_M))
					var depth := clampf((c.water[ci] - c.heights[ci]) / WATER_DEEP_M, 0.0, 1.0)
					colors.append(WATER_SHALLOW.lerp(WATER_DEEP, depth))
				q.append(vertex_of[ci])
			indices.resize(indices.size() + 6)
			_quad(indices, indices.size() - 6, q[0], q[1], q[2], q[3])
	if verts.is_empty():
		return []
	var normals := PackedVector3Array()
	normals.resize(verts.size())
	normals.fill(Vector3.UP)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	return arrays
