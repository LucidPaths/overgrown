extends RefCounted
## OgActionRules and OgMovement: ports the movement, action and sprint cases of sim/src/movement.test.ts and
## sim/src/actions.test.ts in metres and ticks (OgRules.TICK_HZ = 60).

const Ground := preload("res://tests/test_collision.gd").Ground
const EPS := 1e-4
const A := OgCharacter.Action

var _open := Ground.new([], 0, 0)


func _spawn(at := Vector2.ZERO) -> OgCharacter:
	return OgCharacter.new(at, 0)


## One rules tick without a latch: actions, then movement.
func _tick(chars: Array[OgCharacter], tick: int, ground: Object = _open) -> void:
	OgActionRules.step_actions(chars, tick)
	OgMovement.step_movement(chars, tick, ground)


func _near(a: Vector2, b: Vector2) -> bool:
	return a.distance_to(b) < EPS


func test_rules_tick_matches_physics_tick(t: TestContext) -> void:
	var hz: int = ProjectSettings.get_setting("physics/common/physics_ticks_per_second")
	t.check(hz == OgRules.TICK_HZ, "physics_ticks_per_second %d != OgRules.TICK_HZ %d" % [hz, OgRules.TICK_HZ])


func test_walks_5_m_per_s_on_an_axis_and_a_diagonal_and_keeps_sub_unit_magnitudes(t: TestContext) -> void:
	var axis := _spawn()
	var diagonal := _spawn()
	var half := _spawn()
	axis.intent.move = Vector2(1, 0)
	diagonal.intent.move = Vector2(-1, 1)
	half.intent.move = Vector2(0.5, 0)
	var chars: Array[OgCharacter] = [axis, diagonal, half]
	for tick in 60:
		_tick(chars, tick)
	t.check(_near(axis.pos, Vector2(5, 0)), "axis walk after 60 ticks at %s, want (5, 0)" % axis.pos)
	t.check(absf(diagonal.pos.length() - 5.0) < EPS, "diagonal walk went %.6f m, want 5" % diagonal.pos.length())
	t.check(_near(half.pos, Vector2(2.5, 0)), "half-stick walk at %s, want (2.5, 0)" % half.pos)
	t.check(axis.action == A.WALK, "walking action is %d, want WALK" % axis.action)


func test_sprint_is_walk_times_multiplier_and_nothing_when_still(t: TestContext) -> void:
	var axis := _spawn()
	var diagonal := _spawn()
	var still := _spawn()
	axis.intent.move = Vector2(1, 0)
	diagonal.intent.move = Vector2(-1, 1)
	for c in [axis, diagonal, still]:
		c.intent.buttons = OgCharacter.SPRINT
	var chars: Array[OgCharacter] = [axis, diagonal, still]
	for tick in 60:
		_tick(chars, tick)
	var want := OgRules.WALK_SPEED_M_S * OgRules.SPRINT_MULTIPLIER
	t.check(_near(axis.pos, Vector2(want, 0)), "axis sprint at %s, want (%.1f, 0)" % [axis.pos, want])
	t.check(absf(diagonal.pos.length() - want) < EPS, "diagonal sprint went %.6f m, want %.1f" % [diagonal.pos.length(), want])
	t.check(still.pos == Vector2.ZERO and still.action == A.IDLE, "sprint without moving: pos %s action %d" % [still.pos, still.action])


func test_facing_follows_velocity_holds_when_idle_and_snaps_to_aim_on_actions(t: TestContext) -> void:
	var c := _spawn()
	var chars: Array[OgCharacter] = [c]
	t.check(c.facing == Vector2(0, 1) and c.action == A.IDLE and c.action_start == 0, "spawn: facing %s action %d" % [c.facing, c.action])
	c.intent.move = Vector2(1, 0)
	_tick(chars, 1)
	t.check(c.facing == Vector2(1, 0) and c.action == A.WALK and c.action_start == 1, "east: facing %s action %d start %d" % [c.facing, c.action, c.action_start])
	c.intent.move = Vector2(1, 1)
	_tick(chars, 2)
	t.check(_near(c.facing, Vector2(1, 1).normalized()) and c.action_start == 1, "diagonal: facing %s (continuous, no snapping), start %d" % [c.facing, c.action_start])
	c.intent.move = Vector2(0, -0.3)
	_tick(chars, 3)
	t.check(c.facing == Vector2(0, -1), "north at a sub-unit stick: facing %s, want unit (0, -1)" % c.facing)
	c.intent.move = Vector2.ZERO
	_tick(chars, 4)
	t.check(c.facing == Vector2(0, -1) and c.action == A.IDLE and c.action_start == 4, "idle: facing %s action %d start %d" % [c.facing, c.action, c.action_start])
	# Attack with no aim keeps the facing; with an aim it snaps to it.
	c.intent.buttons = OgCharacter.ATTACK_PRESS
	_tick(chars, 5)
	t.check(c.action == A.ATTACK and c.facing == Vector2(0, -1), "attack without aim: action %d facing %s" % [c.action, c.facing])
	var d := _spawn()
	d.intent.aim = Vector2(-3, 4)
	d.intent.buttons = OgCharacter.ATTACK_PRESS
	_tick([d] as Array[OgCharacter], 0)
	t.check(_near(d.facing, Vector2(-0.6, 0.8)), "attack aimed at (-3, 4): facing %s, want (-0.6, 0.8)" % d.facing)


