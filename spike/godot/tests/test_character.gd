# Headless asset test: godot --headless --path spike/godot --script res://tests/test_character.gd
# Exit code 0 = all checks passed, 1 = at least one failed.
extends SceneTree

var failures := 0


func check(cond: bool, what: String) -> void:
	if cond:
		print("PASS ", what)
	else:
		failures += 1
		printerr("FAIL ", what)


func _init() -> void:
	var scene: PackedScene = load("res://assets/character.glb")
	check(scene != null, "character.glb loads as PackedScene")
	if scene == null:
		quit(1)
		return
	var root := scene.instantiate()
	var players := root.find_children("*", "AnimationPlayer", true, false)
	check(players.size() == 1, "one AnimationPlayer (got %d)" % players.size())
	var skels := root.find_children("*", "Skeleton3D", true, false)
	check(skels.size() == 1, "one Skeleton3D (got %d)" % skels.size())
	if skels.size() == 1:
		check(skels[0].get_bone_count() == 20, "20 bones (got %d)" % skels[0].get_bone_count())
	var meshes := root.find_children("*", "MeshInstance3D", true, false)
	check(meshes.size() == 9, "9 skinned meshes (got %d)" % meshes.size())
	if players.size() == 1:
		var ap: AnimationPlayer = players[0]
		for a in ["walk", "idle"]:
			check(ap.has_animation(a), "animation '%s' present (have %s)" % [a, ap.get_animation_list()])
		if ap.has_animation("walk"):
			var len := ap.get_animation("walk").length
			check(absf(len - 1.0) < 0.001, "walk is ~1.0 s (got %.3f)" % len)
	var forced := OS.get_cmdline_user_args().has("--force-fail")
	check(not forced, "not forced to fail (--force-fail proves the exit code)")
	root.free()
	print("RESULT failures=%d" % failures)
	quit(1 if failures > 0 else 0)
