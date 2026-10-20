class_name OgFoliage
extends RefCounted
## Seeded placement of the G1 props (ART-027, docs/art/BIBLE.md "Props"): grass, reeds, pines, broadleaf
## trees, flowering bushes and rocks, per chunk. Visual only: the rules never see these (characters walk
## through them for now; obstacles are a later rules task).
##
## Pure and static (runs on WorkerThreadPool threads; reads only the immutable chunk). Deterministic: every
## random draw comes from one OgRng stream seeded by OgRng.derive_seed(world seed, [cx, cy, SALT]) and the
## tiles are visited in a fixed order, so the same seed and chunk always give the same props
## (test_foliage.gd checks it).
##
## Output per kind: a MultiMesh buffer (transform_format 3D, use_custom_data): 16 floats per instance, the
## 3x4 transform (chunk-local metres, rows) then INSTANCE_CUSTOM = (ground colour r, g, b in sRGB, random).

const KIND_GRASS := 0
const KIND_PINE := 1
const KIND_TREE := 2
const KIND_BUSH := 3
const KIND_ROCK := 4
const KIND_REED := 5
const KIND_COUNT := 6
const KIND_NAMES: Array[String] = ["grass", "pine", "tree", "bush", "rock", "reed"]
const FLOATS := 16
const SALT := 0x0F011A6E

const N := OgWorld.CHUNK_TILES
const CORNERS := OgTerrain.CORNERS
const RW := OgTerrain.COLOR_RING_W

## Grass clumps per grass tile by biome (Grassland, Forest, River, Mountain, Ocean), before patchiness.
const GRASS_PER_TILE: Array[float] = [5.0, 2.0, 5.5, 1.8, 0.8]
## Per-tile chances (tunable). Forest: dense pines and some broadleaf; Grassland: open with copses.
const PINE_CHANCE: Array[float] = [0.003, 0.035, 0.0, 0.02, 0.0]
const TREE_CHANCE: Array[float] = [0.004, 0.012, 0.008, 0.0, 0.0]
const BUSH_CHANCE: Array[float] = [0.012, 0.03, 0.02, 0.004, 0.0]
const ROCK_CHANCE_GRASS := 0.004
const ROCK_CHANCE_STONE := 0.05
const REED_PER_BANK_TILE := 1.4
## Scale ranges (metres; the meshes are unit size).
const PINE_H := Vector2(6.0, 12.5)
const TREE_H := Vector2(4.0, 7.0)
const BUSH_H := Vector2(0.8, 1.6)
const ROCK_S := Vector2(0.5, 2.4)
const GRASS_S := Vector2(0.55, 1.0)
## Patchiness: grass density follows a value-noise field with cells of this many tiles.
const PATCH_TILES := 6


## Returns an Array of KIND_COUNT PackedFloat32Arrays (possibly empty).
static func place(seed: int, c: OgChunkStore.Chunk) -> Array:
	# Packed arrays are values in GDScript (copied when passed), so each kind has its own local buffer.
	var grass := PackedFloat32Array()
	var pine := PackedFloat32Array()
	var tree := PackedFloat32Array()
	var bush := PackedFloat32Array()
	var rock := PackedFloat32Array()
	var reed := PackedFloat32Array()
	var rng := OgRng.new(OgRng.derive_seed(seed, [c.cx, c.cy, SALT]))
	if not rng.is_valid():
		return [grass, pine, tree, bush, rock, reed]
	for ly in N:
		for lx in N:
			var i := ly * N + lx
			var tile := c.tiles[i]
			var biome := c.biomes[i]
			if OgTerrain.is_water(tile) or tile == OgTile.CLIFF:
				continue
			var tx := c.cx * N + lx
			var ty := c.cy * N + ly
			var ground := OgTerrainMesher.tile_color(tile, biome, tx, ty)
			var steep := _steepness(c, lx, ly)
			var bank := _near_water(c, lx, ly)
			if tile == OgTile.GRASS:
				var patch := _patch(seed, tx, ty)
				var count := GRASS_PER_TILE[biome] * (0.25 + 1.5 * patch)
				var whole := floori(count)
				if rng.next_float() < count - whole:
					whole += 1
				for g in whole:
					grass.append_array(_inst(c, lx, ly, rng, GRASS_S, ground, 1.0))
			if bank and (tile == OgTile.GRASS or tile == OgTile.SAND or tile == OgTile.DIRT):
				var reeds := REED_PER_BANK_TILE if biome == OgBiome.RIVER else REED_PER_BANK_TILE * 0.4
				while reeds > 0.0:
					if rng.next_float() < reeds:
						reed.append_array(_inst(c, lx, ly, rng, Vector2(0.8, 1.4), ground, 1.0))
					reeds -= 1.0
			if steep > 0.5:
				continue
			var roll := rng.next_float()
			if tile == OgTile.GRASS or tile == OgTile.DIRT:
				if not bank:
					if roll < PINE_CHANCE[biome]:
						pine.append_array(_inst(c, lx, ly, rng, PINE_H, ground, 1.0))
						continue
					roll -= PINE_CHANCE[biome]
					if roll < TREE_CHANCE[biome]:
						tree.append_array(_inst(c, lx, ly, rng, TREE_H, ground, 1.0))
						continue
					roll -= TREE_CHANCE[biome]
				if roll < BUSH_CHANCE[biome]:
					bush.append_array(_inst(c, lx, ly, rng, BUSH_H, ground, 1.0))
					continue
				roll -= BUSH_CHANCE[biome]
				if roll < ROCK_CHANCE_GRASS:
					rock.append_array(_inst(c, lx, ly, rng, ROCK_S, ground, 0.6))
			elif tile == OgTile.STONE or tile == OgTile.SAND:
				if roll < ROCK_CHANCE_STONE * (1.0 if tile == OgTile.STONE else 0.3):
					rock.append_array(_inst(c, lx, ly, rng, ROCK_S, ground, 1.0))
	return [grass, pine, tree, bush, rock, reed]


