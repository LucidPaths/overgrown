class_name OgChunkStore
extends RefCounted
## The one world cache that rules and the renderer read. Ports the streaming rules of
## sim/src/world/chunk-store.ts (planStream order, hysteresis, the recent-chunk LRU, on-demand lookups);
## the chunk data comes from OgChunkGen.generate_chunk plus OgTerrain.corner_grids.
##
## Which chunks are loaded depends only on the anchors and the calls made. When a streamed chunk arrives
## depends on thread timing; what it contains never does. Main thread only: nothing here is thread-safe.
## Worker tasks run build_chunk (pure, static) and write only into their own _Job.

signal chunk_loaded(cx: int, cy: int)
signal chunk_unloaded(cx: int, cy: int)

## Chebyshev radius, in chunks, around each anchor's chunk that is streamed in (tunable).
const LOAD_RADIUS := 3
## Loaded chunks farther than this (Chebyshev, chunks) from every anchor's chunk are unloaded. > LOAD_RADIUS
## (hysteresis; tunable).
const UNLOAD_RADIUS := 4
## LRU capacity for unloaded chunks kept for a quick return. Loaded chunks never count.
const RECENT_CHUNKS := 64
## Most streaming generations running on worker threads at once (tunable).
const MAX_JOBS_IN_FLIGHT := 4
## Chunk edge in metres.
const CHUNK_M := OgWorld.CHUNK_TILES * OgWorld.TILE_M


## One chunk's data. Never modified after build_chunk returns it, so any thread may read it.
class Chunk:
	extends RefCounted
	var cx := 0
	var cy := 0
	## generate_chunk's layers, untouched: index ly * CHUNK_TILES + lx.
	var tiles: PackedByteArray
	var biomes: PackedByteArray
	## Corner grids, index ly * OgTerrain.CORNERS + lx (lx, ly in 0..CHUNK_TILES): corner (lx, ly) is world
	## corner (cx * 32 + lx, cy * 32 + ly). Ground height in metres; water surface in metres (NaN where no
	## water tile touches the corner); smooth unit normals of the ground.
	var heights: PackedFloat32Array
	var water: PackedFloat32Array
	var normals: PackedVector3Array
	## Tiles and biomes -1..CHUNK_TILES around the chunk (the 4 tiles around every corner), index
	## (ly + 1) * OgTerrain.COLOR_RING_W + (lx + 1). For corner colours.
	var ring_tiles: PackedByteArray
	var ring_biomes: PackedByteArray


## One worker task. The worker writes only `result`; the main thread reads it after the task completes.
class _Job:
	extends RefCounted
	var seed := 0
	var cx := 0
	var cy := 0
	var task_id := -1
	var result: Chunk
	var usec := 0

	func run() -> void:
		var start := Time.get_ticks_usec()
		result = OgChunkStore.build_chunk(seed, cx, cy)
		usec = Time.get_ticks_usec() - start


## Test seam: generations started (worker jobs plus synchronous on-demand builds).
var generations := 0
## Worker job durations in microseconds, for the timing report.
var job_usec: Array[int] = []

var _seed := 0
var _anchors: Array[Vector2] = []
var _loaded := {} # Vector2i -> Chunk
var _recent := {} # Vector2i -> Chunk; insertion order = LRU order, oldest first
var _jobs := {} # Vector2i -> _Job; insertion order = start order


## seed must be an int in 0..4294967295 (generate_chunk reports anything else when a chunk is built).
func _init(seed: int) -> void:
	_seed = seed


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		# Every task must be waited for; their results are dropped.
		for job: _Job in _jobs.values():
			WorkerThreadPool.wait_for_task_completion(job.task_id)
		_jobs.clear()


## Pure: chunk (cx, cy) of a world seed with its corner grids. Null if generate_chunk rejected the input
## (it reported why). Safe on any thread.
static func build_chunk(seed: int, cx: int, cy: int) -> Chunk:
	var g := OgChunkGen.generate_chunk(seed, cx, cy)
	if g.is_empty():
		return null
	var grids := OgTerrain.corner_grids(OgBiomeMap.create_world_fields(seed), cx, cy, g["tiles"], g["biomes"])
	var c := Chunk.new()
	c.cx = cx
	c.cy = cy
	c.tiles = g["tiles"]
	c.biomes = g["biomes"]
	c.heights = grids["heights"]
	c.water = grids["water"]
	c.normals = grids["normals"]
	c.ring_tiles = grids["ring_tiles"]
	c.ring_biomes = grids["ring_biomes"]
	return c


