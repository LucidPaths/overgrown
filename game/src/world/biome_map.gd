class_name OgBiomeMap
extends RefCounted
## Biome map: seeded fields sampled at world tile coordinates -> biome per tile. Mirrors
## sim/src/world/biome-map.ts bit for bit: only integer hashing and + - * / floor abs min max, so chunk
## borders are seamless by construction.

## Field octaves in tiles (all tunable).
const ELEVATION_WAVELENGTHS := [256, 128, 64, 32]
const MOISTURE_WAVELENGTHS := [256, 128, 64]
const TEMPERATURE_WAVELENGTHS := [512, 256]
const RIVER_WAVELENGTHS := [256, 128, 64]
const RIVER_WIDTH_WAVELENGTHS := [512]
const DETAIL_WAVELENGTHS := [16, 8]

const OCEAN_BELOW := 0.38
const MOUNTAIN_FROM := 0.62
const FOREST_FROM := 0.52
const RIVER_NEAR := 0.08
const RIVER_HALF_WIDTH_MIN := 1.0
const RIVER_HALF_WIDTH_MAX := 6.0
const RIVER_BANK := 1.5


## Every seeded input of worldgen for one world seed. Build once per generate_chunk call.
class Fields:
	extends RefCounted
	var elevation: OgNoise
	var moisture: OgNoise
	var temperature: OgNoise
	var river: OgNoise
	var river_width: OgNoise
	var detail: OgNoise
	var ford_seed_x := 0
	var ford_seed_y := 0


## One biome sample at a world tile. Pure; temperature is reserved (computed, not yet used).
class Sample:
	extends RefCounted
	## [0, 1)
	var elevation := 0.0
	## [0, 1)
	var moisture := 0.0
	## [0, 1), reserved
	var temperature := 0.0
	## Approx. tiles from the river band centre; INF when not near a river.
	var river_dist := INF
	## River water half-width in tiles at this point; 0 when not near a river.
	var river_half_width := 0.0


static func _field(seed: int, name: String, wavelengths: Array) -> OgNoise:
	return OgNoise.create_fbm(OgRng.derive_seed(seed, [OgRng.hash_string(name)]), wavelengths)


## seed must be a TYPE_INT in 0..4294967295 (generate_chunk validates it before calling).
static func create_world_fields(seed: int) -> Fields:
	var f := Fields.new()
	f.elevation = _field(seed, "elevation", ELEVATION_WAVELENGTHS)
	f.moisture = _field(seed, "moisture", MOISTURE_WAVELENGTHS)
	f.temperature = _field(seed, "temperature", TEMPERATURE_WAVELENGTHS)
	f.river = _field(seed, "river", RIVER_WAVELENGTHS)
	f.river_width = _field(seed, "river-width", RIVER_WIDTH_WAVELENGTHS)
	f.detail = _field(seed, "detail", DETAIL_WAVELENGTHS)
	f.ford_seed_x = OgRng.derive_seed(seed, [OgRng.hash_string("ford-x")])
	f.ford_seed_y = OgRng.derive_seed(seed, [OgRng.hash_string("ford-y")])
	return f


static func sample_biome(f: Fields, tx: int, ty: int) -> Sample:
	var s := Sample.new()
	s.elevation = f.elevation.sample(tx, ty)
	s.moisture = f.moisture.sample(tx, ty)
	s.temperature = f.temperature.sample(tx, ty)
	var ridge := absf(f.river.sample(tx, ty) * 2.0 - 1.0) # 0 on the band centre line
	if ridge < RIVER_NEAR:
		# Per-tile slope of 2n-1 (max-norm, no sqrt); skipped far from rivers.
		var slope := maxf(
			absf(f.river.sample(tx + 1, ty) - f.river.sample(tx - 1, ty)),
			absf(f.river.sample(tx, ty + 1) - f.river.sample(tx, ty - 1)),
		)
		if slope > 0.0:
			s.river_dist = ridge / slope
		s.river_half_width = RIVER_HALF_WIDTH_MIN + (RIVER_HALF_WIDTH_MAX - RIVER_HALF_WIDTH_MIN) * f.river_width.sample(tx, ty)
	return s


## Checked in order: rivers end at coasts and mountain feet.
static func classify_biome(s: Sample) -> int:
	if s.elevation < OCEAN_BELOW:
		return OgBiome.OCEAN
	if s.elevation >= MOUNTAIN_FROM:
		return OgBiome.MOUNTAIN
	if s.river_dist < s.river_half_width + RIVER_BANK:
		return OgBiome.RIVER
	if s.moisture >= FOREST_FROM:
		return OgBiome.FOREST
	return OgBiome.GRASSLAND
