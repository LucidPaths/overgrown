extends SceneTree
## G0 E2E input driver: plays the main scene through the real device path. It injects InputEvents with
## Input.parse_input_event (keyboard keys, mouse buttons and motion, joypad motion and buttons) and moves the
## real X cursor with Input.warp_mouse (the game reads the mouse aim from the OS cursor), then checks the rules
## state (position, action, facing) and the HUD text. It never writes game state except main._frozen, which
## pauses the rules while a screenshot is taken.
##
## Run (from the repo root; xvfb like tools/godot/capture.sh):
##   G0_OUT=docs/e2e/G0 timeout 300 xvfb-run -a -s "-screen 0 1280x720x24" godot --path game --audio-driver Dummy \
##     --rendering-method forward_plus --script "$PWD/docs/e2e/G0/input_driver.gd" -- --seed 1
## Prints STEP / OBS / CHECK lines; quits 0 when every CHECK passed, else 1.

const IDLE := 0
const WALK := 1
const ATTACK := 2
const DODGE := 3
const ACTIONS := ["idle", "walk", "attack", "dodge"]

var main: Node
var out_dir := ""
var failures := 0
var checks := 0


func _initialize() -> void:
	out_dir = OS.get_environment("G0_OUT")
	change_scene_to_file("res://scenes/main.tscn")
	_run.call_deferred()


func _run() -> void:
	var watchdog := create_timer(280.0)
	watchdog.timeout.connect(func() -> void:
		printerr("DRIVER WATCHDOG")
		quit(3))
	while current_scene == null:
		await process_frame
	main = current_scene
	while main._ready_usec < 0:
		await process_frame
	print("STEP world ready; seed %d, you at %s" % [main._seed, _p()])
	await _ticks(10)

	await _keyboard()
	await _mouse()
	await _gamepad()
	await _camera()

	print("DONE %d checks, %d failed" % [checks, failures])
	quit(1 if failures > 0 else 0)


# ---------------------------------------------------------------- keyboard

func _keyboard() -> void:
	print("STEP keyboard: D held 60 ticks (walk east)")
	_key(KEY_D, true)
	await _settle()
	_check("HUD shows keyboard + mouse after a key", _hud().contains("input: keyboard + mouse"), _hud_line(3))
	var r := await _hold(60)
	_key(KEY_D, false)
	await _settle()
	_check("D walks east", r.dx > 4.0 and absf(r.dz) < 0.3, _fmt(r))
	_check("D: action walk, facing east", r.actions.has(WALK) and _you().facing.distance_to(Vector2(1, 0)) < 0.01, "facing %s" % _you().facing)
	_check("D: walk speed 5 m/s (+-10%%; tile factor 1 on dry ground)", absf(r.max_speed - 5.0) < 0.5, "%.2f m/s" % r.max_speed)
	await _ticks(5)
	_check("release D: idle", _you().action == IDLE, ACTIONS[_you().action])

	print("STEP keyboard: Shift+W held 60 ticks (sprint north)")
	_key(KEY_SHIFT, true)
	_key(KEY_W, true)
	await _settle()
	r = await _hold(30)
	await _shot("10-kb-sprint-north.png")
	var r2 := await _hold(30)
	_key(KEY_W, false)
	_key(KEY_SHIFT, false)
	await _settle()
	_check("Shift+W sprints north", r.dz + r2.dz < -7.5 and absf(r.dx + r2.dx) < 0.3, "dx %.2f dz %.2f over 60 ticks" % [r.dx + r2.dx, r.dz + r2.dz])
	_check("sprint speed 8 m/s (5 * 1.6)", absf(maxf(r.max_speed, r2.max_speed) - 8.0) < 0.5, "%.2f m/s" % maxf(r.max_speed, r2.max_speed))
	_check("Shift+W: facing north", _you().facing.distance_to(Vector2(0, -1)) < 0.01, "facing %s" % _you().facing)
	await _ticks(5)

	print("STEP keyboard: A held + Space tap (dodge west)")
	_key(KEY_A, true)
	await _ticks(10)
	var p0 := _p()
	_key(KEY_SPACE, true)
	await _ticks(1)
	_key(KEY_SPACE, false)
	var d := await _watch_action(DODGE, "11-kb-dodge-west.png")
	_key(KEY_A, false)
	_check("Space starts a dodge", d.started, "action seen %s" % d.seen)
	_check("dodge lasts 21 ticks", d.ticks == 21, "%d ticks" % d.ticks)
	_check("dodge rolls ~3 m west", d.dx < -2.7 and d.dx > -3.3 and absf(d.dz) < 0.2, "dx %.2f dz %.2f" % [d.dx, d.dz])
	await _ticks(10)
	_check("after the dodge: back to walk/idle", _you().action == IDLE or _you().action == WALK, ACTIONS[_you().action])
	print("OBS total move from Space press: %s" % (_p() - p0))


