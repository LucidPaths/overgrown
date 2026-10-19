extends RefCounted
## OgTerrain height rules through OgChunkStore: seamless corner grids, height_at on the drawn surface,
## water below the land, determinism.

const C := OgTerrain.CORNERS
const E := OgTerrain.CORNERS - 1


static func _same(a: float, b: float) -> bool:
	return a == b or (is_nan(a) and is_nan(b))


## Pairs of seed 1 chunks with land, coast and river on their shared edges, including negative coordinates.
const SEAM_CHUNKS: Array[Vector2i] = [Vector2i(-2, -6), Vector2i(-5, -1), Vector2i(-1, -1), Vector2i(7, -7), Vector2i(0, 0)]


func test_corner_grids_match_across_chunk_edges(t: TestContext) -> void:
	var water_on_seams := 0
	for a in SEAM_CHUNKS:
		var here := OgChunkStore.build_chunk(1, a.x, a.y)
		var east := OgChunkStore.build_chunk(1, a.x + 1, a.y)
		var south := OgChunkStore.build_chunk(1, a.x, a.y + 1)
		var bad := 0
		for l in C:
			# East edge of `here` (lx = 32) is the west edge of `east` (lx = 0); south edge is the north edge of `south`.
			for pair: Array in [[l * C + E, east, l * C], [E * C + l, south, l]]:
				var i: int = pair[0]
				var other: OgChunkStore.Chunk = pair[1]
				var j: int = pair[2]
				if here.heights[i] != other.heights[j] or not _same(here.water[i], other.water[j]) or here.normals[i] != other.normals[j]:
					bad += 1
				if not is_nan(here.water[i]):
					water_on_seams += 1
		t.check(bad == 0, "chunk %s: %d corners differ from its east or south neighbour" % [str(a), bad])
	t.check(water_on_seams > 0, "no seam corner has water; the water half of this test checks nothing")


