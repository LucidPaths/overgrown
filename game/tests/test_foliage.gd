extends RefCounted
## OgFoliage (ART-027): seeded prop placement is deterministic, and every prop stands on dry land inside its
## own chunk (props are drawn chunk-local; a wrong offset would put trees in rivers or across seams).

## Seed 1 chunks with grassland, forest, river banks and mountain, including negative coordinates.
const CHUNKS: Array[Vector2i] = [Vector2i(-2, -2), Vector2i(-5, -1), Vector2i(-2, -3), Vector2i(-6, -1), Vector2i(0, 0)]


func test_placement_is_deterministic(t: TestContext) -> void:
	var counts := PackedInt32Array()
	counts.resize(OgFoliage.KIND_COUNT)
	for k in CHUNKS:
		var a := OgFoliage.place(1, OgChunkStore.build_chunk(1, k.x, k.y))
		var b := OgFoliage.place(1, OgChunkStore.build_chunk(1, k.x, k.y))
		for kind in OgFoliage.KIND_COUNT:
			t.check(a[kind] == b[kind], "chunk %s: %s placement differs between two runs" % [str(k), OgFoliage.KIND_NAMES[kind]])
			counts[kind] += a[kind].size() / OgFoliage.FLOATS
	for kind in [OgFoliage.KIND_GRASS, OgFoliage.KIND_PINE, OgFoliage.KIND_TREE, OgFoliage.KIND_ROCK, OgFoliage.KIND_REED]:
		t.check(counts[kind] > 0, "no %s in the test chunks; this test checks nothing for it" % OgFoliage.KIND_NAMES[kind])
	var other := OgFoliage.place(2, OgChunkStore.build_chunk(2, CHUNKS[0].x, CHUNKS[0].y))
	t.check(other[OgFoliage.KIND_GRASS] != OgFoliage.place(1, OgChunkStore.build_chunk(1, CHUNKS[0].x, CHUNKS[0].y))[OgFoliage.KIND_GRASS],
		"seeds 1 and 2 place the same grass")


func test_props_stand_on_dry_land_in_their_chunk(t: TestContext) -> void:
	for k in CHUNKS:
		var c := OgChunkStore.build_chunk(1, k.x, k.y)
		var props := OgFoliage.place(1, c)
		for kind in OgFoliage.KIND_COUNT:
			var buf: PackedFloat32Array = props[kind]
			var bad := 0
			for i in range(0, buf.size(), OgFoliage.FLOATS):
				var lx := buf[i + 3]
				var lz := buf[i + 11]
				if lx < 0.0 or lx >= OgWorld.CHUNK_TILES or lz < 0.0 or lz >= OgWorld.CHUNK_TILES:
					bad += 1
					continue
				var tile := c.tiles[floori(lz) * OgWorld.CHUNK_TILES + floori(lx)]
				if OgTerrain.is_water(tile) or tile == OgTile.CLIFF:
					bad += 1
			t.check(bad == 0, "chunk %s: %d %s outside the chunk or on water or cliff" % [str(k), bad, OgFoliage.KIND_NAMES[kind]])