# ---------------------------------------------------------------- mouse

func _mouse() -> void:
	print("STEP mouse probe: a parsed InputEventMouseMotion alone (no warp) vs Input.warp_mouse")
	var probe := _screen_of_you() + Vector2(-300, 0)
	var m := InputEventMouseMotion.new()
	m.position = probe
	m.global_position = probe
	Input.parse_input_event(m)
	await _settle()
	print("OBS parsed motion to %s only: viewport mouse %s (the aim reads the OS cursor, so a parsed motion alone doesn't move it)" % [probe, main.get_viewport().get_mouse_position()])
	Input.warp_mouse(probe)
	await _settle()
	print("OBS after warp_mouse(%s): viewport mouse %s" % [probe, main.get_viewport().get_mouse_position()])
	# Aim reads the OS cursor (Viewport.get_mouse_position), so the cursor is warped for real; X then
	# delivers the motion events to the game like a moved mouse.
	for t: Array in [[Vector2(260, 0), Vector2(1, 0), "east (right of the wanderer)"],
			[Vector2(0, -260), Vector2(0, -1), "north (above the wanderer)"],
			[Vector2(-200, 160), Vector2.ZERO, "south-west (below-left)"]]:
		var screen: Vector2 = _screen_of_you() + t[0]
		print("STEP mouse: warp the cursor to %s = %s, left click" % [screen, t[2]])
		Input.warp_mouse(screen)
		var motion := InputEventMouseMotion.new()
		motion.position = screen
		motion.global_position = screen
		Input.parse_input_event(motion)
		await _ticks(3)
		var aim: Vector2 = main._local.frame(_you(), main._sim.store.height_at(_you().pos.x, _you().pos.y)).aim
		print("OBS cursor %s, viewport mouse %s, aim %s" % [screen, main.get_viewport().get_mouse_position(), aim])
		_click(screen)
		var a := await _watch_action(ATTACK, "12-mouse-attack-%s.png" % ["east", "north", "southwest"][[Vector2(1, 0), Vector2(0, -1), Vector2.ZERO].find(t[1])])
		var want: Vector2 = t[1] if t[1] != Vector2.ZERO else aim.normalized()
		_check("click attacks (%s)" % t[2], a.started and a.ticks == 24, "seen %s, %d ticks" % [a.seen, a.ticks])
		_check("attack is rooted", a.dx == 0.0 and a.dz == 0.0, "dx %.3f dz %.3f" % [a.dx, a.dz])
		_check("facing toward the cursor (%s)" % t[2], a.facing.distance_to(want) < 0.08, "facing %s, want %s" % [a.facing, want])
		if t[1] == Vector2.ZERO:
			_check("south-west cursor gives a south-west aim", aim.x < 0.0 and aim.y > 0.0, "aim %s" % aim)
		await _ticks(5)

	print("STEP mouse: Space with no move key held rolls toward the cursor")
	var screen := _screen_of_you() + Vector2(260, 0)
	Input.warp_mouse(screen)
	await _ticks(3)
	_key(KEY_SPACE, true)
	await _ticks(1)
	_key(KEY_SPACE, false)
	var d := await _watch_action(DODGE, "")
	_check("idle dodge rolls along the mouse aim (east)", d.dx > 2.7 and absf(d.dz) < 0.3 and d.facing.distance_to(Vector2(1, 0)) < 0.08, "dx %.2f dz %.2f facing %s" % [d.dx, d.dz, d.facing])

	print("STEP mouse: double click inside one attack (buffer): two presses, the second inside the last 12 ticks")
	_click(screen)
	var t0: int = main._sim.tick
	while _you().action != ATTACK:
		await physics_frame
	while main._sim.tick - _you().action_start < 12:
		await physics_frame
	_click(screen)
	var first_end := -1
	var second_start := -1
	var start0: int = _you().action_start
	while main._sim.tick - t0 < 90:
		await physics_frame
		if _you().action == ATTACK and _you().action_start != start0 and second_start < 0:
			second_start = _you().action_start
	_check("a press in the buffer window chains a second attack", second_start == start0 + 24, "first start %d, second start %d" % [start0, second_start])
	await _ticks(10)


# ---------------------------------------------------------------- gamepad

