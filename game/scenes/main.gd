extends Node3D
## G0 world scene: the wanderer in a seeded 3D world streaming around them, seen through the tilted ARPG
## camera. One OgSim holds the rules; this scene feeds it the local input (or a script) through the
## character's latch and steps it once per physics tick; the views read it.
## User args (after --):
##   --seed N           world seed (default 1)
##   --at X,Z           start the wanderer at world metres (X, Z) instead of the spawn (the foot box must be on
##                      walkable tiles)
##   --vista            hold the vista pose
##   --wanderer old|new the wanderer's look: new = the Blender-built model (OgWandererView, default), old = the G0
##                      placeholder (OgCharacterView)
##   --autopilot        drive the wanderer with OgAutopilot's scripted frames (from world ready), not devices
##   --capture PNG      wait for world ready (and --capture-tick), render --frames N warm-up frames (default 5),
##                      save the PNG, quit 0
##   --capture-tick N   with --capture: freeze the rules after N ticks counted from world ready, then capture
##   --walk N           after world ready, sprint the wanderer east across N chunks (through the latch, with
##                      collision; ends early if blocked) and print the timings, then capture or quit 0
## World ready: every chunk within READY_RADIUS of the wanderer's chunk is meshed; its time from scene start
## is printed. A watchdog quits with 2 after WATCHDOG_S in capture and walk modes so a pipeline never hangs.

enum Driver { DEVICES, AUTOPILOT, WALK }

const DEFAULT_SEED := 1
const DEFAULT_WARMUP_FRAMES := 5
const WATCHDOG_S := 90.0
## Chebyshev radius, in chunks, around the wanderer's chunk that must be meshed for world ready.
const READY_RADIUS := 1
## --walk ends early after this many ticks without eastward progress.
const WALK_STUCK_TICKS := 120
## Indexed by OgBiome id, OgTile id and OgCharacter.Action.
const BIOME_NAMES: Array[String] = ["Grassland", "Forest", "River", "Mountain", "Ocean"]
const TILE_NAMES: Array[String] = ["grass", "dirt", "sand", "stone", "cliff", "shallow water", "deep water", "very deep water"]
const ACTION_NAMES: Array[String] = ["idle", "walk", "attack", "dodge"]

var _seed := DEFAULT_SEED
var _sim: OgSim
var _you: OgCharacter
var _latch: OgInputLatch
var _scene_start_usec := 0
## Scene start to world ready, or -1 before.
var _ready_usec := -1
var _driver := Driver.DEVICES
## Rules ticks stepped since world ready (the autopilot's clock and --capture-tick's).
var _script_tick := 0
## Freeze the rules once _script_tick reaches this (-1: never).
var _freeze_at := -1
var _frozen := false
var _walk_goal_x := 0.0
var _walk_best_x := 0.0
var _walk_stuck := 0
var _walk_done := false
var _walk_longest_frame_usec := 0
var _walk_longest_step_usec := 0
var _last_frame_usec := 0
## Measured ground speed (m/s): the last tick's displacement * TICK_HZ.
var _speed := 0.0

@onready var _env: WorldEnvironment = $WorldEnvironment
@onready var _terrain: OgTerrainView = $Terrain
@onready var _view: Node3D = $Wanderer
@onready var _local: OgLocalInput = $LocalInput
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
	var spawn_start := Time.get_ticks_usec()
	_sim = OgSim.create(_seed)
	if _sim == null:
		get_tree().quit(2)
		return
	print("SPAWN (%.1f, %.1f) m, search %.0f ms" % [_sim.spawn.x, _sim.spawn.y, (Time.get_ticks_usec() - spawn_start) / 1000.0])
	var at: Vector2 = opts["at"] if opts["has_at"] else _sim.spawn
	var blocked := _blocked_tile_under_box(at)
	if blocked != "":
		printerr("--at %.3f,%.3f: the foot box covers %s; pick walkable ground" % [at.x, at.y, blocked])
		_sim = null
		get_tree().quit(2)
		return
	_terrain.setup(_sim.store)
	if opts["wanderer"] == "new":
		_view.free()
		_view = OgWandererView.new()
		_view.name = "Wanderer"
		add_child(_view)
	_you = _sim.add_character(at)
	_latch = _sim.drive(_you)
	_sim.you = _you
	_view.setup(_sim)
	_local.camera = _rig.get_node("Camera3D")
	_rig.target = _view
	_rig.environment = _env.environment
	_rig.force_vista = opts["vista"]
	_rig.snap()
	if opts["autopilot"]:
		_driver = Driver.AUTOPILOT
	if opts["capture"] != "" or opts["walk"] > 0:
		_run_script(opts["capture"], opts["frames"], opts["walk"], opts["capture_tick"])


