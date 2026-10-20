class_name OgActions
extends RefCounted
## The game's InputMap actions, registered in code. ensure() is idempotent: it adds only missing actions
## and events, so calling it again (or after the user remapped) changes nothing.
##
## Bindings (keys are physical positions; gamepad buttons by position, Xbox labels):
##   move_left/right/up/down  A D W S, the arrows, the left stick (OgLocalInput reads the stick directly with a
##                            radial deadzone; the stick events here keep the actions complete for remapping)
##   sprint (held)            Shift, left stick click, LB
##   dodge (press)            Space, B (east)
##   attack (press)           left mouse button, X (west), RT
##   camera_vista (held)      V, Y (north)
##   camera_zoom_in/out       mouse wheel
##   camera_orbit (held)      right mouse button: drag to turn the camera yaw and pitch (OgCameraRig); the cursor
##                            stays visible and the mouse aim holds while it is held (OgLocalInput)
##   camera_left/right (held) Q / E, D-pad left / right: turn the camera yaw at a steady rate
## Aim is not an action: the cursor (keyboard and mouse) or the right stick (gamepad), in OgLocalInput.

## How far RT must be pulled to count as an attack press.
const TRIGGER_DEADZONE := 0.5


static func ensure() -> void:
	_action("move_left", [_key(KEY_A), _key(KEY_LEFT), _axis(JOY_AXIS_LEFT_X, -1.0)])
	_action("move_right", [_key(KEY_D), _key(KEY_RIGHT), _axis(JOY_AXIS_LEFT_X, 1.0)])
	_action("move_up", [_key(KEY_W), _key(KEY_UP), _axis(JOY_AXIS_LEFT_Y, -1.0)])
	_action("move_down", [_key(KEY_S), _key(KEY_DOWN), _axis(JOY_AXIS_LEFT_Y, 1.0)])
	_action("camera_vista", [_key(KEY_V), _button(JOY_BUTTON_Y)])
	_action("camera_zoom_in", [_mouse(MOUSE_BUTTON_WHEEL_UP)])
	_action("camera_zoom_out", [_mouse(MOUSE_BUTTON_WHEEL_DOWN)])
	_action("camera_orbit", [_mouse(MOUSE_BUTTON_RIGHT)])
	_action("camera_left", [_key(KEY_Q), _button(JOY_BUTTON_DPAD_LEFT)])
	_action("camera_right", [_key(KEY_E), _button(JOY_BUTTON_DPAD_RIGHT)])
	_action("sprint", [_key(KEY_SHIFT), _button(JOY_BUTTON_LEFT_STICK), _button(JOY_BUTTON_LEFT_SHOULDER)])
	_action("dodge", [_key(KEY_SPACE), _button(JOY_BUTTON_B)])
	_action("attack", [_mouse(MOUSE_BUTTON_LEFT), _button(JOY_BUTTON_X), _axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)], TRIGGER_DEADZONE)


static func _action(action: StringName, events: Array[InputEvent], deadzone := 0.2) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, deadzone)
	for e in events:
		if not InputMap.action_has_event(action, e):
			InputMap.action_add_event(action, e)


## Physical key: the same position on every keyboard layout (WASD stays WASD on AZERTY).
static func _key(code: Key) -> InputEvent:
	var e := InputEventKey.new()
	e.physical_keycode = code
	return e


static func _axis(axis: JoyAxis, value: float) -> InputEvent:
	var e := InputEventJoypadMotion.new()
	e.axis = axis
	e.axis_value = value
	return e


static func _button(button: JoyButton) -> InputEvent:
	var e := InputEventJoypadButton.new()
	e.button_index = button
	return e


static func _mouse(button: MouseButton) -> InputEvent:
	var e := InputEventMouseButton.new()
	e.button_index = button
	return e
