extends RefCounted


func test_version_is_semver(t: TestContext) -> void:
	var re := RegEx.create_from_string("^\\d+\\.\\d+\\.\\d+$")
	t.check(re.search(GameVersion.VERSION) != null, "GameVersion.VERSION '%s' is not MAJOR.MINOR.PATCH" % GameVersion.VERSION)


func test_main_scene_has_tilted_camera(t: TestContext) -> void:
	var packed := load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		t.fail("res://scenes/main.tscn does not load")
		return
	var root := packed.instantiate()
	var cameras := root.find_children("*", "Camera3D", true, false)
	if cameras.size() != 1:
		t.fail("expected one Camera3D, found %d" % cameras.size())
	else:
		var pitch := absf((cameras[0] as Camera3D).rotation_degrees.x)
		# PLAN D4 / GOD-005: the play view looks down about 30 deg minus a small raise, so the sky shows at the top.
		t.check(pitch >= 20.0 and pitch <= 35.0, "camera pitch %.1f deg is outside 20..35" % pitch)
	root.free()
