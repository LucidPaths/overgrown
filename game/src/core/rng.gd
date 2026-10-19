class_name OgRng
extends RefCounted
## Seeded RNG, bit-for-bit with sim/src/rng.ts and tools/art/lib/rng.py (checked against
## contracts/rng-vectors.json by tests/test_rng.gd).
##
## Every u32 is an int in 0..0xFFFFFFFF; each operation that can leave that range is masked.
## GDScript has no exceptions: where rng.ts throws, this file reports the same condition through
## error_hook (default push_error) and returns an invalid marker: -1 from the u32 functions (no u32
## is negative), -1.0 from next_float, and INVALID_INT from int_range (-1 is a legal int_range result).
## Seeds, parts, lo and hi must be TYPE_INT; a float such as 1.5 is rejected, never truncated.

const MASK := 0xFFFFFFFF
const GOLDEN := 0x9E3779B9
const SAFE_INT_MAX := 9007199254740991 # 2^53 - 1, the same limit rng.ts and rng.py enforce
## What int_range returns on error. Outside +-(2^53-1), so no accepted range can contain it.
const INVALID_INT := -(1 << 62)

## Receives every validation error message. Unset (the default) means push_error. Tests set it to
## capture errors instead of printing them.
static var error_hook := Callable()

var _a := 0
var _b := 0
var _c := 0
var _d := 0
var _valid := false


static func _is_int_in(v: Variant, lo: int, hi: int) -> bool:
	return typeof(v) == TYPE_INT and v >= lo and v <= hi


static func _report(msg: String) -> void:
	if error_hook.is_valid():
		error_hook.call(msg)
	else:
		push_error(msg)


## Low 32 bits of a * b for u32 a and b. A plain a * b can reach 2^64, so b is split in 16-bit halves
## and no intermediate product exceeds 2^48.
static func imul32(a: int, b: int) -> int:
	return ((a * (b & 0xFFFF)) + (((a * (b >> 16)) & 0xFFFF) << 16)) & MASK


static func rotl32(x: int, r: int) -> int:
	return ((x << r) & MASK) | (x >> (32 - r))


static func fmix32(x: int) -> int:
	x &= MASK
	x ^= x >> 16
	x = imul32(x, 0x85EBCA6B)
	x ^= x >> 13
	x = imul32(x, 0xC2B2AE35)
	x ^= x >> 16
	return x


## One derive_seed combine step, UNCHECKED (hot paths only): part must be an int in -2^31..2^32-1.
static func mix_seed_part(h: int, part: int) -> int:
	return (fmix32(h ^ fmix32(part & MASK)) + GOLDEN) & MASK


## Sub-seed from a seed plus integer parts, e.g. (world_seed, chunk_x, chunk_y). Returns -1 on invalid input.
static func derive_seed(seed: Variant, parts: Array) -> int:
	if not _is_int_in(seed, 0, MASK):
		_report("seed must be an integer in 0..4294967295, got %s" % str(seed))
		return -1
	var h := fmix32(seed)
	for i in parts.size():
		var p: Variant = parts[i]
		if not _is_int_in(p, -0x80000000, MASK):
			_report("parts[%d] must be an integer in -2147483648..4294967295, got %s" % [i, str(p)])
			return -1
		h = mix_seed_part(h, p)
	return h


## FNV-1a 32 over the UTF-8 bytes of s, then fmix32. For namespacing seeds by name.
static func hash_string(s: String) -> int:
	var h := 0x811C9DC5
	for byte in s.to_utf8_buffer():
		h ^= byte
		h = imul32(h, 0x01000193)
	return fmix32(h)


## seed must be a TYPE_INT in 0..4294967295. Otherwise an error is reported, is_valid() stays false and
## every draw returns its invalid marker.
func _init(seed: Variant) -> void:
	if not _is_int_in(seed, 0, MASK):
		_report("seed must be an integer in 0..4294967295, got %s" % str(seed))
		return
	_valid = true
	var s: int = seed
	var out: Array[int] = []
	for i in 4:
		# splitmix32 step
		s = (s + GOLDEN) & MASK
		var z := s
		z = imul32(z ^ (z >> 16), 0x85EBCA6B)
		z = imul32(z ^ (z >> 13), 0xC2B2AE35)
		out.append((z ^ (z >> 16)) & MASK)
	_a = out[0]
	_b = out[1]
	_c = out[2]
	_d = out[3]
	for i in 12:
		next_u32()


func is_valid() -> bool:
	return _valid


## sfc32: next unsigned 32-bit integer.
func next_u32() -> int:
	if not _valid:
		_report("next_u32 on an Rng whose seed was rejected")
		return -1
	var t := (_a + _b + _d) & MASK
	_d = (_d + 1) & MASK
	_a = (_b ^ (_b >> 9)) & MASK
	_b = (_c + (_c << 3)) & MASK
	_c = rotl32(_c, 21)
	_c = (_c + t) & MASK
	return t


## Uniform float in [0, 1); exact in float64. Returns -1.0 on an Rng whose seed was rejected.
func next_float() -> float:
	var u := next_u32()
	if u < 0:
		return -1.0
	return u / 4294967296.0


## Uniform integer in [lo, hi], inclusive. Returns INVALID_INT and reports an error if lo or hi is not
## a TYPE_INT within +-(2^53-1), lo > hi, or hi - lo >= 2^32.
func int_range(lo: Variant, hi: Variant) -> int:
	if not _is_int_in(lo, -SAFE_INT_MAX, SAFE_INT_MAX) or not _is_int_in(hi, -SAFE_INT_MAX, SAFE_INT_MAX):
		_report("lo and hi must be integers within -(2^53-1)..2^53-1, got lo=%s hi=%s" % [str(lo), str(hi)])
		return INVALID_INT
	if lo > hi:
		_report("lo must be <= hi, got lo=%d hi=%d" % [lo, hi])
		return INVALID_INT
	if hi - lo > MASK:
		_report("hi - lo must be < 2^32, got lo=%d hi=%d" % [lo, hi])
		return INVALID_INT
	var f := next_float()
	if f < 0.0:
		return INVALID_INT
	return lo + int(floor(f * (hi - lo + 1)))