func test_height_at_lies_on_the_corner_grid(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	for p: Vector2i in [Vector2i(-60, -60), Vector2i(-152, -28), Vector2i(-44, -176), Vector2i(250, -215), Vector2i(31, 32)]:
		var cx := floori(p.x / float(OgWorld.CHUNK_TILES))
		var cy := floori(p.y / float(OgWorld.CHUNK_TILES))
		var h := store.chunk(cx, cy).heights
		var i := (p.y - cy * OgWorld.CHUNK_TILES) * C + (p.x - cx * OgWorld.CHUNK_TILES)
		var corners := [h[i], h[i + 1], h[i + C], h[i + C + 1]]
		t.check(store.height_at(p.x, p.y) == h[i], "height_at corner (%d, %d) = %f, corner height %f" % [p.x, p.y, store.height_at(p.x, p.y), h[i]])
		for f: Vector2 in [Vector2(0.25, 0.75), Vector2(0.75, 0.25), Vector2(0.5, 0.5), Vector2(0.9, 0.1), Vector2(0.01, 0.99)]:
			var y := store.height_at(p.x + f.x, p.y + f.y)
			t.check(y >= corners.min() - 1e-5 and y <= corners.max() + 1e-5, "height_at (%s) = %f is outside its corners %s" % [str(Vector2(p) + f), y, str(corners)])


## Max ground corner of tile (tx, ty), its min, and the max water surface over it (NaN if none).
func _tile_corners(store: OgChunkStore, tx: int, ty: int) -> Dictionary:
	var cx := floori(tx / float(OgWorld.CHUNK_TILES))
	var cy := floori(ty / float(OgWorld.CHUNK_TILES))
	var c := store.chunk(cx, cy)
	var i := (ty - cy * OgWorld.CHUNK_TILES) * C + (tx - cx * OgWorld.CHUNK_TILES)
	var g := [c.heights[i], c.heights[i + 1], c.heights[i + C], c.heights[i + C + 1]]
	var w := [c.water[i], c.water[i + 1], c.water[i + C], c.water[i + C + 1]]
	return {"min": g.min(), "max": g.max(), "water_min": w.min()}


func test_water_lies_below_the_land(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	# Seed 1 river crossing row ty = -28 (deep at -154..-150, sand banks -158..-157 and -147..-146, grass
	# beyond), and the coast down column tx = -44 (shallow water from -182 to -172, sand from -171).
	for case: Array in [["river", Vector2i(-152, -28), [Vector2i(-159, -28), Vector2i(-145, -28)]], ["coast", Vector2i(-44, -176), [Vector2i(-44, -165)]]]:
		var water_tile: Vector2i = case[1]
		t.check(OgTerrain.is_water(store.tile_at(water_tile.x, water_tile.y)), "%s: %s is not a water tile" % [case[0], str(water_tile)])
		var w := _tile_corners(store, water_tile.x, water_tile.y)
		t.check(not is_nan(w["water_min"]) and w["water_min"] > w["max"], "%s: the water surface over %s (%f) is not above its ground (%f)" % [case[0], str(water_tile), w["water_min"], w["max"]])
		for dry: Vector2i in case[2]:
			t.check(not OgTerrain.is_water(store.tile_at(dry.x, dry.y)), "%s: %s should be dry land" % [case[0], str(dry)])
			var d := _tile_corners(store, dry.x, dry.y)
			t.check(w["max"] < d["min"], "%s: water tile %s corners (max %f) are not below dry land %s (min %f)" % [case[0], str(water_tile), w["max"], str(dry), d["min"]])


func test_heights_are_deterministic(t: TestContext) -> void:
	for c: Vector2i in [Vector2i(-2, -6), Vector2i(3, -1)]:
		var a := OgChunkStore.new(7).chunk(c.x, c.y)
		var b := OgChunkStore.new(7).chunk(c.x, c.y)
		t.check(a.heights.to_byte_array() == b.heights.to_byte_array() and a.water.to_byte_array() == b.water.to_byte_array(), "seed 7 chunk %s: two stores built different heights" % str(c))


## height_at must lie on the drawn ground: barycentric interpolation on the mesher's own triangles (tile
## (lx, ly) at vertices (ly * 32 + lx) * 6 .. + 5) at seeded random points. Tolerance 1e-5 m: the two
## sides evaluate the same plane through different float operations.
func test_height_at_matches_mesh_triangles(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	var rng := OgRng.new(5)
	var checked := 0
	for c: Vector2i in [Vector2i(7, -7), Vector2i(-5, -1), Vector2i(-2, -2), Vector2i(-2, -6)]:
		var verts: PackedVector3Array = OgTerrainMesher.build(store.chunk(c.x, c.y))["ground"][Mesh.ARRAY_VERTEX]
		var origin := Vector2(c.x, c.y) * OgChunkStore.CHUNK_M
		var bad := 0
		for k in 100:
			var p := Vector2(rng.next_float(), rng.next_float()) * OgChunkStore.CHUNK_M
			var v := (floori(p.y) * OgWorld.CHUNK_TILES + floori(p.x)) * 6
			var mesh_y := NAN
			for tri in 2:
				var w := _barycentric(p, verts[v + tri * 3], verts[v + tri * 3 + 1], verts[v + tri * 3 + 2])
				if w.x >= -1e-9 and w.y >= -1e-9 and w.z >= -1e-9:
					mesh_y = w.x * verts[v + tri * 3].y + w.y * verts[v + tri * 3 + 1].y + w.z * verts[v + tri * 3 + 2].y
					break
			var got := store.height_at(origin.x + p.x, origin.y + p.y)
			if is_nan(mesh_y) or absf(got - mesh_y) > 1e-5:
				bad += 1
			checked += 1
		t.check(bad == 0, "chunk %s: %d of 100 points: height_at differs from the mesh triangle under it" % [str(c), bad])
	t.check(checked == 400, "checked %d points, want 400" % checked)


## Barycentric weights of point p (x, z) in the triangle a, b, c (their x, z).
static func _barycentric(p: Vector2, a: Vector3, b: Vector3, c: Vector3) -> Vector3:
	var d := (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
	var wa := ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.y - c.z)) / d
	var wb := ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.y - c.z)) / d
	return Vector3(wa, wb, 1.0 - wa - wb)
