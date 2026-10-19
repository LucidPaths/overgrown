class_name OgNoise
extends RefCounted
## Fractal value noise, bit-for-bit with sim/src/world/noise.ts (checked against the `noise` section of
## contracts/worldgen-vectors.json by tests/test_worldgen.gd, by exact float64 bit pattern).
##
## The lattice value at integer corner (ix, iy) of octave i is derive_seed(derive_seed(seed, i), ix, iy) / 2^32.
## Float results must match bit for bit, so the operation order and associativity below are the TS ones, and
## only + - * /, floor, abs, min and max touch floats. One octave per wavelength (in tiles), amplitude halving
## each octave, normalised to [0, 1). Domain: finite x, y in [-2^31, 2^31); not checked per call (hot path).
## Wavelengths are TYPE_INT values >= 1; a float such as 16.0 is rejected, never truncated.

var _n := 0
var _h := PackedInt64Array()
var _amp := PackedFloat64Array()
var _w := PackedFloat64Array()
var _norm := 0.0


## Builds a field over world tile coordinates. Returns null (after reporting the error) if seed is not a
## TYPE_INT in 0..4294967295 or wavelengths is empty or holds anything but ints >= 1.
static func create_fbm(seed: Variant, wavelengths: Array) -> OgNoise:
	if typeof(seed) != TYPE_INT or seed < 0 or seed > OgWorld.U32_MAX:
		OgWorld.report("seed must be an integer in 0..4294967295, got %s" % str(seed))
		return null
	if wavelengths.size() < 1:
		OgWorld.report("wavelengths must not be empty, got []")
		return null
	for i in wavelengths.size():
		var w: Variant = wavelengths[i]
		if typeof(w) != TYPE_INT or w < 1:
			OgWorld.report("wavelengths[%d] must be an integer >= 1, got %s" % [i, str(w)])
			return null
	var f := OgNoise.new()
	f._n = wavelengths.size()
	for i in f._n:
		f._h.append(OgRng.fmix32(OgRng.derive_seed(seed, [i])))
		f._amp.append(1.0 if i == 0 else f._amp[i - 1] * 0.5)
		f._w.append(float(wavelengths[i]))
	var norm := 0.0
	for i in f._n:
		norm += f._amp[i]
	f._norm = norm
	return f


func sample(x: float, y: float) -> float:
	var total := 0.0
	for i in _n:
		total += _amp[i] * _octave(_h[i], _w[i], x, y)
	return total / _norm


## Lattice value in [0, 1); h is fmix32(octaveSeed), so this equals derive_seed(octaveSeed, i, j) / 2^32.
static func _lattice(h: int, i: int, j: int) -> float:
	return OgRng.mix_seed_part(OgRng.mix_seed_part(h, i), j) / 4294967296.0


func _octave(h: int, w: float, x: float, y: float) -> float:
	var gx := x / w
	var gy := y / w
	var ixf := floorf(gx)
	var iyf := floorf(gy)
	var tx := gx - ixf
	var ty := gy - iyf
	var fx := tx * tx * (3.0 - 2.0 * tx)
	var fy := ty * ty * (3.0 - 2.0 * ty)
	var ix := int(ixf)
	var iy := int(iyf)
	var a := _lattice(h, ix, iy)
	var b := _lattice(h, ix + 1, iy)
	var c := _lattice(h, ix, iy + 1)
	var d := _lattice(h, ix + 1, iy + 1)
	var top := a + (b - a) * fx
	var bottom := c + (d - c) * fx
	return top + (bottom - top) * fy
