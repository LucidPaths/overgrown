extends RefCounted
## One rule set: a latched (player) character and a directly driven (NPC-style) character with the same intent
## go through the exact same OgSim step; the rules files never touch input, nodes or the scene tree.

const TICKS := 120
const RULES_DIR := "res://src/rules"


## The intent for tick k: a sub-unit move (so any speed bonus shows), sprint after 30, attack at 40, dodge at 70.
func _script(k: int) -> Dictionary:
	return {
		"move": Vector2(0.6, -0.3) if k < 90 else Vector2(-0.2, 0.5),
		"aim": Vector2(2.0, 1.0),
		"sprint": k >= 30,
		"attack": 1 if k >= 40 else 0,
		"dodge": 1 if k >= 70 else 0,
	}


func test_latched_and_direct_characters_move_identically(t: TestContext) -> void:
	var sim := OgSim.create(1)
	if sim == null:
		t.fail("OgSim.create(1) failed")
		return
	var player := sim.add_character(sim.spawn)
	var npc := sim.add_character(sim.spawn)
	var latch := sim.drive(player)
	var actions := {}
	for k in TICKS:
		var s := _script(k)
		var f := OgInputLatch.InputFrame.new()
		f.move = s["move"]
		f.aim = s["aim"]
		f.sprint = s["sprint"]
		f.attack_presses = s["attack"]
		f.dodge_presses = s["dodge"]
		latch.submit(f)
		# The NPC brain writes the intent the way the latch does: held bits replaced, presses as one-tick edges.
		var prev := _script(k - 1) if k > 0 else {"attack": 0, "dodge": 0}
		npc.intent.move = s["move"]
		npc.intent.aim = s["aim"]
		var presses := npc.intent.buttons & OgCharacter.PRESSES
		if s["attack"] != prev["attack"]:
			presses |= OgCharacter.ATTACK_PRESS
		if s["dodge"] != prev["dodge"]:
			presses |= OgCharacter.DODGE_PRESS
		npc.intent.buttons = (OgCharacter.SPRINT if s["sprint"] else 0) | presses
		sim.step()
		actions[player.action] = true
		if player.pos != npc.pos or player.facing != npc.facing or player.action != npc.action or player.action_start != npc.action_start:
			t.fail("tick %d: player %s %s action %d@%d, npc %s %s action %d@%d" % [k, player.pos, player.facing, player.action, player.action_start, npc.pos, npc.facing, npc.action, npc.action_start])
			return
	t.check(player.pos.distance_to(sim.spawn) > 2.0, "the characters barely moved (%s from spawn %s)" % [player.pos, sim.spawn])
	for a: OgCharacter.Action in [OgCharacter.Action.WALK, OgCharacter.Action.ATTACK, OgCharacter.Action.DODGE]:
		t.check(actions.has(a), "the script never reached action %d" % a)
	t.check(sim.tick == TICKS, "sim.tick %d after %d steps" % [sim.tick, TICKS])


func test_rules_files_never_reference_input_nodes_or_the_tree(t: TestContext) -> void:
	var scripts := 0
	var banned := RegEx.create_from_string("\\b(Input|Node|get_tree|InputMap)\\b")
	for f in _scripts_under(RULES_DIR):
		scripts += 1
		var text := FileAccess.get_file_as_string(f)
		var lines := text.split("\n")
		for i in lines.size():
			var m := banned.search(lines[i])
			if m != null:
				t.fail("%s:%d references %s: %s" % [f, i + 1, m.get_string(1), lines[i].strip_edges()])
	t.check(scripts >= 7, "found only %d scripts in %s" % [scripts, RULES_DIR])


## Every .gd file under dir, subfolders included.
func _scripts_under(dir: String) -> Array[String]:
	var out: Array[String] = []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".gd"):
			out.append("%s/%s" % [dir, f])
	for d in DirAccess.get_directories_at(dir):
		out.append_array(_scripts_under("%s/%s" % [dir, d]))
	return out
