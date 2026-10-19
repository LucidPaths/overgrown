class_name OgMovement
extends RefCounted
## Turns every character's intent into velocity, position, facing and a WALK/IDLE action. One rule for
## players and NPCs alike. Ports sim/src/movement.ts in metres and ticks. Only + - * / and sqrt.
## The tile speed factor and the walls (OgCollision) act on displacement only; the stored velocity is the
## requested one.


## Moves `c` one tick along its stored velocity, scaled by the tile under it and stopped by blocked tiles.
static func _move(c: OgCharacter, ground: Object) -> void:
	var f := OgCollision.speed_factor_at(ground, c.pos)
	var d := Vector2(c.vel.x * f / OgRules.TICK_HZ, c.vel.y * f / OgRules.TICK_HZ)
	c.pos = OgCollision.slide_move(ground, c.pos, c.half_size, d)


## Applies every character's intent for rules tick `tick`. `ground` has tile_at(tx, ty) -> int.
static func step_movement(chars: Array[OgCharacter], tick: int, ground: Object) -> void:
	for c in chars:
		c.check_intent()
		if c.action == OgCharacter.Action.DODGE:
			# The roll keeps the velocity step_actions set; the move intent is ignored and facing is held.
			_move(c, ground)
			continue
		if c.action != OgCharacter.Action.IDLE and c.action != OgCharacter.Action.WALK:
			# ATTACK (later HURT, DEATH): rooted, facing held.
			c.vel = Vector2.ZERO
			continue

		var mx := c.intent.move.x
		var mz := c.intent.move.y
		var len2 := mx * mx + mz * mz
		var speed := OgRules.WALK_SPEED_M_S
		if c.intent.buttons & OgCharacter.SPRINT:
			speed = OgRules.WALK_SPEED_M_S * OgRules.SPRINT_MULTIPLIER
		var scale := speed / sqrt(len2) if len2 > 1.0 else speed
		c.vel = Vector2(mx * scale, mz * scale)
		_move(c, ground)

		# Facing follows the velocity and holds when idle.
		c.facing = OgCharacter.unit_or(c.vel.x, c.vel.y, c.facing)
		var next := OgCharacter.Action.WALK if c.vel != Vector2.ZERO else OgCharacter.Action.IDLE
		if c.action != next:
			c.action = next
			c.action_start = tick
