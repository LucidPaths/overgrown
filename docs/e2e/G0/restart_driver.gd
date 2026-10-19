extends SceneTree
## G0 E2E restart driver: loads the main scene, sprints east with Shift+D (parsed key events) so chunks are
## streaming, then reloads the scene while chunk and mesh jobs are in flight, ROUNDS times; finally quits
## mid-stream. Prints world-ready and the in-flight job count at each reload; a crash or SCRIPT ERROR fails.
## Run (repo root): timeout 300 xvfb-run -a -s "-screen 0 1280x720x24" godot --path game --audio-driver Dummy \
##   --script "$PWD/docs/e2e/G0/restart_driver.gd" -- --seed 1

const ROUNDS := 3


func _initialize() -> void:
	change_scene_to_file("res://scenes/main.tscn")
	_run.call_deferred()


func _run() -> void:
	create_timer(280.0).timeout.connect(func() -> void:
		printerr("DRIVER WATCHDOG")
		quit(3))
	for round in ROUNDS + 1:
		while current_scene == null or current_scene._ready_usec < 0:
			await process_frame
		var main := current_scene
		print("ROUND %d: world ready, you at %s, sim tick %d" % [round, main._you.pos, main._sim.tick])
		_key(KEY_SHIFT, true)
		_key(KEY_D, true)
		var t0: int = main._sim.tick
		while main._sim.tick - t0 < 150:
			await physics_frame
		print("ROUND %d: sprinted to %s; chunk jobs in flight %d, loaded %d" % [round, main._you.pos, main._sim.store.in_flight_count(), main._sim.store.loaded_count()])
		_key(KEY_D, false)
		_key(KEY_SHIFT, false)
		if round < ROUNDS:
			print("ROUND %d: reload_current_scene -> %s" % [round, error_string(reload_current_scene())])
			await process_frame
			await process_frame
	print("QUIT while streaming")
	quit(0)


func _key(k: Key, down: bool) -> void:
	var e := InputEventKey.new()
	e.keycode = k
	e.physical_keycode = k
	e.pressed = down
	Input.parse_input_event(e)
