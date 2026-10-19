extends RefCounted
## OgChunkStore: on-demand lookups, the streaming rules ported from sim/src/world/chunk-store.ts, and the
## worker-thread generation (results, in-flight lookups, the recent-chunk LRU).

const N := OgWorld.CHUNK_TILES
const SETTLE_LIMIT_MS := 60000


## Steps the store until nothing is in flight and the plan loads nothing more. False on the time limit.
func _settle(store: OgChunkStore, anchors: Array[Vector2]) -> bool:
	store.set_anchors(anchors)
	var start := Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < SETTLE_LIMIT_MS:
		store.step()
		if store.in_flight_count() == 0 and OgChunkStore.plan_stream(anchors, store.loaded_coords())["load"].is_empty():
			return true
		OS.delay_msec(2)
	return false


## The chunks within `radius` (Chebyshev) of chunk (cx, cy), sorted by (y, x) like loaded_coords().
func _square(cx: int, cy: int, radius: int) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for y in range(cy - radius, cy + radius + 1):
		for x in range(cx - radius, cx + radius + 1):
			out.append(Vector2i(x, y))
	return out


## World metres at the centre of chunk (cx, cy).
func _centre(cx: int, cy: int) -> Vector2:
	return Vector2((cx + 0.5) * OgChunkStore.CHUNK_M, (cy + 0.5) * OgChunkStore.CHUNK_M)


func test_lookups_equal_generate_chunk(t: TestContext) -> void:
	var store := OgChunkStore.new(42)
	for p: Vector2i in [Vector2i(0, 0), Vector2i(31, 31), Vector2i(32, 0), Vector2i(-1, -1), Vector2i(-33, 5), Vector2i(100, -77), Vector2i(-64, -65)]:
		var cx := floori(p.x / float(N))
		var cy := floori(p.y / float(N))
		var g := OgChunkGen.generate_chunk(42, cx, cy)
		var i := (p.y - cy * N) * N + (p.x - cx * N)
		t.check(store.tile_at(p.x, p.y) == g["tiles"][i], "tile_at(%d, %d) = %d, generate_chunk says %d" % [p.x, p.y, store.tile_at(p.x, p.y), g["tiles"][i]])
		t.check(store.biome_at(p.x, p.y) == g["biomes"][i], "biome_at(%d, %d) = %d, generate_chunk says %d" % [p.x, p.y, store.biome_at(p.x, p.y), g["biomes"][i]])