## Chunk coordinate of a world coordinate in metres (x or z).
static func chunk_of(m: float) -> int:
	return floori(floorf(m / OgWorld.TILE_M) / OgWorld.CHUNK_TILES)


## Pure port of planStream. unload: every key of `loaded` farther than UNLOAD_RADIUS (Chebyshev) from every
## anchor's chunk, in `loaded` order. load: every chunk within LOAD_RADIUS of some anchor's chunk that is not
## in `loaded`, sorted by (d2, cy, cx), d2 = the smallest squared distance from an anchor to the chunk centre.
## Anchors are world metres (x, z); a non-finite anchor is reported and makes an empty plan.
static func plan_stream(anchors: Array[Vector2], loaded: Array) -> Dictionary:
	var centres: Array[Vector2i] = []
	for i in anchors.size():
		var a := anchors[i]
		if not is_finite(a.x) or not is_finite(a.y):
			OgWorld.report("plan_stream: anchor %d must have a finite position, got %s" % [i, str(a)])
			return {"unload": [], "load": []}
		centres.append(Vector2i(chunk_of(a.x), chunk_of(a.y)))
	var unload: Array[Vector2i] = []
	var held := {}
	for key: Vector2i in loaded:
		held[key] = true
		if not _near(centres, key, UNLOAD_RADIUS):
			unload.append(key)
	var due := {} # Vector2i -> [d2, cy, cx]
	for c in centres:
		for cy in range(c.y - LOAD_RADIUS, c.y + LOAD_RADIUS + 1):
			for cx in range(c.x - LOAD_RADIUS, c.x + LOAD_RADIUS + 1):
				var key := Vector2i(cx, cy)
				if held.has(key) or due.has(key):
					continue
				var mx := cx * CHUNK_M + CHUNK_M / 2
				var mz := cy * CHUNK_M + CHUNK_M / 2
				var d2 := INF
				for p in anchors:
					var dx := mx - p.x
					var dz := mz - p.y
					d2 = minf(d2, dx * dx + dz * dz)
				due[key] = [d2, cy, cx]
	var order: Array = due.values()
	order.sort_custom(func(a: Array, b: Array) -> bool:
		if a[0] != b[0]:
			return a[0] < b[0]
		if a[1] != b[1]:
			return a[1] < b[1]
		return a[2] < b[2])
	var load: Array[Vector2i] = []
	for o: Array in order:
		load.append(Vector2i(o[2], o[1]))
	return {"unload": unload, "load": load}


static func _near(centres: Array[Vector2i], key: Vector2i, radius: int) -> bool:
	for a in centres:
		if maxi(absi(key.x - a.x), absi(key.y - a.y)) <= radius:
			return true
	return false


## The points (world metres, x and z) the world streams around.
func set_anchors(points: Array[Vector2]) -> void:
	_anchors = points.duplicate()


## One tick of streaming: collects finished jobs (emitting chunk_loaded), unloads, then loads cache hits and
## starts up to MAX_JOBS_IN_FLIGHT jobs, nearest first. Call once per physics tick.
func step() -> void:
	var centres: Array[Vector2i] = []
	for a in _anchors:
		centres.append(Vector2i(chunk_of(a.x), chunk_of(a.y)))
	for key: Vector2i in _jobs.keys():
		var job: _Job = _jobs[key]
		if not WorkerThreadPool.is_task_completed(job.task_id):
			continue
		WorkerThreadPool.wait_for_task_completion(job.task_id)
		_jobs.erase(key)
		job_usec.append(job.usec)
		if _near(centres, key, UNLOAD_RADIUS):
			_loaded[key] = job.result
			chunk_loaded.emit(key.x, key.y)
		else:
			_remember(key, job.result)

	var plan := plan_stream(_anchors, _loaded.keys())
	for key: Vector2i in plan["unload"]:
		_remember(key, _loaded[key])
		_loaded.erase(key)
		chunk_unloaded.emit(key.x, key.y)
	for key: Vector2i in plan["load"]:
		if _jobs.has(key):
			continue
		if _recent.has(key):
			_loaded[key] = _recent[key] # a cache hit is free
			_recent.erase(key)
			chunk_loaded.emit(key.x, key.y)
		elif _jobs.size() < MAX_JOBS_IN_FLIGHT:
			var job := _Job.new()
			job.seed = _seed
			job.cx = key.x
			job.cy = key.y
			# High priority: low-priority pool tasks share only low_priority_thread_ratio of the threads (one
			# thread on a 4-core machine). MAX_JOBS_IN_FLIGHT bounds how many threads this takes.
			job.task_id = WorkerThreadPool.add_task(job.run, true, "chunk %d,%d" % [key.x, key.y])
			_jobs[key] = job
			generations += 1


