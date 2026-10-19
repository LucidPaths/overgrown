class_name OgAutopilot
extends RefCounted
## The scripted input for captures and the G0 E2E (`--autopilot`), by autopilot tick k (0 = the first tick
## after world ready). It is only a source of InputFrames: they go through the same OgInputLatch as a device.
##   0..119    walk east (2 s)
##   120..179  sprint east (1 s)
##   180       dodge east (21 ticks, 180..200)
##   195       attack pressed inside the dodge's buffer window, aimed east-south-east until 224; starts at 201
##             and swings to 224 while walking north (OQ-039)
##   195..344  walk north (2.5 s; the dodge ignores the move until it ends at 200)
##   345..     idle

const DODGE_AT := 180
const ATTACK_AT := 195
const AIM_UNTIL := 225
const END := 345


static func frame(k: int) -> OgInputLatch.InputFrame:
	var f := OgInputLatch.InputFrame.new()
	if k < DODGE_AT:
		f.move = Vector2(1, 0)
		f.sprint = k >= 120
	elif k == DODGE_AT:
		f.move = Vector2(1, 0)
	elif k >= ATTACK_AT and k < END:
		f.move = Vector2(0, -1)
	if k >= ATTACK_AT and k < AIM_UNTIL:
		f.aim = Vector2(3.0, 0.8)
	f.dodge_presses = 1 if k >= DODGE_AT else 0
	f.attack_presses = 1 if k >= ATTACK_AT else 0
	return f