## "" if the foot box at feet point p covers only walkable tiles, else the first blocked tile it covers.
func _blocked_tile_under_box(p: Vector2) -> String:
	var h := OgRules.FOOT_HALF_M
	for ty in range(floori(p.y - h), -floori(-(p.y + h))):
		for tx in range(floori(p.x - h), -floori(-(p.x + h))):
			var tile := _sim.store.tile_at(tx, ty)
			if not OgWalkability.TILE_RULES[tile]["walkable"]:
				return "%s at tile (%d, %d)" % [TILE_NAMES[tile], tx, ty]
	return ""


## {seed, at, has_at, vista, autopilot, capture, capture_tick, frames, walk, wanderer}, or {} after printing what is wrong.
func _parse_args(args: PackedStringArray) -> Dictionary:
	var o := {"seed": DEFAULT_SEED, "at": Vector2.ZERO, "has_at": false, "vista": false, "autopilot": false, "capture": "",
		"capture_tick": -1, "frames": DEFAULT_WARMUP_FRAMES, "walk": 0, "wanderer": "new"}
	var i := 0
	while i < args.size():
		var a := args[i]
		if a == "--vista" or a == "--autopilot":
			o[a.substr(2)] = true
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
			"--capture-tick":
				if not v.is_valid_int() or v.to_int() < 0:
					printerr("--capture-tick needs a tick count >= 0, got '%s'" % v)
					return {}
				o["capture_tick"] = v.to_int()
			"--frames":
				if not v.is_valid_int() or v.to_int() < 1:
					printerr("--frames needs a positive integer, got '%s'" % v)
					return {}
				o["frames"] = v.to_int()
			"--wanderer":
				if v != "old" and v != "new":
					printerr("--wanderer needs old or new, got '%s'" % v)
					return {}
				o["wanderer"] = v
			"--walk":
				if not v.is_valid_int() or v.to_int() < 1:
					printerr("--walk needs a positive number of chunks, got '%s'" % v)
					return {}
				o["walk"] = v.to_int()
			_:
				printerr("unknown argument '%s'" % a)
				return {}
		i += 2
	if o["capture_tick"] >= 0 and o["capture"] == "":
		printerr("--capture-tick needs --capture")
		return {}
	if o["autopilot"] and o["walk"] > 0:
		printerr("--autopilot and --walk are two different scripts; pick one")
		return {}
	return o


func _physics_process(_delta: float) -> void:
	if _you == null or _frozen:
		return
	var running := _ready_usec >= 0
	var f: OgInputLatch.InputFrame
	match _driver:
		Driver.AUTOPILOT:
			f = OgAutopilot.frame(_script_tick) if running else OgInputLatch.InputFrame.new()
		Driver.WALK:
			f = OgInputLatch.InputFrame.new()
			if not _walk_done:
				f.move = Vector2(1, 0)
				f.sprint = true
		_:
			f = _local.frame(_you, _sim.store.height_at(_you.pos.x, _you.pos.y))
	_latch.submit(f)
	var before := _you.pos
	var start := Time.get_ticks_usec()
	_sim.step()
	_speed = before.distance_to(_you.pos) * OgRules.TICK_HZ
	if _driver == Driver.WALK and not _walk_done:
		_walk_longest_step_usec = maxi(_walk_longest_step_usec, Time.get_ticks_usec() - start)
		_track_walk()
	if running:
		_script_tick += 1
		if _script_tick == _freeze_at:
			_frozen = true


