class_name OgActionRules
extends RefCounted
## Starts, ends and buffers the attack and dodge actions from every character's intent. One rule for players
## and NPCs alike. Ports sim/src/actions.ts in metres and ticks. Only + - * / and sqrt.
## (Named OgActionRules because OgActions is taken by the bindings file, game/src/input/actions.gd.)


## Ticks an action lasts; 0 for actions that don't end on their own here (IDLE, WALK; later HURT, DEATH).
static func duration_of(action: OgCharacter.Action) -> int:
	match action:
		OgCharacter.Action.ATTACK:
			return OgRules.ATTACK_TICKS
		OgCharacter.Action.DODGE:
			return OgRules.DODGE_TICKS
	return 0


static func _free(action: OgCharacter.Action) -> bool:
	return action == OgCharacter.Action.IDLE or action == OgCharacter.Action.WALK


## Starts, ends and buffers attack and dodge for every character, for rules tick `tick`.
static func step_actions(chars: Array[OgCharacter], tick: int) -> void:
	for c in chars:
		c.check_intent()
		# 1. End. An action started at s lasts ticks s .. s + D - 1.
		var duration := duration_of(c.action)
		if duration > 0 and tick - c.action_start >= duration:
			c.action = OgCharacter.Action.IDLE
			c.action_start = tick

		# 2. Start, only from IDLE or WALK. Dodge wins over attack.
		if _free(c.action):
			var aim := c.intent.aim
			if c.intent.buttons & OgCharacter.DODGE_PRESS:
				# Roll along the move direction, else the aim, else the facing.
				var move := c.intent.move
				var dir := OgCharacter.unit_or(move.x, move.y, OgCharacter.unit_or(aim.x, aim.y, c.facing))
				# OQ-025: facing snaps to the aim, independent of the roll direction.
				c.facing = OgCharacter.unit_or(aim.x, aim.y, c.facing)
				c.vel = Vector2(dir.x * OgRules.DODGE_SPEED_M_S, dir.y * OgRules.DODGE_SPEED_M_S)
				c.action = OgCharacter.Action.DODGE
				c.action_start = tick
				c.intent.buttons &= ~OgCharacter.DODGE_PRESS
			elif c.intent.buttons & OgCharacter.ATTACK_PRESS:
				c.facing = OgCharacter.unit_or(aim.x, aim.y, c.facing)
				c.action = OgCharacter.Action.ATTACK
				c.action_start = tick
				c.intent.buttons &= ~OgCharacter.ATTACK_PRESS

		# 3. Buffer. A press made in the last BUFFER_TICKS of an action survives to start the next one when it
		# ends; earlier presses (and presses in any other busy action) are dropped.
		if not _free(c.action):
			var busy := duration_of(c.action)
			var keep := busy > 0 and c.action_start + busy - tick <= OgRules.BUFFER_TICKS
			if not keep:
				c.intent.buttons &= ~OgCharacter.PRESSES