func test_streaming_radius_and_hysteresis(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	var loaded: Array[Vector2i] = []
	var unloaded: Array[Vector2i] = []
	store.chunk_loaded.connect(func(cx: int, cy: int) -> void: loaded.append(Vector2i(cx, cy)))
	store.chunk_unloaded.connect(func(cx: int, cy: int) -> void: unloaded.append(Vector2i(cx, cy)))
	if not _settle(store, [_centre(0, 0)]):
		t.fail("streaming around chunk (0, 0) did not settle")
		return
	t.check(store.loaded_coords() == _square(0, 0, OgChunkStore.LOAD_RADIUS), "loaded set around (0, 0) is not the radius-3 square: %s" % str(store.loaded_coords()))
	t.check(loaded.size() == 49 and unloaded.is_empty(), "first load: %d loaded, %d unloaded signals (want 49, 0)" % [loaded.size(), unloaded.size()])
	# One chunk east: only the new column x = 4 loads; column x = -3 is 4 away, inside the unload radius.
	loaded.clear()
	if not _settle(store, [_centre(1, 0)]):
		t.fail("streaming around chunk (1, 0) did not settle")
		return
	var col4: Array[Vector2i] = []
	for y in range(-3, 4):
		col4.append(Vector2i(4, y))
	loaded.sort()
	t.check(loaded == col4, "moving to (1, 0) loaded %s, want column x = 4" % str(loaded))
	t.check(unloaded.is_empty(), "moving to (1, 0) unloaded %s, want nothing (hysteresis)" % str(unloaded))
	t.check(store.loaded_coords().size() == 56, "after (1, 0): %d loaded, want 56" % store.loaded_coords().size())
	# Another chunk east: column x = -3 is now 5 away and unloads; column x = 5 loads.
	loaded.clear()
	if not _settle(store, [_centre(2, 0)]):
		t.fail("streaming around chunk (2, 0) did not settle")
		return
	var col_m3: Array[Vector2i] = []
	var col5: Array[Vector2i] = []
	for y in range(-3, 4):
		col_m3.append(Vector2i(-3, y))
		col5.append(Vector2i(5, y))
	loaded.sort()
	unloaded.sort()
	t.check(loaded == col5, "moving to (2, 0) loaded %s, want column x = 5" % str(loaded))
	t.check(unloaded == col_m3, "moving to (2, 0) unloaded %s, want column x = -3" % str(unloaded))


## Streamed chunks equal the synchronous build byte for byte (layers equal generate_chunk).
func _check_async_equals_sync(t: TestContext, store: OgChunkStore, seed: int, coords: Array[Vector2i]) -> void:
	for c in coords:
		t.check(store.is_loaded(c.x, c.y), "chunk %s should be loaded" % str(c))
		var got := store.chunk(c.x, c.y)
		var g := OgChunkGen.generate_chunk(seed, c.x, c.y)
		var want := OgChunkStore.build_chunk(seed, c.x, c.y)
		t.check(got.tiles == g["tiles"] and got.biomes == g["biomes"], "chunk %s: streamed layers differ from generate_chunk" % str(c))
		# Byte comparison: NaN water corners compare equal by bit pattern.
		t.check(got.heights.to_byte_array() == want.heights.to_byte_array(), "chunk %s: streamed heights differ from build_chunk" % str(c))
		t.check(got.water.to_byte_array() == want.water.to_byte_array(), "chunk %s: streamed water differs from build_chunk" % str(c))
		t.check(got.normals == want.normals and got.ring_tiles == want.ring_tiles and got.ring_biomes == want.ring_biomes, "chunk %s: streamed normals or rings differ" % str(c))


func test_lookup_of_in_flight_chunk_waits(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	store.set_anchors([_centre(-4, 7)])
	store.step()
	t.check(store.generations == OgChunkStore.MAX_JOBS_IN_FLIGHT, "first step started %d generations, want %d" % [store.generations, OgChunkStore.MAX_JOBS_IN_FLIGHT])
	# The anchor's own chunk is first in load order, so it is in flight now.
	if not store.in_flight(-4, 7):
		t.fail("chunk (-4, 7) should be in flight after the first step")
		return
	var tx := -4 * N + 5
	var ty := 7 * N + 9
	var want: int = OgChunkGen.generate_chunk(1, -4, 7)["tiles"][9 * N + 5]
	t.check(store.tile_at(tx, ty) == want, "tile_at(%d, %d) on an in-flight chunk = %d, want %d" % [tx, ty, store.tile_at(tx, ty), want])
	t.check(store.generations == OgChunkStore.MAX_JOBS_IN_FLIGHT, "tile_at on an in-flight chunk generated it again (%d generations)" % store.generations)
	t.check(not store.in_flight(-4, 7), "chunk (-4, 7) should no longer be in flight after the lookup")


## Also checks that streamed (worker-thread) results equal the synchronous build.
func test_unloaded_chunk_returns_from_lru(t: TestContext) -> void:
	var store := OgChunkStore.new(1)
	if not _settle(store, [_centre(0, 0)]):
		t.fail("streaming around chunk (0, 0) did not settle")
		return
	_check_async_equals_sync(t, store, 1, [Vector2i(0, 0), Vector2i(-3, 2), Vector2i(3, -3), Vector2i(-1, -1)])
	# Five chunks east: columns -3..0 (28 chunks) unload into the LRU, columns 4..8 (35) generate.
	if not _settle(store, [_centre(5, 0)]):
		t.fail("streaming around chunk (5, 0) did not settle")
		return
	t.check(store.generations == 84, "after moving east: %d generations, want 84" % store.generations)
	t.check(store.recent_count() == 28, "after moving east: %d recent chunks, want 28" % store.recent_count())
	if not _settle(store, [_centre(0, 0)]):
		t.fail("streaming back around chunk (0, 0) did not settle")
		return
	t.check(store.generations == 84, "coming back regenerated %d chunks; they should come from the LRU" % (store.generations - 84))
	for c in _square(0, 0, OgChunkStore.LOAD_RADIUS):
		t.check(store.is_loaded(c.x, c.y), "chunk %s should be loaded again" % str(c))
