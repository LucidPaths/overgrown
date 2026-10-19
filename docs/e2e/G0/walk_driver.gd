extends SceneTree
## G0 E2E walk driver: holds the physical D key (walk east) through Input.parse_input_event in the running main
## scene for G0_TICKS rules ticks, then taps Space (a dodge into whatever stopped it), and logs where the
## wanderer went: per-tick speed by the tile under the foot box centre, the stop position and the tile east of
## it. Screenshot G0_OUT/G0_SHOT with the rules paused.
## Run (repo root): G0_OUT=docs/e2e/G0 G0_SHOT=x.png G0_TICKS=150 xvfb-run -a -s "-screen 0 1280x720x24" \
##   godot --path game --audio-driver Dummy --script "$PWD/docs/e2e/G0/walk_driver.gd" -- --seed 1 --at X,Z

const TILE_NAMES := ["grass", "dirt", "sand", "stone", "cliff", "shallow water", "deep water", "very deep water"]
var main: Node


func _initialize() -> void:
	change_scene_to_file("res://scenes/main.tscn")
	_run.call_deferred()


func _run() -> void:
	create_timer(200.0).timeout.connect(func() -> void:
		printerr("DRIVER WATCHDOG")
		quit(3))
	while current_scene == null:
		await process_frame
	main = current_scene
	while main._ready_usec < 0:
		await process_frame
	var you: Object = main._you
	var store: Object = main._sim.store
	var ticks := int(OS.get_environment("G0_TICKS"))
	print("START at (%.4f, %.4f) on %s" % [you.pos.x, you.pos.y, _tile(store, you.pos)])
	_key(KEY_D, true)
	var speeds := {} # tile name -> [sum, n]
	var last: Vector2 = you.pos
	var t0: int = main._sim.tick
	var stop_tick := -1
	while main._sim.tick - t0 < ticks:
		var tick: int = main._sim.tick
		await physics_frame
		if main._sim.tick == tick:
			continue
		var v: float = (you.pos.x - last.x) * 60.0
		var name := _tile(store, last)
		if v > 0.0:
			if not speeds.has(name):
				speeds[name] = [0.0, 0, 1e9, 0.0]
			speeds[name][0] += v
			speeds[name][1] += 1
			speeds[name][2] = minf(speeds[name][2], v)
			speeds[name][3] = maxf(speeds[name][3], v)
		elif you.action == 1 and stop_tick < 0:
			stop_tick = main._sim.tick - t0
		last = you.pos
	for name: String in speeds:
		var s: Array = speeds[name]
		print("SPEED on %s: mean %.3f m/s, min %.3f, max %.3f over %d moving ticks" % [name, s[0] / s[1], s[2], s[3], s[1]])
	var east_tile := floori(you.pos.x + you.half_size)
	print("STOP after %d ticks at (%.4f, %.4f), action %d, box right edge x = %.4f; tile east of the edge (%d, %d) = %s" % [
		stop_tick, you.pos.x, you.pos.y, you.action, you.pos.x + you.half_size, east_tile, floori(you.pos.y), TILE_NAMES[store.tile_at(east_tile, floori(you.pos.y))]])
	await _shot(OS.get_environment("G0_SHOT"))
	# Dodge into the obstacle with D still held.
	var before: Vector2 = you.pos
	_key(KEY_SPACE, true)
	var saw_dodge := false
	var max_x: float = you.pos.x
	t0 = main._sim.tick
	while main._sim.tick - t0 < 60:
		await physics_frame
		if main._sim.tick - t0 == 3:
			_key(KEY_SPACE, false)
		saw_dodge = saw_dodge or you.action == 3
		max_x = maxf(max_x, you.pos.x)
	print("DODGE max x during it %.4f" % max_x)
	print("DODGE into it: dodge seen %s, moved (%.4f, %.4f), now (%.4f, %.4f)" % [saw_dodge, you.pos.x - before.x, you.pos.y - before.y, you.pos.x, you.pos.y])
	_key(KEY_D, false)
	quit(0)


func _tile(store: Object, p: Vector2) -> String:
	return TILE_NAMES[store.tile_at(floori(p.x), floori(p.y))]


func _shot(name: String) -> void:
	var out := OS.get_environment("G0_OUT")
	if out == "" or name == "":
		return
	main._frozen = true
	for i in 4:
		await RenderingServer.frame_post_draw
	var path := out.path_join(name)
	var err := root.get_texture().get_image().save_png(path)
	print("SHOT %s (%s) | HUD: %s" % [path, error_string(err), main._label.text.replace("\n", " / ")])
	main._frozen = false


func _key(k: Key, down: bool) -> void:
	var e := InputEventKey.new()
	e.keycode = k
	e.physical_keycode = k
	e.pressed = down
	Input.parse_input_event(e)