func _gamepad() -> void:
	print("STEP gamepad: left stick x = 1.0 held 60 ticks (walk east)")
	_axis(JOY_AXIS_LEFT_X, 1.0)
	await _settle()
	_check("HUD shows gamepad after a stick move", _hud().contains("input: gamepad"), _hud_line(3))
	var r := await _hold(60)
	_check("left stick walks east at 5 m/s", r.dx > 4.0 and absf(r.dz) < 0.3 and absf(r.max_speed - 5.0) < 0.5, _fmt(r))

	print("STEP gamepad: LB held with the stick (sprint)")
	_button(JOY_BUTTON_LEFT_SHOULDER, true)
	await _settle()
	r = await _hold(30)
	await _shot("13-pad-sprint-hud.png")
	_button(JOY_BUTTON_LEFT_SHOULDER, false)
	await _settle()
	_check("LB sprints at 8 m/s", absf(r.max_speed - 8.0) < 0.5, _fmt(r))

	print("STEP gamepad: left stick diagonal (0.7, 0.7) held 30 ticks")
	_axis(JOY_AXIS_LEFT_X, 0.7)
	_axis(JOY_AXIS_LEFT_Y, 0.7)
	await _settle()
	r = await _hold(30)
	_check("diagonal stick walks south-east", r.dx > 1.5 and r.dz > 1.5 and absf(r.dx - r.dz) < 0.2, _fmt(r))
	_check("diagonal speed <= 5 m/s (stick rescaled past the deadzone)", r.max_speed <= 5.01 and r.max_speed > 4.0, "%.2f m/s" % r.max_speed)

	print("STEP gamepad: stick inside the deadzone (0.15, 0.1) -> no move")
	_axis(JOY_AXIS_LEFT_X, 0.15)
	_axis(JOY_AXIS_LEFT_Y, 0.1)
	await _settle()
	r = await _hold(20)
	_check("stick in the deadzone: idle", r.dx == 0.0 and r.dz == 0.0 and _you().action == IDLE, _fmt(r))
	_axis(JOY_AXIS_LEFT_X, 0.0)
	_axis(JOY_AXIS_LEFT_Y, 0.0)

	print("STEP gamepad: right stick (0, -1) (aim north), X")
	_axis(JOY_AXIS_RIGHT_Y, -1.0)
	await _ticks(3)
	_button(JOY_BUTTON_X, true)
	await _ticks(1)
	_button(JOY_BUTTON_X, false)
	var a := await _watch_action(ATTACK, "14-pad-attack-north.png")
	_check("X attacks", a.started and a.ticks == 24, "seen %s, %d ticks" % [a.seen, a.ticks])
	_check("X attack faces the right stick (north)", a.facing.distance_to(Vector2(0, -1)) < 0.01, "facing %s" % a.facing)

	print("STEP gamepad: right stick (-1, 0) (aim west), right trigger pulled to 1.0 in steps, held, released, pulled again")
	_axis(JOY_AXIS_RIGHT_Y, 0.0)
	_axis(JOY_AXIS_RIGHT_X, -1.0)
	await _ticks(3)
	for v in [0.3, 0.6, 0.9, 1.0]:
		_axis(JOY_AXIS_TRIGGER_RIGHT, v)
		await _ticks(1)
	var t0: int = main._sim.tick
	var starts := {}
	while main._sim.tick - t0 < 60:
		_axis(JOY_AXIS_TRIGGER_RIGHT, 1.0) # a held trigger keeps sending motion events
		await physics_frame
		if _you().action == ATTACK:
			starts[_you().action_start] = _you().facing
	_check("RT pull = exactly one attack while held (repeats ignored)", starts.size() == 1, "attack starts %s" % starts.keys())
	if starts.size() >= 1:
		_check("RT attack faces the right stick (west)", (starts.values()[0] as Vector2).distance_to(Vector2(-1, 0)) < 0.01, "facing %s" % starts.values()[0])
	_axis(JOY_AXIS_TRIGGER_RIGHT, 0.0)
	await _ticks(3)
	_axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)
	a = await _watch_action(ATTACK, "")
	_axis(JOY_AXIS_TRIGGER_RIGHT, 0.0)
	_check("release and pull RT again = a second attack", a.started, "seen %s" % a.seen)

	print("STEP gamepad: left stick (0, 1) (south) held, B (dodge), right stick still west")
	_axis(JOY_AXIS_LEFT_Y, 1.0)
	await _ticks(10)
	_button(JOY_BUTTON_B, true)
	await _ticks(1)
	_button(JOY_BUTTON_B, false)
	var d := await _watch_action(DODGE, "15-pad-dodge-south.png")
	_check("B dodges along the stick (south ~3 m)", d.started and d.dz > 2.7 and d.dz < 3.3 and absf(d.dx) < 0.2, "seen %s dx %.2f dz %.2f" % [d.seen, d.dx, d.dz])
	_check("dodge facing snaps to the right-stick aim (west, OQ-025)", d.facing.distance_to(Vector2(-1, 0)) < 0.01, "facing %s" % d.facing)
	_axis(JOY_AXIS_RIGHT_X, 0.0)

	print("STEP gamepad: stick (0, 1) still held, then a mouse jiggle (known: the held stick is ignored until it moves)")
	await _ticks(10)
	var before := _p()
	var screen := _screen_of_you() + Vector2(10, 10)
	Input.warp_mouse(screen)
	await _settle()
	print("OBS warp_mouse only (X delivers the motion): HUD %s" % _hud_line(3))
	var motion := InputEventMouseMotion.new()
	motion.position = screen
	motion.relative = Vector2(3, 3)
	Input.parse_input_event(motion)
	await _settle()
	_check("mouse jiggle switches the HUD to keyboard + mouse", _hud().contains("input: keyboard + mouse"), _hud_line(3))
	r = await _hold(30)
	print("OBS after the jiggle with the stick held: %s, action %s" % [_fmt(r), ACTIONS[_you().action]])
	_check("known feel note: held stick ignored after the jiggle", r.dx == 0.0 and r.dz == 0.0, _fmt(r))
	_axis(JOY_AXIS_LEFT_Y, 0.95)
	await _settle()
	r = await _hold(30)
	_check("moving the stick again takes the gamepad back", _hud().contains("input: gamepad") and r.dz > 2.0, "%s, %s" % [_hud_line(3), _fmt(r)])
	_axis(JOY_AXIS_LEFT_Y, 0.0)

	print("STEP keyboard after gamepad: a key press switches back")
	_key(KEY_S, true)
	await _settle()
	r = await _hold(20)
	_key(KEY_S, false)
	_check("S after the gamepad: keyboard + mouse, walks south", _hud().contains("input: keyboard + mouse") and r.dz > 1.2, "%s, %s" % [_hud_line(3), _fmt(r)])
	print("OBS end of input steps at %s; total from spawn %s" % [_p(), _p() - main._sim.spawn])