func test_attack_roots_then_walking_resumes(t: TestContext) -> void:
	var c := _spawn()
	var chars: Array[OgCharacter] = [c]
	c.intent.move = Vector2(1, 0)
	c.intent.aim = Vector2(0, -10)
	c.intent.buttons = OgCharacter.ATTACK_PRESS
	_tick(chars, 0)
	t.check(c.action == A.ATTACK and c.action_start == 0 and c.facing == Vector2(0, -1), "attack start: action %d start %d facing %s" % [c.action, c.action_start, c.facing])
	t.check(c.intent.buttons & OgCharacter.ATTACK_PRESS == 0, "the attack press was not consumed")
	for tick in range(1, OgRules.ATTACK_TICKS):
		_tick(chars, tick)
		if c.pos != Vector2.ZERO or c.action != A.ATTACK or c.vel != Vector2.ZERO:
			t.fail("tick %d: pos %s vel %s action %d, want rooted ATTACK" % [tick, c.pos, c.vel, c.action])
			return
	_tick(chars, OgRules.ATTACK_TICKS)
	t.check(c.action == A.WALK and c.action_start == OgRules.ATTACK_TICKS, "after the attack: action %d start %d, want WALK at %d" % [c.action, c.action_start, OgRules.ATTACK_TICKS])
	t.check(_near(c.pos, Vector2(OgRules.WALK_SPEED_M_S / OgRules.TICK_HZ, 0)) and c.facing == Vector2(1, 0), "after the attack: pos %s facing %s" % [c.pos, c.facing])


func test_dodge_rolls_along_move_else_aim_else_facing_and_ignores_intent_mid_roll(t: TestContext) -> void:
	var b := _spawn()
	var c := _spawn()
	var d := _spawn()
	var chars: Array[OgCharacter] = [b, c, d]
	# Tick 0: B and C start rolling; D walks one tick to face west.
	b.intent.move = Vector2(1, 0.5)
	b.intent.aim = Vector2(0, -10)
	b.intent.buttons = OgCharacter.DODGE_PRESS
	c.intent.aim = Vector2(20, 0) # differs from the spawn facing (south), so the aim fallback shows
	c.intent.buttons = OgCharacter.DODGE_PRESS
	d.intent.move = Vector2(-1, 0)
	_tick(chars, 0)
	t.check(b.action == A.DODGE and b.action_start == 0 and b.facing == Vector2(0, -1), "B: action %d facing %s, want DODGE facing the aim (0, -1)" % [b.action, b.facing])
	var d0 := d.pos
	t.check(d.facing == Vector2(-1, 0), "D faces %s, want west" % d.facing)
	# Tick 1: B's move intent changes mid-roll (ignored); D rolls with no move and no aim.
	b.intent.move = Vector2(-1, 0)
	d.intent.move = Vector2.ZERO
	d.intent.aim = Vector2.ZERO
	d.intent.buttons = OgCharacter.DODGE_PRESS
	for tick in range(1, OgRules.DODGE_TICKS):
		_tick(chars, tick)
	t.check(absf(b.pos.length() - OgRules.DODGE_DISTANCE_M) < EPS and absf(b.pos.y / b.pos.x - 0.5) < EPS, "B rolled to %s, want %.1f m along (1, 0.5)" % [b.pos, OgRules.DODGE_DISTANCE_M])
	t.check(_near(c.pos, Vector2(OgRules.DODGE_DISTANCE_M, 0)) and c.facing == Vector2(1, 0), "C rolled to %s facing %s, want along the aim" % [c.pos, c.facing])
	var b_end := b.pos
	_tick(chars, OgRules.DODGE_TICKS)
	t.check(b.action == A.WALK and b.action_start == OgRules.DODGE_TICKS and b.facing == Vector2(-1, 0), "B after the roll: action %d start %d facing %s" % [b.action, b.action_start, b.facing])
	t.check(_near(b.pos, b_end + Vector2(-OgRules.WALK_SPEED_M_S / OgRules.TICK_HZ, 0)), "B walked from %s to %s after the roll" % [b_end, b.pos])
	t.check(_near(d.pos, d0 + Vector2(-OgRules.DODGE_DISTANCE_M, 0)) and d.facing == Vector2(-1, 0), "D rolled to %s facing %s, want along its facing" % [d.pos, d.facing])


