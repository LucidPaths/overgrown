extends SceneTree
## G0 E2E scratch helper: finds east-facing test lanes near a seed's spawn with OgChunkStore.tile_at (read only).
## For each kind, the lane nearest the spawn: a row with LANE walkable tiles, then the target tile(s) to the east.
##   cliff:   LANE dry walkable tiles, then a cliff
##   deep:    LANE walkable tiles, then deep or very deep water
##   shallow: LANE dry tiles, then at least SHALLOW_RUN shallow-water tiles
## Prints "SPOT <kind> at=X,Z target_tile=(tx, ty)" with --at in the middle of the lane's first tile.
## Run: godot --headless --path game --script "$PWD/docs/e2e/G0/find_spots.gd" -- <seed> <radius_chunks>

const LANE := 10
const SHALLOW_RUN := 8


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var seed := int(args[0]) if args.size() > 0 else 1
	var radius := int(args[1]) if args.size() > 1 else 3
	var spawn: Dictionary = OgSpawn.find_spawn(seed)
	var sx := floori(spawn["x"] / float(OgWorld.TILE_PX))
	var sy := floori(spawn["y"] / float(OgWorld.TILE_PX))
	print("seed %d spawn tile (%d, %d)" % [seed, sx, sy])
	var store := OgChunkStore.new(seed)
	var r := radius * OgWorld.CHUNK_TILES
	var best := {}
	for ty in range(sy - r, sy + r):
		for tx in range(sx - r, sx + r):
			for kind in ["cliff", "deep", "shallow"]:
				if _lane(store, kind, tx, ty):
					var d := maxi(absi(tx - sx), absi(ty - sy))
					if not best.has(kind) or d < best[kind][0]:
						best[kind] = [d, tx, ty]
	for kind in ["cliff", "deep", "shallow"]:
		if best.has(kind):
			var tx: int = best[kind][1]
			var ty: int = best[kind][2]
			print("SPOT %s at=%.1f,%.1f target_tile=(%d, %d) dist=%d tiles" % [kind, tx - LANE + 0.5, ty + 0.5, tx, ty, best[kind][0]])
		else:
			print("SPOT %s none within %d chunks" % [kind, radius])
	quit(0)


## True if tile (tx, ty) is the target of a `kind` lane: the LANE tiles west of it qualify.
func _lane(store: OgChunkStore, kind: String, tx: int, ty: int) -> bool:
	var t := store.tile_at(tx, ty)
	match kind:
		"cliff":
			if t != OgTile.CLIFF:
				return false
		"deep":
			if t != OgTile.DEEP_WATER and t != OgTile.VERY_DEEP_WATER:
				return false
		"shallow":
			for i in SHALLOW_RUN:
				if store.tile_at(tx + i, ty) != OgTile.SHALLOW_WATER:
					return false
	for i in range(1, LANE + 1):
		var w := store.tile_at(tx - i, ty)
		if not OgWalkability.TILE_RULES[w]["walkable"]:
			return false
		if kind != "deep" and OgWalkability.TILE_RULES[w]["depth"] != 0:
			return false
	return true
