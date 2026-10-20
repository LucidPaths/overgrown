class_name OgTerrainMesher
extends RefCounted
## Builds the mesh arrays of one chunk from its OgChunkStore.Chunk: the ground (two triangles per tile, each
## tile with its own vertices so tile colours stay crisp) and one water surface over the water tiles. Pure
## and static: runs on WorkerThreadPool threads and only reads the chunk (never modified after load).
##
## Vertices are chunk-local metres (the MeshInstance3D sits at the chunk's world origin). The ground is a
## plain triangle list, tile (lx, ly) at vertices (ly * N + lx) * 6 .. + 5: its two triangles, split along
## the diagonal OgTerrain.split_tl_br picks, the split OgTerrain.interpolate (and so height_at) uses.
## Triangles are clockwise seen from above (Godot's front face). Ground triangles use the chunk's smooth
## corner normals; mountain wall triangles (Stone or Cliff, steeper than WALL_NORMAL_Y) get their flat face
## normal and the rock colour, so terrace walls read as walls.

const N := OgWorld.CHUNK_TILES
const CORNERS := OgTerrain.CORNERS
const RW := OgTerrain.COLOR_RING_W

## Cliff tiles and mountain walls (sRGB; the terrain shader paints strata over it).
const ROCK := Color(0.30, 0.25, 0.25, KIND_WALL)
## A Stone or Cliff triangle whose face normal's y is below this is a wall (about 37 degrees; tunable).
const WALL_NORMAL_Y := 0.8
## How far each tile corner's colour moves toward the mean of the 4 tiles around the corner: 0 is a hard
## tile edge, 1 a gradient across the whole tile (tunable).
const EDGE_SOFTEN := 0.85
## Surface kinds, carried in the vertex colour's alpha for the terrain shader (terrain.gdshader).
const KIND_GRASS := 1.0
const KIND_DIRT := 0.75
const KIND_SAND := 0.5
const KIND_STONE := 0.25
const KIND_WALL := 0.0
## The G1 ground palette (sRGB; docs/art/BIBLE.md "Palette"): olive-gold grass, burnt-sienna earth, cool
## violet stone. Tile colour times the biome tint; alpha is the surface kind.
const TILE_COLORS := {
	OgTile.GRASS: Color(0.42, 0.50, 0.21, KIND_GRASS),
	OgTile.DIRT: Color(0.50, 0.32, 0.17, KIND_DIRT),
	OgTile.SAND: Color(0.80, 0.64, 0.40, KIND_SAND),
	OgTile.STONE: Color(0.42, 0.42, 0.47, KIND_STONE),
	OgTile.CLIFF: ROCK,
	OgTile.SHALLOW_WATER: Color(0.55, 0.46, 0.30, KIND_SAND),
	OgTile.DEEP_WATER: Color(0.30, 0.30, 0.24, KIND_DIRT),
	OgTile.VERY_DEEP_WATER: Color(0.16, 0.20, 0.20, KIND_DIRT),
}
## Biome tints (alpha 1 keeps the kind): Grassland warm gold, Forest deep teal moss, River lush.
const BIOME_TINTS := {
	OgBiome.GRASSLAND: Color(1.08, 1.02, 0.82),
	OgBiome.FOREST: Color(0.50, 0.78, 0.80),
	OgBiome.RIVER: Color(0.80, 1.00, 0.86),
	OgBiome.MOUNTAIN: Color(0.98, 0.97, 1.02),
	OgBiome.OCEAN: Color(1.00, 1.00, 1.00),
}
## Brightness jitter per tile, +- this fraction (breaks up flat fields).
const TILE_JITTER := 0.025
## Extra brightness jitter on stone per STONE_PATCH_TILES square, +- this fraction (plateau variation).
const STONE_PATCH_JITTER := 0.06
const STONE_PATCH_TILES := 6.0
## Water vertex colour (sRGB, alpha = opacity) from shallow to WATER_DEEP_M of depth.
const WATER_SHALLOW := Color(0.30, 0.72, 0.70, 0.5)
const WATER_DEEP := Color(0.06, 0.30, 0.38, 0.88)
const WATER_DEEP_M := 3.0


## Returns {"ground": Array (Mesh.ARRAY_MAX surface arrays), "water": Array (surface arrays, or empty when
## the chunk has no water tile)}.
static func build(c: OgChunkStore.Chunk) -> Dictionary:
	return {"ground": _ground(c), "water": _water(c)}


## +-1 hash of a world tile (or patch) coordinate, for colour jitter only.
static func _hash(salt: int, x: int, y: int) -> float:
	return OgRng.mix_seed_part(OgRng.mix_seed_part(salt, x), y) / 2147483648.0 - 1.0