## Chunk (cx, cy), never null for coordinates generate_chunk accepts. A chunk that is not loaded or recent is
## built synchronously (cached as recent); one that is in flight is waited for, never built twice.
func chunk(cx: int, cy: int) -> Chunk:
	var key := Vector2i(cx, cy)
	var c: Chunk = _loaded.get(key)
	if c != null:
		return c
	if _recent.has(key):
		c = _recent[key]
		_remember(key, c) # now the most recently used
		return c
	if _jobs.has(key):
		var job: _Job = _jobs[key]
		WorkerThreadPool.wait_for_task_completion(job.task_id)
		_jobs.erase(key)
		job_usec.append(job.usec)
		c = job.result
	else:
		generations += 1
		c = build_chunk(_seed, cx, cy)
	_remember(key, c)
	return c


func tile_at(tx: int, ty: int) -> int:
	var cx := floori(tx / float(OgWorld.CHUNK_TILES))
	var cy := floori(ty / float(OgWorld.CHUNK_TILES))
	return chunk(cx, cy).tiles[(ty - cy * OgWorld.CHUNK_TILES) * OgWorld.CHUNK_TILES + (tx - cx * OgWorld.CHUNK_TILES)]


func biome_at(tx: int, ty: int) -> int:
	var cx := floori(tx / float(OgWorld.CHUNK_TILES))
	var cy := floori(ty / float(OgWorld.CHUNK_TILES))
	return chunk(cx, cy).biomes[(ty - cy * OgWorld.CHUNK_TILES) * OgWorld.CHUNK_TILES + (tx - cx * OgWorld.CHUNK_TILES)]


## Ground height in metres under world point (x, z), on the drawn surface (OgTerrain.interpolate).
func height_at(x: float, z: float) -> float:
	var tx := floori(x / OgWorld.TILE_M)
	var ty := floori(z / OgWorld.TILE_M)
	var cx := floori(tx / float(OgWorld.CHUNK_TILES))
	var cy := floori(ty / float(OgWorld.CHUNK_TILES))
	var h := chunk(cx, cy).heights
	var i := (ty - cy * OgWorld.CHUNK_TILES) * OgTerrain.CORNERS + (tx - cx * OgWorld.CHUNK_TILES)
	var fx := x / OgWorld.TILE_M - tx
	var fz := z / OgWorld.TILE_M - ty
	return OgTerrain.interpolate(h[i], h[i + 1], h[i + OgTerrain.CORNERS], h[i + OgTerrain.CORNERS + 1], fx, fz)


func is_loaded(cx: int, cy: int) -> bool:
	return _loaded.has(Vector2i(cx, cy))


func loaded_count() -> int:
	return _loaded.size()


## Sorted by (y, x). For tests.
func loaded_coords() -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	out.assign(_loaded.keys())
	out.sort_custom(func(a: Vector2i, b: Vector2i) -> bool: return a.y < b.y or (a.y == b.y and a.x < b.x))
	return out


func in_flight(cx: int, cy: int) -> bool:
	return _jobs.has(Vector2i(cx, cy))


func in_flight_count() -> int:
	return _jobs.size()


func recent_count() -> int:
	return _recent.size()


## Inserts or refreshes key as the most recently used, evicting the oldest past RECENT_CHUNKS.
func _remember(key: Vector2i, c: Chunk) -> void:
	_recent.erase(key)
	_recent[key] = c
	while _recent.size() > RECENT_CHUNKS:
		_recent.erase(_recent.keys()[0])