func test_shallow_water_slows_walk_sprint_and_dodge(t: TestContext) -> void:
	var shallow := Ground.new([], 0, 0, OgTile.SHALLOW_WATER)
	var f := OgWalkability.SHALLOW_WATER_SPEED
	var start := Vector2(0.5, 0.5)
	var walk := _spawn(start)
	walk.intent.move = Vector2(1, 0)
	_tick([walk] as Array[OgCharacter], 0, shallow)
	t.check(_near(walk.pos, start + Vector2(OgRules.WALK_SPEED_M_S * f / OgRules.TICK_HZ, 0)), "shallow walk tick: %s" % walk.pos)
	t.check(walk.vel == Vector2(OgRules.WALK_SPEED_M_S, 0), "stored velocity %s was scaled; want the requested one" % walk.vel)
	var sprint := _spawn(start)
	sprint.intent.move = Vector2(1, 0)
	sprint.intent.buttons = OgCharacter.SPRINT
	_tick([sprint] as Array[OgCharacter], 0, shallow)
	var sprint_m := OgRules.WALK_SPEED_M_S * OgRules.SPRINT_MULTIPLIER * f / OgRules.TICK_HZ
	t.check(_near(sprint.pos, start + Vector2(sprint_m, 0)), "shallow sprint tick: %s, want x %.6f" % [sprint.pos, start.x + sprint_m])
	var roll := _spawn(start)
	roll.intent.move = Vector2(1, 0)
	roll.intent.buttons = OgCharacter.DODGE_PRESS
	for tick in OgRules.DODGE_TICKS:
		_tick([roll] as Array[OgCharacter], tick, shallow)
	t.check(_near(roll.pos, start + Vector2(OgRules.DODGE_DISTANCE_M * f, 0)), "shallow dodge: %s, want x %.4f" % [roll.pos, start.x + OgRules.DODGE_DISTANCE_M * f])


func test_dodge_into_a_cliff_stops_flush_and_stays_dodge(t: TestContext) -> void:
	var wall := Ground.new(["#", "#", "#", "#", "#", "#"], 2, -3)
	var c := _spawn(Vector2(0.5, 0.5))
	c.intent.move = Vector2(1, 0)
	c.intent.buttons = OgCharacter.DODGE_PRESS
	for tick in OgRules.DODGE_TICKS:
		_tick([c] as Array[OgCharacter], tick, wall)
		if c.action != A.DODGE or c.action_start != 0:
			t.fail("tick %d: action %d start %d, want DODGE from 0" % [tick, c.action, c.action_start])
			return
	t.check(c.pos == Vector2(2.0 - OgRules.FOOT_HALF_M, 0.5), "dodge into the cliff ended at %s, want flush (%.4f, 0.5)" % [c.pos, 2.0 - OgRules.FOOT_HALF_M])