static func _tile_color(tile: int, biome: int, tx: int, ty: int) -> Color:
	var k := 1.0 + TILE_JITTER * _hash(0x51ED, tx, ty)
	if tile == OgTile.STONE:
		k += STONE_PATCH_JITTER * _hash(0x570E, floori(tx / STONE_PATCH_TILES), floori(ty / STONE_PATCH_TILES))
	var col: Color = TILE_COLORS[tile] * BIOME_TINTS[biome]
	return Color(col.r * k, col.g * k, col.b * k, col.a)


static func _ground(c: OgChunkStore.Chunk) -> Array:
	# Colour per ring tile (index (ly + 1) * RW + lx + 1), then per corner the mean of its 4 tiles.
	var tile_cols := PackedColorArray()
	tile_cols.resize(RW * RW)
	for y in RW:
		for x in RW:
			var i := y * RW + x
			tile_cols[i] = _tile_color(c.ring_tiles[i], c.ring_biomes[i], c.cx * N + x - 1, c.cy * N + y - 1)
	var corner_cols := PackedColorArray()
	corner_cols.resize(CORNERS * CORNERS)
	for ly in CORNERS:
		for lx in CORNERS:
			var a := ly * RW + lx # ring tile (lx - 1, ly - 1), the top-left one touching the corner
			corner_cols[ly * CORNERS + lx] = (tile_cols[a] + tile_cols[a + 1] + tile_cols[a + RW] + tile_cols[a + RW + 1]) * 0.25
	var verts := PackedVector3Array()
	verts.resize(N * N * 6)
	var normals := PackedVector3Array()
	normals.resize(N * N * 6)
	var colors := PackedColorArray()
	colors.resize(N * N * 6)
	for ly in N:
		for lx in N:
			var tl := ly * CORNERS + lx
			var tr := tl + 1
			var bl := tl + CORNERS
			var br := bl + 1
			var corners: PackedInt32Array
			if OgTerrain.split_tl_br(c.heights[tl], c.heights[tr], c.heights[bl], c.heights[br]):
				corners = PackedInt32Array([tl, tr, br, tl, br, bl])
			else:
				corners = PackedInt32Array([tl, tr, bl, tr, br, bl])
			var tile := c.tiles[ly * N + lx]
			var own := tile_cols[(ly + 1) * RW + lx + 1]
			var mountain := tile == OgTile.STONE or tile == OgTile.CLIFF
			var v := (ly * N + lx) * 6
			for t in 2:
				var p: Array[Vector3] = []
				for j in 3:
					var ci := corners[t * 3 + j]
					p.append(Vector3((ci % CORNERS) * OgWorld.TILE_M, c.heights[ci], floori(ci / float(CORNERS)) * OgWorld.TILE_M))
				var face := (p[2] - p[0]).cross(p[1] - p[0]).normalized() # up for clockwise-from-above
				var wall := mountain and face.y < WALL_NORMAL_Y
				for j in 3:
					var ci := corners[t * 3 + j]
					verts[v + t * 3 + j] = p[j]
					normals[v + t * 3 + j] = face if wall else c.normals[ci]
					colors[v + t * 3 + j] = ROCK if wall else own.lerp(corner_cols[ci], EDGE_SOFTEN)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	return arrays


## Writes a water quad's two triangles at indices[k], split as OgTerrain.split_tl_br decides from the
## corner heights h (indexed like the vertices); returns the next k.
static func _quad(indices: PackedInt32Array, k: int, h: PackedFloat32Array, tl: int, tr: int, bl: int, br: int) -> int:
	if OgTerrain.split_tl_br(h[tl], h[tr], h[bl], h[br]):
		indices[k] = tl
		indices[k + 1] = tr
		indices[k + 2] = br
		indices[k + 3] = tl
		indices[k + 4] = br
		indices[k + 5] = bl
	else:
		indices[k] = tl
		indices[k + 1] = tr
		indices[k + 2] = bl
		indices[k + 3] = tr
		indices[k + 4] = br
		indices[k + 5] = bl
	return k + 6


static func _water(c: OgChunkStore.Chunk) -> Array:
	# One vertex per corner of a water tile (all 4 have a water height by construction).
	var vertex_of := PackedInt32Array()
	vertex_of.resize(CORNERS * CORNERS)
	vertex_of.fill(-1)
	var verts := PackedVector3Array()
	var surface := PackedFloat32Array() # water height per vertex, for the quad split
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
					surface.append(c.water[ci])
					var depth := clampf((c.water[ci] - c.heights[ci]) / WATER_DEEP_M, 0.0, 1.0)
					colors.append(WATER_SHALLOW.lerp(WATER_DEEP, depth))
				q.append(vertex_of[ci])
			indices.resize(indices.size() + 6)
			_quad(indices, indices.size() - 6, surface, q[0], q[1], q[2], q[3])
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
