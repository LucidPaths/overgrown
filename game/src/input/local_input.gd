class_name OgLocalInput
extends Node
## Builds the InputFrame for the local player's character each physics tick, from keyboard and mouse or a
## gamepad. Reads devices only; the frame goes through the sim's OgInputLatch like any other input.
##
## Device in use: the most recently used one (any key, mouse motion or click, versus any gamepad button or a
## stick or trigger beyond STICK_DEADZONE). It decides which moves count and where the aim comes from:
##   keyboard and mouse: the move keys; aim = the point on the horizontal plane at the feet height under the
##                       cursor, minus the feet point;
##   gamepad:            the left stick; aim = the right stick direction * GAMEPAD_AIM_M (zero with the stick
##                       at rest, so facing follows movement).
## Presses are counted per input event (echoes ignored), so a tap shorter than a tick is never lost.

enum Device { KEYBOARD_MOUSE, GAMEPAD }

## Radial stick deadzone; the range beyond it is rescaled to 0..1 (tunable).
const STICK_DEADZONE := 0.2
## Gamepad aim length in metres at full right-stick deflection (tunable).
const GAMEPAD_AIM_M := 3.0
## Longest mouse aim in metres; a cursor at or above the horizon aims this far along the view (tunable).
const MOUSE_AIM_MAX_M := 100.0
const MOVE_ACTIONS: Array[StringName] = [&"move_left", &"move_right", &"move_up", &"move_down"]

## The camera the cursor and the screen-relative move directions are read through.
var camera: Camera3D
var device := Device.KEYBOARD_MOUSE

var _pad := 0
var _attack_presses := 0
var _dodge_presses := 0
var _axis_down := {} # action -> bool, for presses bound to a trigger axis


func _input(event: InputEvent) -> void:
	if event is InputEventKey or event is InputEventMouseButton or event is InputEventMouseMotion:
		device = Device.KEYBOARD_MOUSE
	elif (event is InputEventJoypadButton and event.pressed) or (event is InputEventJoypadMotion and absf(event.axis_value) > STICK_DEADZONE):
		device = Device.GAMEPAD
		_pad = event.device


func _unhandled_input(event: InputEvent) -> void:
	if _is_press(event, &"attack"):
		_attack_presses = (_attack_presses + 1) & OgWorld.U32_MAX
	if _is_press(event, &"dodge"):
		_dodge_presses = (_dodge_presses + 1) & OgWorld.U32_MAX


## True once per press of `action`. Key, mouse and button events report pressed once (echoes excluded); an axis
## event repeats while held, so only its crossing of the action's deadzone counts.
func _is_press(event: InputEvent, action: StringName) -> bool:
	if event is InputEventJoypadMotion:
		if not event.is_action(action):
			return false
		var down := event.is_action_pressed(action)
		var was: bool = _axis_down.get(action, false)
		_axis_down[action] = down
		return down and not was
	return event.is_action_pressed(action)


func device_name() -> String:
	return "gamepad" if device == Device.GAMEPAD else "keyboard + mouse"


## The frame for character c, whose feet are at height feet_y.
func frame(c: OgCharacter, feet_y: float) -> OgInputLatch.InputFrame:
	var f := OgInputLatch.InputFrame.new()
	var screen_move: Vector2
	if device == Device.GAMEPAD:
		screen_move = _stick(JOY_AXIS_LEFT_X, JOY_AXIS_LEFT_Y)
		var aim_dir := _to_world(_stick(JOY_AXIS_RIGHT_X, JOY_AXIS_RIGHT_Y))
		f.aim = aim_dir * GAMEPAD_AIM_M
	else:
		screen_move = _keys_move()
		f.aim = _mouse_aim(c, feet_y)
	var m := _to_world(screen_move).limit_length(1.0)
	f.move = Vector2(clampf(m.x, -1.0, 1.0), clampf(m.y, -1.0, 1.0))
	f.sprint = Input.is_action_pressed(&"sprint")
	f.attack_presses = _attack_presses
	f.dodge_presses = _dodge_presses
	return f


## Screen direction (x right, y down) to world (x, z) through the camera yaw. Fixed north-up in G0; a rotating
## camera only changes the basis read here.
func _to_world(screen: Vector2) -> Vector2:
	var b := camera.global_basis
	var right := Vector2(b.x.x, b.x.z).normalized()
	var back := Vector2(b.z.x, b.z.z).normalized()
	return right * screen.x + back * screen.y


## The move keys bound to the move actions (keys only, so a resting stick never mixes in), clamped to length 1.
func _keys_move() -> Vector2:
	var s := []
	for action in MOVE_ACTIONS:
		var down := 0.0
		for e in InputMap.action_get_events(action):
			if e is InputEventKey:
				var k := e as InputEventKey
				if Input.is_physical_key_pressed(k.physical_keycode) if k.physical_keycode != KEY_NONE else Input.is_key_pressed(k.keycode):
					down = 1.0
		s.append(down)
	return Vector2(s[1] - s[0], s[3] - s[2]).limit_length(1.0)


## Stick (x, y) with a radial deadzone, the rest rescaled to 0..1.
func _stick(ax: JoyAxis, ay: JoyAxis) -> Vector2:
	var v := Vector2(Input.get_joy_axis(_pad, ax), Input.get_joy_axis(_pad, ay))
	var len := v.length()
	if len <= STICK_DEADZONE:
		return Vector2.ZERO
	return v / len * minf((len - STICK_DEADZONE) / (1.0 - STICK_DEADZONE), 1.0)


func _mouse_aim(c: OgCharacter, feet_y: float) -> Vector2:
	var cursor := camera.get_viewport().get_mouse_position()
	var o := camera.project_ray_origin(cursor)
	var n := camera.project_ray_normal(cursor)
	if n.y > -0.01:
		# At or above the horizon: aim far along the ray's ground direction.
		return Vector2(n.x, n.z).normalized() * MOUSE_AIM_MAX_M
	var p := o + n * ((feet_y - o.y) / n.y)
	return (Vector2(p.x, p.z) - c.pos).limit_length(MOUSE_AIM_MAX_M)