## One instance on tile (lx, ly): random point in the tile, random yaw, scale in `size` (the y scale gets
## `flat` less variation for rocks), on the ground height there.
static func _inst(c: OgChunkStore.Chunk, lx: int, ly: int, rng: OgRng, size: Vector2, ground: Color, flat: float) -> PackedFloat32Array:
	var fx := rng.next_float()
	var fz := rng.next_float()
	var yaw := rng.next_float() * TAU
	var s := lerpf(size.x, size.y, rng.next_float())
	var r := rng.next_float()
	var sy := s * lerpf(1.0, 0.75 + r * 0.5, flat)
	var tl := ly * CORNERS + lx
	var h := OgTerrain.interpolate(c.heights[tl], c.heights[tl + 1], c.heights[tl + CORNERS], c.heights[tl + CORNERS + 1], fx, fz)
	var co := cos(yaw)
	var sn := sin(yaw)
	return PackedFloat32Array([co * s, 0.0, sn * s, lx + fx,
		0.0, sy, 0.0, h - 0.05,
		-sn * s, 0.0, co * s, ly + fz,
		ground.r, ground.g, ground.b, r])


## 0 flat .. 1 very steep: the largest corner height difference across the tile, in metres per metre.
static func _steepness(c: OgChunkStore.Chunk, lx: int, ly: int) -> float:
	var tl := ly * CORNERS + lx
	var hs := [c.heights[tl], c.heights[tl + 1], c.heights[tl + CORNERS], c.heights[tl + CORNERS + 1]]
	return (hs.max() - hs.min()) / 1.5


## True when any of the 8 tiles around (lx, ly) is water (the colour ring covers the chunk edges).
static func _near_water(c: OgChunkStore.Chunk, lx: int, ly: int) -> bool:
	for dy in range(-1, 2):
		for dx in range(-1, 2):
			if OgTerrain.is_water(c.ring_tiles[(ly + 1 + dy) * RW + lx + 1 + dx]):
				return true
	return false


## Smooth 0..1 value noise over world tiles (cells of PATCH_TILES), seeded: meadows and bare patches.
static func _patch(seed: int, tx: int, ty: int) -> float:
	var gx := floori(tx / float(PATCH_TILES))
	var gy := floori(ty / float(PATCH_TILES))
	var fx := (tx - gx * PATCH_TILES) / float(PATCH_TILES)
	var fy := (ty - gy * PATCH_TILES) / float(PATCH_TILES)
	var h := OgRng.mix_seed_part(seed, SALT)
	var a := _cell(h, gx, gy)
	var b := _cell(h, gx + 1, gy)
	var cc := _cell(h, gx, gy + 1)
	var d := _cell(h, gx + 1, gy + 1)
	fx = fx * fx * (3.0 - 2.0 * fx)
	fy = fy * fy * (3.0 - 2.0 * fy)
	return lerpf(lerpf(a, b, fx), lerpf(cc, d, fx), fy)


static func _cell(h: int, x: int, y: int) -> float:
	return OgRng.mix_seed_part(OgRng.mix_seed_part(h, x), y) / 4294967296.0
