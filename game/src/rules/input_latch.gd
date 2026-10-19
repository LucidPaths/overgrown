class_name OgInputLatch
extends RefCounted
## The host's input latch for one driven character. Ports sim/src/input.ts: frames are validated on submit,
## the newest one is latched into the character's intent at tick start, and a changed press counter sets its
## press bit once. Keyboard and mouse, gamepad, the autopilot and (G3) a remote peer all arrive as InputFrames.

## Aim bound in metres, far beyond any screen; keeps aim * aim finite.
const MAX_AIM_M := 16777216.0 # 2^24


## One input sample: held move, aim and sprint, plus u32 press counters (a changed counter = one press, so a
## tap between two ticks is never lost). A plain value type; the G3 network input message carries this shape.
class InputFrame:
	extends RefCounted
	## Move direction, each axis in [-1, 1] (movement clamps the length to 1).
	var move := Vector2.ZERO
	## Aim offset from the character in metres; zero = no aim.
	var aim := Vector2.ZERO
	var sprint := false
	## u32 counters, wrapping at 2^32.
	var attack_presses := 0
	var dodge_presses := 0

	func copy() -> InputFrame:
		var f := InputFrame.new()
		f.move = move
		f.aim = aim
		f.sprint = sprint
		f.attack_presses = attack_presses
		f.dodge_presses = dodge_presses
		return f


## The newest valid frame, or null before the first.
var latest: InputFrame = null
## The counters last latched. 0 matches every input source's starting counters.
var attack_seen := 0
var dodge_seen := 0


## "" if f is valid, else a message naming the first invalid field and its value.
static func validate(f: InputFrame) -> String:
	for axis: Array in [["move.x", f.move.x], ["move.y", f.move.y]]:
		if not is_finite(axis[1]) or absf(axis[1]) > 1.0:
			return "input: %s must be a finite number in [-1, 1], got %s" % axis
	for axis: Array in [["aim.x", f.aim.x], ["aim.y", f.aim.y]]:
		if not is_finite(axis[1]) or absf(axis[1]) > MAX_AIM_M:
			return "input: %s must be a finite number with |value| <= %.0f, got %s" % [axis[0], MAX_AIM_M, axis[1]]
	for counter: Array in [["attack_presses", f.attack_presses], ["dodge_presses", f.dodge_presses]]:
		if counter[1] < 0 or counter[1] > OgWorld.U32_MAX:
			return "input: %s must be an integer in 0..4294967295, got %d" % counter
	return ""


## Validates f and keeps a copy as the newest frame (the next latch applies it). An invalid frame is reported
## and dropped, and false is returned; the previous frame stays.
func submit(f: InputFrame) -> bool:
	var err := validate(f)
	if err != "":
		OgWorld.report(err)
		return false
	latest = f.copy()
	return true


## Tick start: writes the newest frame into c's intent. No-op until the first frame.
func latch(c: OgCharacter) -> void:
	if latest == null:
		return
	c.intent.move = latest.move
	c.intent.aim = latest.aim
	# Pending press bits are kept: that is the buffer step_actions relies on.
	var pending := c.intent.buttons & OgCharacter.PRESSES
	var presses := 0
	if latest.attack_presses != attack_seen:
		presses |= OgCharacter.ATTACK_PRESS
	if latest.dodge_presses != dodge_seen:
		presses |= OgCharacter.DODGE_PRESS
	c.intent.buttons = (OgCharacter.SPRINT if latest.sprint else 0) | pending | presses
	attack_seen = latest.attack_presses
	dodge_seen = latest.dodge_presses
