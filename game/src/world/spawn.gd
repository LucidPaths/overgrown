class_name OgSpawn
extends RefCounted
## The spawn point search. Mirrors sim/src/world/spawn.ts.

## tiles, Chebyshev, around tile (0, 0); tunable. Max seen over seeds 0-199: 163.
const SPAWN_SEARCH_RADIUS := 256


## Tile and biome lookups over chunks generated on demand and cached.
class Ground:
	extends RefCounted
	var _seed := 0
	var _chunks := {}

	func _init(seed: int) -> void:
		_seed = seed

	func _chunk_at(tx: int, ty: int) -> Dictionary:
		var key := Vector2i(floori(tx / float(OgWorld.CHUNK_TILES)), floori(ty / float(OgWorld.CHUNK_TILES)))
		if not _chunks.has(key):
			_chunks[key] = OgChunkGen.generate_chunk(_seed, key.x, key.y)
		return _chunks[key]

	func _index(tx: int, ty: int) -> int:
		var n := OgWorld.CHUNK_TILES
		return posmod(ty, n) * n + posmod(tx, n)

	func tile_at(tx: int, ty: int) -> int:
		return _chunk_at(tx, ty)["tiles"][_index(tx, ty)]

	func biome_at(tx: int, ty: int) -> int:
		return _chunk_at(tx, ty)["biomes"][_index(tx, ty)]


## best = [d2, tx, ty]; d2 < 0 means no candidate yet.
static func _consider(g: Ground, tx: int, ty: int, best: Array[int]) -> void:
	if g.biome_at(tx, ty) != OgBiome.GRASSLAND or not OgWalkability.TILE_RULES[g.tile_at(tx, ty)]["walkable"]:
		return
	var d2 := tx * tx + ty * ty
	if best[0] < 0 or d2 < best[0] or (d2 == best[0] and (ty < best[2] or (ty == best[2] and tx < best[1]))):
		best[0] = d2
		best[1] = tx
		best[2] = ty


## OQ-024: the feet point {x, y} (tx * TILE_PX + 8, ty * TILE_PX + 8) at the centre of the nearest tile whose
## biome is Grassland and whose tile is walkable. "Nearest": the smallest Chebyshev ring r = max(|tx|, |ty|) =
## 0, 1, ... SPAWN_SEARCH_RADIUS that contains any such tile; within that ring, the smallest (tx^2 + ty^2, ty, tx).
## The result doesn't depend on loop order. If no ring up to the radius has one, or seed is not a TYPE_INT in
## 0..4294967295, the error is reported and the result is the empty Dictionary. Never falls back to (0, 0).
static func find_spawn(seed: Variant) -> Dictionary:
	if typeof(seed) != TYPE_INT or seed < 0 or seed > OgWorld.U32_MAX:
		OgWorld.report("seed must be an integer in 0..4294967295, got %s" % str(seed))
		return {}
	var g := Ground.new(seed)
	var half := OgWorld.TILE_PX / 2
	for r in SPAWN_SEARCH_RADIUS + 1:
		var best: Array[int] = [-1, 0, 0]
		# Ring r: the tiles with max(|tx|, |ty|) = r, scanned top row, bottom row, then the two side columns.
		for tx in range(-r, r + 1):
			_consider(g, tx, -r, best)
			if r > 0:
				_consider(g, tx, r, best)
		for ty in range(-r + 1, r):
			_consider(g, -r, ty, best)
			_consider(g, r, ty, best)
		if best[0] >= 0:
			return {"x": best[1] * OgWorld.TILE_PX + half, "y": best[2] * OgWorld.TILE_PX + half}
	OgWorld.report("find_spawn: no walkable Grassland tile within %d tiles (Chebyshev) of tile (0, 0)" % SPAWN_SEARCH_RADIUS)
	return {}
