extends RefCounted
## OgRng against contracts/rng-vectors.json (shared with sim/src/rng.ts and tools/art/lib/rng.py),
## plus the imul32 edge products and the validation rejections.

const VECTORS_PATH := "../contracts/rng-vectors.json"


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


func test_rng_u32_streams(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var checked := 0
	for entry: Dictionary in v["rng"]:
		var rng := OgRng.new(int(entry["seed"]))
		var expected: Array = entry["u32"]
		for i in expected.size():
			var got := rng.next_u32()
			checked += 1
			if got != int(expected[i]):
				t.fail("seed %d u32[%d]: got %d, expected %d" % [entry["seed"], i, got, int(expected[i])])
	t.check(checked == 50, "expected to check 50 u32 values, checked %d" % checked)


func test_rng_float(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var rng := OgRng.new(int(v["float"]["seed"]))
	var expected: Array = v["float"]["values"]
	for i in expected.size():
		var got := rng.next_float()
		# Godot's JSON float parser is not correctly rounded (it reads 0.23955312534235418 one ulp off), so the
		# expected double is not compared directly. Every vector is an exact u32 / 2^32: recover the u32 from the
		# parsed value (the parse error is far below 0.5 / 2^32) and compare against that exact double.
		var scaled := float(expected[i]) * 4294967296.0
		var u := roundi(scaled)
		if absf(scaled - u) > 1e-3:
			t.fail("float[%d]: vector %s is not an exact u32 / 2^32" % [i, str(expected[i])])
		elif got != u / 4294967296.0:
			t.fail("float[%d]: got %s, expected %d / 2^32 = %s" % [i, str(got), u, str(u / 4294967296.0)])
	t.check(expected.size() == 5, "expected 5 float vectors, found %d" % expected.size())


func test_rng_int(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var spec: Dictionary = v["int"]
	var rng := OgRng.new(int(spec["seed"]))
	var expected: Array = spec["values"]
	for i in expected.size():
		var got := rng.int_range(int(spec["lo"]), int(spec["hi"]))
		if got != int(expected[i]):
			t.fail("int[%d]: got %d, expected %d" % [i, got, int(expected[i])])
	t.check(expected.size() == 20, "expected 20 int vectors, found %d" % expected.size())


# Pinned from the reference: sim/src/rng.ts, `new Rng(42)` then 20 × `.int(-5, 5)`, run with
# `node --experimental-strip-types`. The shared vectors only cover 1..6, so this pins a negative `lo`.
# (floor vs truncation toward zero cannot differ here: the argument f * (hi - lo + 1) is never negative.
# What this guards is the `lo +` offset and the span arithmetic.)
func test_rng_int_negative_range(t: TestContext) -> void:
	var expected := [-3, 1, -4, -3, -1, 4, 4, 5, 0, 5, -3, 2, -2, 5, -1, 5, 4, -2, 0, 3]
	var rng := OgRng.new(42)
	for i in expected.size():
		var got := rng.int_range(-5, 5)
		if got != expected[i]:
			t.fail("int_range(-5, 5)[%d]: got %d, expected %d" % [i, got, expected[i]])


func test_derive_seed(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var list: Array = v["derive"]
	for entry: Dictionary in list:
		var parts: Array = []
		for p in entry["parts"]:
			parts.append(int(p))
		var got := OgRng.derive_seed(int(entry["seed"]), parts)
		if got != int(entry["out"]):
			t.fail("derive(%d, %s): got %d, expected %d" % [entry["seed"], str(parts), got, int(entry["out"])])
	t.check(list.size() == 6, "expected 6 derive vectors, found %d" % list.size())


func test_hash_string(t: TestContext) -> void:
	var v := _vectors(t)
	if v.is_empty():
		return
	var list: Array = v["hashString"]
	for entry: Dictionary in list:
		var got := OgRng.hash_string(entry["s"])
		if got != int(entry["out"]):
			t.fail("hash_string('%s'): got %d, expected %d" % [entry["s"], got, int(entry["out"])])
	t.check(list.size() == 5, "expected 5 hashString vectors, found %d" % list.size())


# Expected values are computed without 64-bit multiplication in play, so the check is independent of the
# code under test. With M = 2^32 - 1 (so M = -1 mod 2^32):
#   M*M = (-1)(-1) = 1;  M*2 = -2 = 2^32 - 2;  M*0x85EBCA6B = 2^32 - 0x85EBCA6B = 0x7A143595
#   0x80000000^2 = 2^62 = 0 mod 2^32
#   0x10001 * 0xFFFF0001 = (2^16 + 1)(2^32 - 2^16 + 1) = 2^48 + 1 = 1 mod 2^32
#   M*0x10000 = -2^16 = 2^32 - 2^16 = 0xFFFF0000;  0xFFFF^2 = 2^32 - 2^17 + 1 = 0xFFFE0001
# 0x9E3779B9 * 0xC2B2AE35 has no closed form: 1255797069 is Python's (a * b) & 0xFFFFFFFF.
# GDScript ints wrap at 64 bits, and the low 32 bits of a wrapped product are the true low 32 bits, so a
# plain `(a * b) & MASK` would pass this test too. The 16-bit split is defensive: it avoids relying on
# C++ signed overflow. This test guards against a mis-split.
func test_imul32_edge_products(t: TestContext) -> void:
	var cases := [
		[0xFFFFFFFF, 0xFFFFFFFF, 1],
		[0xFFFFFFFF, 2, 0xFFFFFFFE],
		[0xFFFFFFFF, 0x85EBCA6B, 0x7A143595],
		[0x85EBCA6B, 0xFFFFFFFF, 0x7A143595],
		[0x80000000, 0x80000000, 0],
		[0x10001, 0xFFFF0001, 1],
		[0xFFFFFFFF, 0x10000, 0xFFFF0000],
		[0xFFFF, 0xFFFF, 0xFFFE0001],
		[0xFFFFFFFF, 1, 0xFFFFFFFF],
		[0xFFFFFFFF, 0, 0],
		[0x9E3779B9, 0xC2B2AE35, 1255797069],
	]
	for c: Array in cases:
		var got := OgRng.imul32(c[0], c[1])
		if got != c[2]:
			t.fail("imul32(0x%X, 0x%X): got 0x%X, expected 0x%X" % [c[0], c[1], got, c[2]])


func test_rejects_invalid_seed(t: TestContext) -> void:
	for bad in [-1, 0x100000000, 9007199254740991]:
		var r := _run(func() -> Array:
			var rng := OgRng.new(bad)
			return [rng.is_valid(), rng.next_u32(), rng.next_float(), rng.int_range(1, 6)])
		t.check(r["result"] == [false, -1, -1.0, OgRng.INVALID_INT], "Rng(%d) should be invalid and every draw invalid (got %s)" % [bad, str(r["result"])])
		t.check(r["errors"].size() == 4, "seed %d: expected 4 reported errors, got %d" % [bad, r["errors"].size()])
		var d := _run(func() -> int: return OgRng.derive_seed(bad, []))
		t.check(d["result"] == -1 and d["errors"].size() == 1, "derive_seed(%d) should return -1 with one error (got %s, %d errors)" % [bad, str(d["result"]), d["errors"].size()])
	# A float is rejected, not truncated to 1.
	var f := _run(func() -> Array:
		var rng := OgRng.new(1.5)
		return [rng.is_valid(), OgRng.derive_seed(1.5, [])])
	t.check(f["result"] == [false, -1] and f["errors"].size() == 2, "float seed 1.5 should be rejected by new and derive_seed (got %s, %d errors)" % [str(f["result"]), f["errors"].size()])
	for ok in [0, 0xFFFFFFFF]:
		var r := _run(func() -> bool: return OgRng.new(ok).is_valid())
		t.check(r["result"] and r["errors"].is_empty(), "seed %d should be accepted, got %s" % [ok, str(r["errors"])])


func test_rejects_invalid_derive_parts(t: TestContext) -> void:
	for bad: Variant in [0x100000000, -0x80000001, 9007199254740991, 1.5, "1", null]:
		var r := _run(func() -> int: return OgRng.derive_seed(42, [0, bad]))
		t.check(r["result"] == -1 and r["errors"].size() == 1, "derive_seed part %s should return -1 with one error (got %s, %d errors)" % [str(bad), str(r["result"]), r["errors"].size()])
	for ok in [-0x80000000, -1, 0, 0xFFFFFFFF]:
		var r := _run(func() -> int: return OgRng.derive_seed(42, [ok]))
		t.check(r["errors"].is_empty() and r["result"] >= 0, "derive_seed part %d should be accepted (got %s, %s)" % [ok, str(r["result"]), str(r["errors"])])
	# part -1 must behave as 0xFFFFFFFF, like `part >>> 0` in TS.
	t.check(OgRng.derive_seed(42, [-1]) == OgRng.derive_seed(42, [0xFFFFFFFF]), "derive_seed part -1 differs from 0xFFFFFFFF")


func test_rejects_invalid_int_range(t: TestContext) -> void:
	var bad_ranges := [
		[6, 1], # lo > hi
		[0, 0x100000000], # hi - lo = 2^32
		[-0x80000000, 0x80000001], # hi - lo = 2^32 + 1
		[9007199254740991, 9007199254740992], # hi beyond 2^53 - 1
		[-9007199254740992, 0], # lo beyond -(2^53 - 1)
		[0, 9007199254740991], # both safe, hi - lo huge
	]
	for rg: Array in bad_ranges:
		var r := _run(func() -> int: return OgRng.new(1).int_range(rg[0], rg[1]))
		t.check(r["result"] == OgRng.INVALID_INT and r["errors"].size() == 1, "int_range(%d, %d) should return INVALID_INT with one error (got %s, %d errors)" % [rg[0], rg[1], str(r["result"]), r["errors"].size()])
	# Floats are rejected, not truncated.
	for rg: Array in [[1.5, 6], [1, 6.5]]:
		var r := _run(func() -> int: return OgRng.new(1).int_range(rg[0], rg[1]))
		t.check(r["result"] == OgRng.INVALID_INT and r["errors"].size() == 1, "int_range(%s, %s) should return INVALID_INT with one error (got %s, %d errors)" % [str(rg[0]), str(rg[1]), str(r["result"]), r["errors"].size()])
	var good_ranges := [[0, 0xFFFFFFFF], [-5, 5], [3, 3], [-0x80000000, 0x7FFFFFFF]]
	for rg: Array in good_ranges:
		var r := _run(func() -> int: return OgRng.new(1).int_range(rg[0], rg[1]))
		t.check(r["errors"].is_empty() and r["result"] >= rg[0] and r["result"] <= rg[1], "int_range(%d, %d) should be accepted and in range (got %s, %s)" % [rg[0], rg[1], str(r["result"]), str(r["errors"])])
