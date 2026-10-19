extends Node3D
## G0 world scene: a seeded 3D world streaming around a focus point, seen through the tilted ARPG camera.
## User args (after --):
##   --seed N       world seed (default 1)
##   --at X,Z       start the focus at world metres (X, Z) instead of the spawn
##   --vista        hold the vista pose
##   --capture PNG  wait for world ready, render --frames N warm-up frames (default 5), save the PNG, quit 0
##   --walk N       after world ready, walk the focus east across N chunks and print the timings, then
##                  capture (with --capture) or quit 0
## World ready: every chunk within READY_RADIUS of the focus chunk is meshed; its time from scene start is
## printed. A watchdog quits with 2 after WATCHDOG_S in capture and walk modes so a pipeline never hangs.

const DEFAULT_SEED := 1
const DEFAULT_WARMUP_FRAMES := 5
const WATCHDOG_S := 90.0
## Chebyshev radius, in chunks, around the focus chunk that must be meshed for world ready.
const READY_RADIUS := 1
## Debug focus speed.
const FOCUS_SPEED_M_S := 6.0
## Indexed by OgBiome id.
const BIOME_NAMES: Array[String] = ["Grassland", "Forest", "River", "Mountain", "Ocean"]

var _seed := DEFAULT_SEED
var _store: OgChunkStore
var _scene_start_usec := 0
## Scene start to world ready, or -1 before.
var _ready_usec := -1
## Scripted walk: metres left to walk east; 0 = the move actions drive the focus.
var _walk_left_m := 0.0
var _walk_longest_frame_usec := 0
var _walk_longest_step_usec := 0
var _last_frame_usec := 0

@onready var _env: WorldEnvironment = $WorldEnvironment
@onready var _terrain: OgTerrainView = $Terrain
## TEMPORARY debug focus, moved by the move actions with no collision. GOD-006 replaces it with the character.
@onready var _focus: Node3D = $Focus
@onready var _rig: OgCameraRig = $CameraRig
@onready var _label: Label = $Hud/Label


func _ready() -> void:
	_scene_start_usec = Time.get_ticks_usec()
	OgActions.ensure()
	var opts := _parse_args(OS.get_cmdline_user_args())
	if opts.is_empty():
		get_tree().quit(2)
		return
	_seed = opts["seed"]
	_store = OgChunkStore.new(_seed)
	_terrain.setup(_store)
	var at: Vector2 = opts["at"]
	if not opts["has_at"]:
		var spawn_start := Time.get_ticks_usec()
		var spawn := OgSpawn.find_spawn(_seed)
		if spawn.is_empty():
			get_tree().quit(2)
			return
		at = Vector2(spawn["x"], spawn["y"]) / OgWorld.TILE_PX * OgWorld.TILE_M
		print("SPAWN (%.1f, %.1f) m, search %.0f ms" % [at.x, at.y, (Time.get_ticks_usec() - spawn_start) / 1000.0])
	_focus.position = Vector3(at.x, _store.height_at(at.x, at.y), at.y)
	_focus.reset_physics_interpolation()
	_store.set_anchors([at])
	_rig.target = _focus
	_rig.environment = _env.environment
	_rig.force_vista = opts["vista"]
	_rig.snap()
	if opts["capture"] != "" or opts["walk"] > 0:
		_run_script(opts["capture"], opts["frames"], opts["walk"])


## {seed, at, has_at, vista, capture, frames, walk}, or {} after printing what is wrong.
func _parse_args(args: PackedStringArray) -> Dictionary:
	var o := {"seed": DEFAULT_SEED, "at": Vector2.ZERO, "has_at": false, "vista": false, "capture": "", "frames": DEFAULT_WARMUP_FRAMES, "walk": 0}
	var i := 0
	while i < args.size():
		var a := args[i]
		if a == "--vista":
			o["vista"] = true
			i += 1
			continue
		var v := args[i + 1] if i + 1 < args.size() else ""
		match a:
			"--seed":
				if not v.is_valid_int() or v.to_int() < 0 or v.to_int() > OgWorld.U32_MAX:
					printerr("--seed needs an integer in 0..4294967295, got '%s'" % v)
					return {}
				o["seed"] = v.to_int()
			"--at":
				var parts := v.split(",")
				if parts.size() != 2 or not parts[0].is_valid_float() or not parts[1].is_valid_float():
					printerr("--at needs X,Z in world metres, got '%s'" % v)
					return {}
				o["at"] = Vector2(parts[0].to_float(), parts[1].to_float())
				o["has_at"] = true
			"--capture":
				if v == "":
					printerr("--capture needs a PNG path")
					return {}
				o["capture"] = v
			"--frames":
				if not v.is_valid_int() or v.to_int() < 1:
					printerr("--frames needs a positive integer, got '%s'" % v)
					return {}
				o["frames"] = v.to_int()
			"--walk":
				if not v.is_valid_int() or v.to_int() < 1:
					printerr("--walk needs a positive number of chunks, got '%s'" % v)
					return {}
				o["walk"] = v.to_int()
			_:
				printerr("unknown argument '%s'" % a)
				return {}
		i += 2
	return o