# ---------------------------------------------------------------- camera (zoom, vista)

func _camera() -> void:
	var rig: Node = main._rig
	var cam: Camera3D = rig.get_node("Camera3D")
	print("STEP camera: wheel down x3 (zoom out), wheel up x6 (zoom in)")
	var z0: float = rig._zoom_goal
	for i in 3:
		_wheel(MOUSE_BUTTON_WHEEL_DOWN)
		await _settle()
	var z_out: float = rig._zoom_goal
	await _ticks(60)
	await _shot("16-zoomed-out.png")
	for i in 6:
		_wheel(MOUSE_BUTTON_WHEEL_UP)
		await _settle()
	var z_in: float = rig._zoom_goal
	_check("wheel zooms out then in, clamped 8..24 m", z_out == minf(z0 + 6.0, 24.0) and z_in == maxf(z_out - 12.0, 8.0), "start %.0f, out %.0f, in %.0f" % [z0, z_out, z_in])
	await _ticks(60)
	await _shot("17-zoomed-in.png")
	for i in 3:
		_wheel(MOUSE_BUTTON_WHEEL_DOWN)
		await _ticks(1)

	print("STEP camera: V held (vista), then the gamepad Y")
	_key(KEY_V, true)
	await _ticks(150)
	var dist_v := cam.position.length()
	await _shot("18-vista-held-V.png")
	_key(KEY_V, false)
	await _ticks(150)
	var dist_back := cam.position.length()
	_button(JOY_BUTTON_Y, true)
	await _ticks(150)
	var dist_y := cam.position.length()
	_button(JOY_BUTTON_Y, false)
	_check("V and Y pull the camera out to the vista (~55 m) and back", dist_v > 50.0 and dist_y > 50.0 and dist_back < 20.0, "V %.1f m, released %.1f m, Y %.1f m" % [dist_v, dist_back, dist_y])


# ---------------------------------------------------------------- helpers

func _you() -> Object:
	return main._you


func _p() -> Vector2:
	return main._you.pos


func _hud() -> String:
	return main._label.text


func _hud_line(i: int) -> String:
	var lines: PackedStringArray = _hud().split("\n")
	return lines[i - 1] if lines.size() >= i else _hud()


