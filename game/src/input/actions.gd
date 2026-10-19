class_name OgActions
extends RefCounted
## The game's InputMap actions, registered in code. ensure() is idempotent: it adds only missing actions
## and events, so calling it again (or after the user remapped) changes nothing. GOD-006 extends this file.


static func ensure() -> void:
	_action("move_left", [_key(KEY_A), _key(KEY_LEFT), _axis(JOY_AXIS_LEFT_X, -1.0)])
	_action("move_right", [_key(KEY_D), _key(KEY_RIGHT), _axis(JOY_AXIS_LEFT_X, 1.0)])
	_action("move_up", [_key(KEY_W), _key(KEY_UP), _axis(JOY_AXIS_LEFT_Y, -1.0)])
	_action("move_down", [_key(KEY_S), _key(KEY_DOWN), _axis(JOY_AXIS_LEFT_Y, 1.0)])
	_action("camera_vista", [_key(KEY_V), _button(JOY_BUTTON_Y)])
	_action("camera_zoom_in", [_mouse(MOUSE_BUTTON_WHEEL_UP)])
	_action("camera_zoom_out", [_mouse(MOUSE_BUTTON_WHEEL_DOWN)])


static func _action(action: StringName, events: Array[InputEvent]) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
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