func test_buffer_keeps_a_late_press_and_drops_an_early_one(t: TestContext) -> void:
	var c := _spawn()
	var chars: Array[OgCharacter] = [c]
	c.intent.buttons = OgCharacter.ATTACK_PRESS
	_tick(chars, 0)
	t.check(c.action == A.ATTACK and c.action_start == 0, "attack did not start")
	var end := OgRules.ATTACK_TICKS
	# Tick 1 is outside the last BUFFER_TICKS: the press is dropped.
	t.check(end - 1 > OgRules.BUFFER_TICKS, "test setup: tick 1 must be outside the buffer window")
	c.intent.buttons |= OgCharacter.ATTACK_PRESS
	_tick(chars, 1)
	t.check(c.intent.buttons & OgCharacter.ATTACK_PRESS == 0, "an early press survived")
	for tick in range(2, end - OgRules.BUFFER_TICKS):
		_tick(chars, tick)
	# First tick of the window: the press is kept until the attack ends.
	c.intent.buttons |= OgCharacter.DODGE_PRESS
	for tick in range(end - OgRules.BUFFER_TICKS, end):
		_tick(chars, tick)
	t.check(c.intent.buttons & OgCharacter.DODGE_PRESS != 0 and c.action == A.ATTACK, "late press: buttons %d action %d" % [c.intent.buttons, c.action])
	_tick(chars, end)
	t.check(c.action == A.DODGE and c.action_start == end, "the buffered dodge did not start at %d: action %d start %d" % [end, c.action, c.action_start])
	# A press one tick before the window is dropped.
	c.intent.buttons |= OgCharacter.ATTACK_PRESS
	_tick(chars, end + OgRules.DODGE_TICKS - OgRules.BUFFER_TICKS - 1)
	t.check(c.intent.buttons & OgCharacter.ATTACK_PRESS == 0, "a press one tick before the window survived")


func test_non_finite_intent_is_reported_and_positions_stay_finite(t: TestContext) -> void:
	var errors: Array[String] = []
	OgRng.error_hook = func(msg: String) -> void: errors.append(msg)
	var walker := _spawn(Vector2(0.5, 0.5))
	walker.intent.move = Vector2(NAN, 1)
	var roller := _spawn(Vector2(0.5, 0.5))
	roller.intent.move = Vector2(INF, 0)
	roller.intent.aim = Vector2(NAN, NAN)
	roller.intent.buttons = OgCharacter.DODGE_PRESS
	var chars: Array[OgCharacter] = [walker, roller]
	for tick in 30:
		_tick(chars, tick)
	OgRng.error_hook = Callable()
	t.check(errors.size() >= 2, "expected the non-finite intents reported, got %s" % str(errors))
	for c in chars:
		t.check(is_finite(c.pos.x) and is_finite(c.pos.y) and is_finite(c.facing.x) and is_finite(c.facing.y), "non-finite state: pos %s facing %s" % [c.pos, c.facing])
	t.check(walker.pos == Vector2(0.5, 0.5) and walker.action == A.IDLE, "a NaN move moved the walker to %s" % walker.pos)
	# Move and aim are treated as zero, so the roll goes along the facing (south).
	t.check(_near(roller.pos, Vector2(0.5, 0.5 + OgRules.DODGE_DISTANCE_M)), "roller ended at %s, want a roll along its facing" % roller.pos)


## Ports sim.test.ts "dodge beats attack on the same tick": the dodge starts and the attack press is dropped.
func test_dodge_beats_attack_on_the_same_tick(t: TestContext) -> void:
	var c := _spawn()
	var chars: Array[OgCharacter] = [c]
	c.intent.move = Vector2(1, 0)
	c.intent.buttons = OgCharacter.ATTACK_PRESS | OgCharacter.DODGE_PRESS
	_tick(chars, 0)
	t.check(c.action == A.DODGE and c.action_start == 0, "both presses on one tick: action %d, want DODGE" % c.action)
	t.check(c.intent.buttons & OgCharacter.PRESSES == 0, "both presses on one tick: buttons %d, want both presses gone" % c.intent.buttons)
	for tick in range(1, OgRules.DODGE_TICKS + 2):
		_tick(chars, tick)
		if c.action == A.ATTACK:
			t.fail("tick %d: the dropped attack press started an attack" % tick)
			return


func test_a_non_dyadic_half_size_is_reported_and_replaced(t: TestContext) -> void:
	var errors: Array[String] = []
	OgRng.error_hook = func(msg: String) -> void: errors.append(msg)
	var bad := OgCharacter.new(Vector2.ZERO, 0, 0.3)
	var good := OgCharacter.new(Vector2.ZERO, 0, 0.25)
	OgRng.error_hook = Callable()
	t.check(errors.size() == 1 and errors[0].contains("half size"), "want one half-size report, got %s" % str(errors))
	t.check(bad.half_size == OgRules.FOOT_HALF_M, "half size 0.3 kept as %s, want FOOT_HALF_M" % bad.half_size)
	t.check(good.half_size == 0.25, "half size 0.25 became %s" % good.half_size)
