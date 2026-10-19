extends RefCounted
## The GDScript worldgen (game/src/world/) against contracts/worldgen-vectors.json, shared with the TS worldgen
## (sim/src/world/*.test.ts). Chunk digests, spawns and noise samples must match exactly; noise samples are
## compared by float64 bit pattern, never approximately (Godot's JSON float parsing is not correctly rounded,
## so the fixture stores bits as hex).

const VECTORS_PATH := "../contracts/worldgen-vectors.json"


func _vectors(t: TestContext) -> Dictionary:
	var path := ProjectSettings.globalize_path("res://").path_join(VECTORS_PATH)
	if not FileAccess.file_exists(path):
		t.fail("vectors file missing: %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary:
		t.fail("vectors file is not a JSON object: %s" % path)
		return {}
	return parsed


## Runs fn with errors captured instead of printed. Returns {"result": fn's return value, "errors": messages}.
func _run(fn: Callable) -> Dictionary:
	var messages: Array[String] = []
	OgRng.error_hook = func(msg: String) -> void: messages.append(msg)
	var result: Variant = fn.call()
	OgRng.error_hook = Callable()
	return {"result": result, "errors": messages}


## The IEEE-754 bit pattern of v as 16 lowercase hex digits (most significant byte first), like the fixture.
func _bits(v: float) -> String:
	var b := PackedByteArray()
	b.resize(8)
	b.encode_double(0, v)
	var hex := ""
	for i in range(7, -1, -1):
		hex += "%02x" % b[i]
	return hex


## deriveSeed(0, ...bytes) in TS.
func _digest(bytes: PackedByteArray) -> int:
	var parts: Array = []
	for v in bytes:
		parts.append(v)
	return OgRng.derive_seed(0, parts)


func test_chunk_digests(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var list: Array = v["chunks"]
	for entry: Dictionary in list:
		var seed := int(entry["seed"])
		var cx := int(entry["cx"])
		var cy := int(entry["cy"])
		var chunk := OgChunkGen.generate_chunk(seed, cx, cy)
		if chunk.is_empty():
			t.fail("seed %d chunk (%d, %d): generate_chunk returned nothing" % [seed, cx, cy])
			continue
		t.check(chunk["cx"] == cx and chunk["cy"] == cy, "seed %d chunk (%d, %d): wrong coordinates in the result" % [seed, cx, cy])
		t.check(chunk["tiles"].size() == 1024 and chunk["biomes"].size() == 1024, "seed %d chunk (%d, %d): layers are not 1024 long" % [seed, cx, cy])
		var tiles_digest := _digest(chunk["tiles"])
		var biomes_digest := _digest(chunk["biomes"])
		if tiles_digest != int(entry["tilesDigest"]):
			t.fail("seed %d chunk (%d, %d) tiles: got %d, expected %d" % [seed, cx, cy, tiles_digest, int(entry["tilesDigest"])])
		if biomes_digest != int(entry["biomesDigest"]):
			t.fail("seed %d chunk (%d, %d) biomes: got %d, expected %d" % [seed, cx, cy, biomes_digest, int(entry["biomesDigest"])])
	t.check(list.size() == 10, "expected 10 chunk vectors, found %d" % list.size())


func test_spawns(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var list: Array = v["spawn"]
	for entry: Dictionary in list:
		var seed := int(entry["seed"])
		var got := OgSpawn.find_spawn(seed)
		if got.is_empty():
			t.fail("seed %d: find_spawn returned nothing" % seed)
		elif got["x"] != int(entry["x"]) or got["y"] != int(entry["y"]):
			t.fail("seed %d: spawn got (%d, %d), expected (%d, %d)" % [seed, got["x"], got["y"], int(entry["x"]), int(entry["y"])])
	t.check(list.size() == 5, "expected 5 spawn vectors, found %d" % list.size())


func test_noise_samples(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var list: Array = v["noise"]
	for entry: Dictionary in list:
		var wavelengths: Array = []
		for w in entry["wavelengths"]:
			wavelengths.append(int(w))
		var fbm := OgNoise.create_fbm(int(entry["seed"]), wavelengths)
		if fbm == null:
			t.fail("seed %d %s: create_fbm returned null" % [entry["seed"], str(wavelengths)])
			continue
		var got := _bits(fbm.sample(float(entry["x"]), float(entry["y"])))
		if got != entry["bits"]:
			t.fail("seed %d %s at (%s, %s): bits %s, expected %s" % [entry["seed"], str(wavelengths), str(entry["x"]), str(entry["y"]), got, entry["bits"]])
	t.check(list.size() == 8, "expected 8 noise vectors, found %d" % list.size())


# Border-tile equality across chunk seams: every tile of the chunks on both sides of each seam equals the
# per-tile functions evaluated at its world tile coordinates, so no seam can differ from the continuous field.
func test_chunks_equal_per_tile_functions_across_seams(t: TestContext) -> void:
	var f := OgBiomeMap.create_world_fields(42)
	var n := OgWorld.CHUNK_TILES
	for c: Array in [[-1, -1], [0, -1], [-1, 0], [0, 0], [-3, 10], [-9, 10]]:
		var chunk := OgChunkGen.generate_chunk(42, c[0], c[1])
		var bad := 0
		for ly in n:
			for lx in n:
				var tx: int = c[0] * n + lx
				var ty: int = c[1] * n + ly
				var s := OgBiomeMap.sample_biome(f, tx, ty)
				var b := OgBiomeMap.classify_biome(s)
				if chunk["biomes"][ly * n + lx] != b or chunk["tiles"][ly * n + lx] != OgChunkGen.pick_tile(f, s, b, tx, ty):
					bad += 1
		t.check(bad == 0, "chunk (%d, %d): %d tiles differ from the per-tile functions" % [c[0], c[1], bad])


func test_rejects_invalid_input(t: TestContext) -> void:
	var bad_chunks := [
		[42, 0.5, 0], # fractional cx
		[42, 67108864, 0], # cx one past the range
		[42, 0, -67108865], # cy one before the range
		[-1, 0, 0], # seed below 0
		[4294967296, 0, 0], # seed above u32
		[1.5, 0, 0], # fractional seed
	]
	for c: Array in bad_chunks:
		var r := _run(func() -> Dictionary: return OgChunkGen.generate_chunk(c[0], c[1], c[2]))
		t.check(r["result"].is_empty() and r["errors"].size() == 1, "generate_chunk(%s) should return {} with one error (got %s, %d errors)" % [str(c), str(r["result"].keys()), r["errors"].size()])
	# The range edges are accepted.
	for c: Array in [[42, -67108864, 67108863], [4294967295, 0, 0]]:
		var r := _run(func() -> Dictionary: return OgChunkGen.generate_chunk(c[0], c[1], c[2]))
		t.check(not r["result"].is_empty() and r["errors"].is_empty(), "generate_chunk(%s) should be accepted (got %s)" % [str(c), str(r["errors"])])
	for bad: Array in [[], [0], [1.5], [16.0], [64, 0]]:
		var r := _run(func() -> Variant: return OgNoise.create_fbm(1, bad))
		t.check(r["result"] == null and r["errors"].size() == 1, "create_fbm(1, %s) should return null with one error (got %s, %d errors)" % [str(bad), str(r["result"]), r["errors"].size()])
	var s := _run(func() -> Variant: return OgNoise.create_fbm(-1, [8]))
	t.check(s["result"] == null and s["errors"].size() == 1, "create_fbm(-1, [8]) should return null with one error")
	for seed: Variant in [-1, 4294967296, 1.5]:
		var r := _run(func() -> Dictionary: return OgSpawn.find_spawn(seed))
		t.check(r["result"].is_empty() and r["errors"].size() == 1, "find_spawn(%s) should return {} with one error (got %d errors)" % [str(seed), r["errors"].size()])


func test_every_tile_has_a_rule(t: TestContext) -> void:
	for tile: int in [OgTile.GRASS, OgTile.DIRT, OgTile.SAND, OgTile.STONE, OgTile.CLIFF, OgTile.SHALLOW_WATER, OgTile.DEEP_WATER, OgTile.VERY_DEEP_WATER]:
		t.check(OgWalkability.TILE_RULES.has(tile), "tile %d has no entry in TILE_RULES" % tile)
	t.check(OgWalkability.TILE_RULES.size() == 8, "TILE_RULES should hold 8 entries, holds %d" % OgWalkability.TILE_RULES.size())


# Information only, no threshold: median of 20 generate_chunk calls (seed 42, chunks (0..19, 0)).
func test_generate_chunk_timing(t: TestContext) -> void:
	var times: Array[int] = []
	for cx in 20:
		var start := Time.get_ticks_usec()
		var chunk := OgChunkGen.generate_chunk(42, cx, 0)
		times.append(Time.get_ticks_usec() - start)
		t.check(not chunk.is_empty(), "timing chunk (%d, 0) was not generated" % cx)
	times.sort()
	print("INFO generate_chunk median of 20: %.1f ms (min %.1f, max %.1f)" % [(times[9] + times[10]) / 2000.0, times[0] / 1000.0, times[19] / 1000.0])
