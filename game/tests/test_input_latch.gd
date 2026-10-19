extends RefCounted
## OgInputLatch: ports the input cases of sim/src/sim.test.ts (validation, press counters).

const InputFrame := OgInputLatch.InputFrame


func _frame(move := Vector2.ZERO, attack := 0, dodge := 0, sprint := false) -> InputFrame:
	var f := InputFrame.new()
	f.move = move
	f.sprint = sprint
	f.attack_presses = attack
	f.dodge_presses = dodge
	return f


func test_rejects_invalid_frames_naming_the_field(t: TestContext) -> void:
	var cases := [
		["move.x", func(f: InputFrame) -> void: f.move = Vector2(NAN, 0)],
		["move.x", func(f: InputFrame) -> void: f.move = Vector2(1.5, 0)],
		["move.y", func(f: InputFrame) -> void: f.move = Vector2(0, -1.01)],
		["aim.y", func(f: InputFrame) -> void: f.aim = Vector2(0, INF)],
		["aim.x", func(f: InputFrame) -> void: f.aim = Vector2(-1e9, 0)],
		["attack_presses", func(f: InputFrame) -> void: f.attack_presses = -1],
		["dodge_presses", func(f: InputFrame) -> void: f.dodge_presses = 0x100000000],
	]
	var latch := OgInputLatch.new()
	var good := _frame(Vector2(1, 0))
	t.check(latch.submit(good), "a valid frame was rejected: %s" % OgInputLatch.validate(good))
	for c: Array in cases:
		var f := _frame()
		(c[1] as Callable).call(f)
		var errors: Array[String] = []
		OgRng.error_hook = func(msg: String) -> void: errors.append(msg)
		var accepted := latch.submit(f)
		OgRng.error_hook = Callable()
		t.check(not accepted, "%s: an invalid frame was accepted" % c[0])
		t.check(errors.size() == 1 and errors[0].contains(c[0]), "%s: reported %s" % [c[0], str(errors)])
	t.check(latch.latest.move == Vector2(1, 0), "a rejected frame replaced the last valid one")


func test_a_changed_counter_is_one_press_and_an_unchanged_one_none(t: TestContext) -> void:
	var latch := OgInputLatch.new()
	var c := OgCharacter.new(Vector2.ZERO, 0)
	latch.latch(c)
	t.check(c.intent.buttons == 0, "latched something before the first frame")
	# Three presses between two ticks are one press bit.
	latch.submit(_frame(Vector2.ZERO, 3, 0, true))
	latch.latch(c)
	t.check(c.intent.buttons == OgCharacter.SPRINT | OgCharacter.ATTACK_PRESS, "buttons %d, want SPRINT | ATTACK_PRESS" % c.intent.buttons)
	# Re-latching the same counters adds no press (a pending one is kept for the buffer).
	c.intent.buttons = 0
	latch.latch(c)
	t.check(c.intent.buttons == OgCharacter.SPRINT, "an unchanged counter pressed again: buttons %d" % c.intent.buttons)
	c.intent.buttons = OgCharacter.ATTACK_PRESS
	latch.latch(c)
	t.check(c.intent.buttons == OgCharacter.SPRINT | OgCharacter.ATTACK_PRESS, "a pending press was dropped by the latch: buttons %d" % c.intent.buttons)
	latch.submit(_frame(Vector2.ZERO, 3, 1))
	c.intent.buttons = 0
	latch.latch(c)
	t.check(c.intent.buttons == OgCharacter.DODGE_PRESS, "dodge counter change: buttons %d, want DODGE_PRESS" % c.intent.buttons)


func test_u32_wraparound_counts_as_a_change(t: TestContext) -> void:
	var latch := OgInputLatch.new()
	var c := OgCharacter.new(Vector2.ZERO, 0)
	latch.submit(_frame(Vector2.ZERO, OgWorld.U32_MAX, OgWorld.U32_MAX))
	latch.latch(c)
	c.intent.buttons = 0
	latch.submit(_frame(Vector2.ZERO, 0, 0))
	latch.latch(c)
	t.check(c.intent.buttons == OgCharacter.ATTACK_PRESS | OgCharacter.DODGE_PRESS, "wrap 4294967295 -> 0: buttons %d, want both presses" % c.intent.buttons)


func test_a_submitted_frame_is_copied(t: TestContext) -> void:
	var latch := OgInputLatch.new()
	var f := _frame(Vector2(1, 0))
	latch.submit(f)
	f.move = Vector2(-1, 0)
	t.check(latch.latest.move == Vector2(1, 0), "changing a frame after submit changed the latched one")