func _track_walk() -> void:
	if _you.pos.x >= _walk_goal_x:
		_walk_done = true
	elif _you.pos.x > _walk_best_x + 0.01:
		_walk_best_x = _you.pos.x
		_walk_stuck = 0
	else:
		_walk_stuck += 1
		if _walk_stuck >= WALK_STUCK_TICKS:
			print("WALK BLOCKED at (%.2f, %.2f) m, %.1f m short" % [_you.pos.x, _you.pos.y, _walk_goal_x - _you.pos.x])
			_walk_done = true


func _process(_delta: float) -> void:
	if _you == null:
		return
	var now := Time.get_ticks_usec()
	if _driver == Driver.WALK and not _walk_done and _last_frame_usec > 0:
		_walk_longest_frame_usec = maxi(_walk_longest_frame_usec, now - _last_frame_usec)
	_last_frame_usec = now
	var p := _you.pos
	var tx := floori(p.x / OgWorld.TILE_M)
	var ty := floori(p.y / OgWorld.TILE_M)
	if _ready_usec < 0 and _world_ready(p):
		_ready_usec = now - _scene_start_usec
		print("WORLD READY %.0f ms after scene start (%d chunks meshed)" % [_ready_usec / 1000.0, _terrain.meshed_count()])
	var source: String = ["", "autopilot", "walk script"][_driver] if _driver != Driver.DEVICES else _local.device_name()
	_label.text = "overgrown G0  v%s (%s)\nseed %d   tile (%d, %d) %s, %s\n%s   %.1f m/s   input: %s\nchunks loaded %d   fps %d" % [
		GameVersion.VERSION, BuildInfo.COMMIT, _seed, tx, ty, TILE_NAMES[_sim.store.tile_at(tx, ty)], BIOME_NAMES[_sim.store.biome_at(tx, ty)],
		ACTION_NAMES[_you.action], _speed, source, _sim.store.loaded_count(), Engine.get_frames_per_second()]


func _world_ready(p: Vector2) -> bool:
	var cx := OgChunkStore.chunk_of(p.x)
	var cy := OgChunkStore.chunk_of(p.y)
	for y in range(cy - READY_RADIUS, cy + READY_RADIUS + 1):
		for x in range(cx - READY_RADIUS, cx + READY_RADIUS + 1):
			if not _terrain.is_meshed(x, y):
				return false
	return true


func _run_script(path: String, frames: int, walk_chunks: int, capture_tick: int) -> void:
	get_tree().create_timer(WATCHDOG_S).timeout.connect(func() -> void:
		printerr("WATCHDOG TIMEOUT")
		get_tree().quit(2))
	if capture_tick >= 0:
		_freeze_at = capture_tick
		_frozen = capture_tick == 0
	while _ready_usec < 0:
		await get_tree().process_frame
	_print_timings()
	if walk_chunks > 0:
		_walk_goal_x = _you.pos.x + walk_chunks * OgChunkStore.CHUNK_M
		_walk_best_x = _you.pos.x
		_driver = Driver.WALK
		var walk_start := Time.get_ticks_usec()
		while not _walk_done:
			await get_tree().process_frame
		print("TIMING walk %d chunks east in %.1f s: longest frame %.1f ms, longest sim.step %.2f ms" % [
			walk_chunks, (Time.get_ticks_usec() - walk_start) / 1e6, _walk_longest_frame_usec / 1000.0, _walk_longest_step_usec / 1000.0])
		_print_timings()
	if path == "":
		get_tree().quit(0)
		return
	while not _frozen and _freeze_at >= 0:
		await get_tree().process_frame
	if _freeze_at >= 0:
		print("FROZEN at script tick %d: %s at (%.3f, %.3f) facing (%.3f, %.3f), action start %d, sim tick %d" % [
			_script_tick, ACTION_NAMES[_you.action], _you.pos.x, _you.pos.y, _you.facing.x, _you.facing.y, _you.action_start, _sim.tick])
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
		_median(_sim.store.job_usec) / 1000.0, _sim.store.job_usec.size(), _median(_terrain.build_usec) / 1000.0, _terrain.build_usec.size(),
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