func _check(name: String, ok: bool, detail: String) -> void:
	checks += 1
	if not ok:
		failures += 1
	print("CHECK %s %s: %s" % ["PASS" if ok else "FAIL", name, detail])


func _fmt(r: Dictionary) -> String:
	return "dx %.2f dz %.2f over %d ticks, max %.2f m/s, actions %s" % [r.dx, r.dz, r.ticks, r.max_speed, r.actions.keys().map(func(a: int) -> String: return ACTIONS[a])]


## Waits three process frames, so injected events have been flushed and dispatched (once per frame) and the HUD
## (updated in main._process) shows their effect.
func _settle() -> void:
	for i in 3:
		await process_frame


## Waits n rules ticks.
func _ticks(n: int) -> void:
	var t0: int = main._sim.tick
	while main._sim.tick - t0 < n:
		await physics_frame


## Waits n rules ticks and reports displacement, the top ground speed and the actions seen.
func _hold(n: int) -> Dictionary:
	var t0: int = main._sim.tick
	var p0 := _p()
	var r := {"max_speed": 0.0, "actions": {}}
	var last: int = t0
	while main._sim.tick - t0 < n:
		await physics_frame
		if main._sim.tick != last:
			last = main._sim.tick
			r.max_speed = maxf(r.max_speed, main._speed)
			r.actions[_you().action] = true
	var d := _p() - p0
	r.dx = d.x
	r.dz = d.y
	r.ticks = main._sim.tick - t0
	return r


## Waits (up to 40 ticks) for `action` to start, optionally screenshots it 8 ticks in, then waits for it to end.
## Reports {started, ticks (its length), dx, dz (displacement over it), facing (during it), seen}.
func _watch_action(action: int, shot: String) -> Dictionary:
	var t0: int = main._sim.tick
	var seen := {}
	while _you().action != action and main._sim.tick - t0 < 40:
		seen[ACTIONS[_you().action]] = true
		await physics_frame
	var r := {"started": _you().action == action, "ticks": 0, "dx": 0.0, "dz": 0.0, "facing": _you().facing, "seen": seen.keys()}
	if not r.started:
		return r
	var start: int = _you().action_start
	# The action's first tick already moved (a dodge moves on its start tick); measure from the tick before.
	var p0: Vector2 = _p() - (_you().vel / 60.0 if action == DODGE else Vector2.ZERO)
	var shot_done := shot == ""
	while _you().action == action and _you().action_start == start:
		if not shot_done and main._sim.tick - start >= 8:
			shot_done = true
			await _shot(shot)
		r.facing = _you().facing
		await physics_frame
	r.ticks = _you().action_start - start
	var d: Vector2 = _p() - p0
	# The tick that ended the action may already have moved again (walk resumes the same tick); remove it.
	if _you().action == WALK:
		d -= _you().vel / 60.0
	r.dx = d.x
	r.dz = d.y
	return r


func _shot(name: String) -> void:
	if out_dir == "" or name == "":
		return
	main._frozen = true
	for i in 3:
		await RenderingServer.frame_post_draw
	var path := out_dir.path_join(name)
	var err := root.get_texture().get_image().save_png(path)
	print("SHOT %s (%s) at %s, %s, facing %s | HUD: %s" % [path, error_string(err), _p(), ACTIONS[_you().action], _you().facing, _hud().replace("\n", " / ")])
	main._frozen = false


func _screen_of_you() -> Vector2:
	var cam: Camera3D = main._rig.get_node("Camera3D")
	var y: float = main._sim.store.height_at(_p().x, _p().y)
	return cam.unproject_position(Vector3(_p().x, y, _p().y))


func _key(k: Key, down: bool) -> void:
	var e := InputEventKey.new()
	e.keycode = k
	e.physical_keycode = k
	e.pressed = down
	Input.parse_input_event(e)


func _click(at: Vector2) -> void:
	for down in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.position = at
		e.global_position = at
		e.pressed = down
		Input.parse_input_event(e)


func _wheel(b: MouseButton) -> void:
	var at := _screen_of_you()
	for down in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = b
		e.position = at
		e.global_position = at
		e.pressed = down
		Input.parse_input_event(e)


func _axis(axis: JoyAxis, v: float) -> void:
	var e := InputEventJoypadMotion.new()
	e.device = 0
	e.axis = axis
	e.axis_value = v
	Input.parse_input_event(e)


func _button(b: JoyButton, down: bool) -> void:
	var e := InputEventJoypadButton.new()
	e.device = 0
	e.button_index = b
	e.pressed = down
	Input.parse_input_event(e)
