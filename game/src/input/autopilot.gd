class_name OgAutopilot
extends RefCounted
## The scripted input for captures and the G0 E2E (`--autopilot`), by autopilot tick k (0 = the first tick
## after world ready). It is only a source of InputFrames: they go through the same OgInputLatch as a device.
##   0..119    walk east (2 s)
##   120..179  sprint east (1 s)
##   180       dodge east (21 ticks, 180..200)
##   195       attack pressed inside the dodge's buffer window, aimed east-south-east; starts at 201, rooted to 224
##   225..344  walk north (2 s)
##   345..     idle

const DODGE_AT := 180
const ATTACK_AT := 195
const NORTH_FROM := 225
const END := 345


static func frame(k: int) -> OgInputLatch.InputFrame:
	var f := OgInputLatch.InputFrame.new()
	if k < DODGE_AT:
		f.move = Vector2(1, 0)
		f.sprint = k >= 120
	elif k == DODGE_AT:
		f.move = Vector2(1, 0)
	elif k >= NORTH_FROM and k < END:
		f.move = Vector2(0, -1)
	if k >= ATTACK_AT and k < NORTH_FROM:
		f.aim = Vector2(3.0, 0.8)
	f.dodge_presses = 1 if k >= DODGE_AT else 0
	f.attack_presses = 1 if k >= ATTACK_AT else 0
	return f