func _physics_process(delta: float) -> void:
	var move := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if _walk_left_m > 0.0:
		move = Vector2.RIGHT
	var d := move * FOCUS_SPEED_M_S * delta
	if _walk_left_m > 0.0:
		_walk_left_m = maxf(_walk_left_m - d.x, 0.0)
	var p := _focus.position + Vector3(d.x, 0.0, d.y)
	p.y = _store.height_at(p.x, p.z)
	_focus.position = p
	_store.set_anchors([Vector2(p.x, p.z)])
	var start := Time.get_ticks_usec()
	_store.step()
	if _walk_left_m > 0.0:
		_walk_longest_step_usec = maxi(_walk_longest_step_usec, Time.get_ticks_usec() - start)


func _process(_delta: float) -> void:
	var now := Time.get_ticks_usec()
	if _walk_left_m > 0.0 and _last_frame_usec > 0:
		_walk_longest_frame_usec = maxi(_walk_longest_frame_usec, now - _last_frame_usec)
	_last_frame_usec = now
	var p := _focus.position
	var tx := floori(p.x / OgWorld.TILE_M)
	var ty := floori(p.z / OgWorld.TILE_M)
	if _ready_usec < 0 and _world_ready(p):
		_ready_usec = now - _scene_start_usec
		print("WORLD READY %.0f ms after scene start (%d chunks meshed)" % [_ready_usec / 1000.0, _terrain.meshed_count()])
	_label.text = "overgrown G0  v%s (%s)\nseed %d   tile (%d, %d)   %s\nchunks loaded %d   fps %d" % [
		GameVersion.VERSION, BuildInfo.COMMIT, _seed, tx, ty, BIOME_NAMES[_store.biome_at(tx, ty)],
		_store.loaded_count(), Engine.get_frames_per_second()]


func _world_ready(p: Vector3) -> bool:
	var cx := OgChunkStore.chunk_of(p.x)
	var cy := OgChunkStore.chunk_of(p.z)
	for y in range(cy - READY_RADIUS, cy + READY_RADIUS + 1):
		for x in range(cx - READY_RADIUS, cx + READY_RADIUS + 1):
			if not _terrain.is_meshed(x, y):
				return false
	return true


func _run_script(path: String, frames: int, walk_chunks: int) -> void:
	get_tree().create_timer(WATCHDOG_S).timeout.connect(func() -> void:
		printerr("WATCHDOG TIMEOUT")
		get_tree().quit(2))
	while _ready_usec < 0:
		await get_tree().process_frame
	_print_timings()
	if walk_chunks > 0:
		_walk_left_m = walk_chunks * OgChunkStore.CHUNK_M
		var walk_start := Time.get_ticks_usec()
		while _walk_left_m > 0.0:
			await get_tree().process_frame
		print("TIMING walk %d chunks east in %.1f s: longest frame %.1f ms, longest store.step %.2f ms" % [
			walk_chunks, (Time.get_ticks_usec() - walk_start) / 1e6, _walk_longest_frame_usec / 1000.0, _walk_longest_step_usec / 1000.0])
		_print_timings()
	if path == "":
		get_tree().quit(0)
		return
	for k in frames:
		await RenderingServer.frame_post_draw
	var err := DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	if err != OK:
		printerr("cannot create the directory for %s (error %d)" % [path, err])
		get_tree().quit(1)
		return
	err = get_viewport().get_texture().get_image().save_png(path)
	if err != OK:
		printerr("cannot save %s (error %d)" % [path, err])
		get_tree().quit(1)
		return
	print("CAPTURE ", path)
	get_tree().quit(0)


func _print_timings() -> void:
	print("TIMING chunk job median %.1f ms (n %d); mesh build median %.1f ms (n %d); main-thread mesh add median %.2f ms, max %.2f ms" % [
		_median(_store.job_usec) / 1000.0, _store.job_usec.size(), _median(_terrain.build_usec) / 1000.0, _terrain.build_usec.size(),
		_median(_terrain.add_usec) / 1000.0, _max(_terrain.add_usec) / 1000.0])


static func _median(v: Array[int]) -> float:
	if v.is_empty():
		return 0.0
	var s := v.duplicate()
	s.sort()
	var h := floori(s.size() / 2.0)
	return float(s[h]) if s.size() % 2 == 1 else (s[h - 1] + s[h]) / 2.0


static func _max(v: Array[int]) -> int:
	var m := 0
	for x in v:
		m = maxi(m, x)
	return m
