class_name OgCharacter
extends RefCounted
## The one character shape, for players and NPCs alike. Plain data: the rules (OgActions, OgMovement) write
## it, views only read it. Ports sim/src/character.ts in metres.
## Units: the rules plane is (x, z) held in a Vector2(x, z); y is presentation only.

enum Action { IDLE, WALK, ATTACK, DODGE }

## Intent.buttons bits. SPRINT mirrors what is held now. The *_PRESS bits are one-tick edges: set by whoever
## writes the intent (OgInputLatch, later an NPC brain), consumed or dropped by OgActions.step_actions.
const SPRINT := 1
const ATTACK_PRESS := 2
const DODGE_PRESS := 4
const PRESSES := ATTACK_PRESS | DODGE_PRESS


## What the character wants to do this tick.
class Intent:
	extends RefCounted
	## Desired move direction, magnitude 0..1 (movement clamps larger values to 1).
	var move := Vector2.ZERO
	## Aim offset from the character in metres; zero = no aim.
	var aim := Vector2.ZERO
	## SPRINT | ATTACK_PRESS | DODGE_PRESS bits.
	var buttons := 0


## The feet point, world metres (x, z).
var pos := Vector2.ZERO
## Requested velocity in m/s (before the tile speed factor and walls, which act on displacement only).
var vel := Vector2.ZERO
## Unit facing direction (x, z), continuous. Starts south, toward the camera.
var facing := Vector2(0.0, 1.0)
var action := Action.IDLE
## The tick the current action started.
var action_start := 0
## Foot box half-size in metres.
var half_size := OgRules.FOOT_HALF_M
var intent := Intent.new()


func _init(at: Vector2, tick: int) -> void:
	if not (is_finite(at.x) and is_finite(at.y)):
		OgWorld.report("OgCharacter: position must be finite, got %s" % str(at))
	pos = at
	action_start = tick


## Reports a non-finite intent move or aim and replaces it with zero, so it never reaches a position.
## Every rule step calls this before it reads the intent.
func check_intent() -> void:
	if not (is_finite(intent.move.x) and is_finite(intent.move.y)):
		OgWorld.report("OgCharacter: non-finite move intent %s, treated as zero" % str(intent.move))
		intent.move = Vector2.ZERO
	if not (is_finite(intent.aim.x) and is_finite(intent.aim.y)):
		OgWorld.report("OgCharacter: non-finite aim intent %s, treated as zero" % str(intent.aim))
		intent.aim = Vector2.ZERO


## The unit vector of (x, z), or `fallback` when it is zero. Only + - * / and sqrt.
static func unit_or(x: float, z: float, fallback: Vector2) -> Vector2:
	var len2 := x * x + z * z
	if len2 == 0.0:
		return fallback
	var len := sqrt(len2)
	return Vector2(x / len, z / len)
