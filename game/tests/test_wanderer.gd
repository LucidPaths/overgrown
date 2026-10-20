extends RefCounted
## The G1 wanderer (ART-028): the contract between art/blender/wanderer.py (clip and bone names, cycle lengths)
## and OgWandererRig, which would otherwise break silently (a renamed clip or chain just stops animating).


func test_model_has_every_clip_and_chain(t: TestContext) -> void:
	var rig := OgWandererRig.new()
	t.check(rig.missing_parts().is_empty(), "wanderer.glb lacks %s (rebuild with art/blender/build.sh)" % str(rig.missing_parts()))
	t.check(rig.chain_count() >= 20, "expected the robe, cape, hair and scarf chains, found %d" % rig.chain_count())
	rig.free()


## The rig advances locomotion phase by distance / CYCLE_M; the clip lengths come from the Blender build. If they
## drift apart the feet slide.
func test_cycle_speeds_match_the_clips(t: TestContext) -> void:
	var player: AnimationPlayer = null
	var model: Node = OgWandererRig.MODEL.instantiate()
	player = model.find_children("*", "AnimationPlayer", true, false)[0]
	var speeds := {"walk": OgWandererRig.WALK_SPEED, "run": OgWandererRig.RUN_SPEED, "sprint": OgWandererRig.SPRINT_SPEED}
	for n in speeds:
		var natural: float = OgWandererRig.CYCLE_M[n] / player.get_animation(n).length
		t.check(absf(natural - speeds[n]) < 0.02 * speeds[n], "%s plays at %.3f m/s, the rig expects %.3f" % [n, natural, speeds[n]])
	t.check(absf(OgWandererRig.RUN_SPEED - OgRules.WALK_SPEED_M_S) < 1e-6, "the run clip is tuned for the rules walk speed")
	t.check(absf(OgWandererRig.SPRINT_SPEED - OgRules.WALK_SPEED_M_S * OgRules.SPRINT_MULTIPLIER) < 1e-6,
		"the sprint clip is tuned for the rules sprint speed")
	model.free()


## Every action, with the cloth stepping, leaves finite bone poses.
func test_rig_poses_stay_finite(t: TestContext) -> void:
	var rig := OgWandererRig.new()
	var states := [[0.0, OgWandererRig.Act.NONE], [5.0, OgWandererRig.Act.NONE], [8.0, OgWandererRig.Act.NONE],
		[0.0, OgWandererRig.Act.DODGE], [4.25, OgWandererRig.Act.ATTACK], [1.0, OgWandererRig.Act.NONE]]
	for st in states:
		rig.ground_speed = st[0]
		rig.move_local = Vector2(0.6, 0.8) if st[0] > 0.0 else Vector2.ZERO
		rig.body_velocity = Vector3(0, 0, -st[0])
		rig.action = st[1]
		for i in 30:
			rig.action_progress = i / 29.0
			rig.advance(1.0 / 60.0)
	var sk := rig.skeleton
	var bad := 0
	for b in sk.get_bone_count():
		var q := sk.get_bone_pose_rotation(b)
		if not (is_finite(q.x) and is_finite(q.y) and is_finite(q.z) and is_finite(q.w)):
			bad += 1
	t.check(bad == 0, "%d bones have non-finite rotations" % bad)
	# The bones can come out finite from a NaN cloth state, so check the particles too.
	var bad_p := 0
	for ch in rig._chains:
		for v in ch["p"] + ch["prev"]:
			if not (is_finite(v.x) and is_finite(v.y) and is_finite(v.z)):
				bad_p += 1
	t.check(bad_p == 0, "%d cloth particles are non-finite" % bad_p)
	rig.free()
