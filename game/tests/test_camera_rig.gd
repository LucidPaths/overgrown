extends RefCounted
## Camera terrain clearance (GOD-009): low on its orbit the camera runs close to the ground. It must never sit within
## OgCameraRig.CLEAR_GROUND_M of the terrain (camera_point lifts it), the arm must pull in before high ground and
## before terrain between the camera and the wanderer (arm_goal), and it must do so without popping (step_arm).

const TARGET := Vector3(10.0, 2.0, -5.0)
const ZOOMS := [OgCameraRig.ZOOM_MIN_M, OgCameraRig.PLAY_DISTANCE_M, OgCameraRig.ZOOM_MAX_M]
const YAWS_DEG := [0.0, 90.0, 225.0]
## High ground behind the target: a wall WALL_M behind it along the arm, WALL_HIGH_M high; a slope SLOPE_DEG steep.
const WALL_M := 6.0
const WALL_HIGH_M := 5.0
const SLOPE_DEG := 20.0
## A ridge across the arm, RIDGE_M behind the target, RIDGE_HIGH_M high and 1 m wide, low ground beyond it.
const RIDGE_M := 4.0
const RIDGE_HIGH_M := 2.4
## Camera positions are Vector3 (f32): a lifted camera can land one f32 step (~5e-7 m at these heights) under the
## exact margin.
const F32_EPS := 1e-5


static func lowest_offset(yaw_deg: float, zoom: float) -> Vector3:
	var p := OgCameraRig.PLAY_PITCH_MIN_DEG
	return OgCameraRig.camera_offset(deg_to_rad(yaw_deg), deg_to_rad(OgCameraRig.camera_pitch_deg(p)), zoom) + Vector3(0.0, OgCameraRig.camera_lift_m(p), 0.0)


func test_flat_ground_keeps_the_full_arm(t: TestContext) -> void:
	var flat := func(_x: float, _z: float) -> float: return TARGET.y
	for zoom: float in ZOOMS:
		for yaw_deg: float in YAWS_DEG:
			var offset := lowest_offset(yaw_deg, zoom)
			var k := OgCameraRig.step_arm(1.0, TARGET, offset, flat, 1.0, 1.0)
			var cam := OgCameraRig.camera_point(TARGET, offset, k, flat)
			t.check(k == 1.0, "zoom %.0f yaw %.0f: flat ground pulled the arm in to %.3f" % [zoom, yaw_deg, k])
			t.check(cam == TARGET + offset, "zoom %.0f yaw %.0f: flat ground moved the camera to %s" % [zoom, yaw_deg, cam - TARGET])


func test_high_ground_behind_pulls_the_arm_in_above_it(t: TestContext) -> void:
	for zoom: float in ZOOMS:
		for yaw_deg: float in YAWS_DEG:
			var offset := lowest_offset(yaw_deg, zoom)
			var behind := _behind(offset)
			var wall := func(x: float, z: float) -> float: return TARGET.y + (WALL_HIGH_M if behind.call(x, z) > WALL_M else 0.0)
			var slope := func(x: float, z: float) -> float: return TARGET.y + maxf(0.0, behind.call(x, z)) * tan(deg_to_rad(SLOPE_DEG))
			for g: Array in [["wall", wall], ["slope", slope]]:
				var ground: Callable = g[1]
				var what := "%s, zoom %.0f yaw %.0f" % [g[0], zoom, yaw_deg]
				# From the full arm (the hard margin must hold at once) and settled on the goal.
				for k: float in [1.0, OgCameraRig.step_arm(1.0, TARGET, offset, ground, 1.0, 1.0)]:
					var cam := OgCameraRig.camera_point(TARGET, offset, k, ground)
					var above: float = cam.y - ground.call(cam.x, cam.z)
					t.check(above >= OgCameraRig.CLEAR_GROUND_M - F32_EPS, "%s, k %.3f: camera only %.3f m above the ground" % [what, k, above])
					t.check(cam.y >= TARGET.y + OgCameraRig.CLEAR_TARGET_M - F32_EPS, "%s, k %.3f: camera %.3f m above the target" % [what, k, cam.y - TARGET.y])
				var goal := OgCameraRig.step_arm(1.0, TARGET, offset, ground, 1.0, 1.0)
				var arm := OgCameraRig.camera_point(TARGET, offset, goal, ground).distance_to(TARGET)
				t.check(arm < offset.length() - 1.0, "%s: arm %.2f m, posed %.2f m: not pulled in" % [what, arm, offset.length()])
				# Pulled in only as far as needed: a little further out is inside the cushion.
				var out := OgCameraRig.arm_point(TARGET, offset, minf(1.0, goal + 0.02))
				t.check(out.y < ground.call(out.x, out.z) + OgCameraRig.GOAL_GROUND_M, "%s: pulled in further than needed (k %.3f)" % [what, goal])


func test_terrain_between_camera_and_wanderer_pulls_the_arm_in(t: TestContext) -> void:
	for yaw_deg: float in YAWS_DEG:
		var offset := lowest_offset(yaw_deg, OgCameraRig.PLAY_DISTANCE_M)
		var behind := _behind(offset)
		var ridge := func(x: float, z: float) -> float: return TARGET.y + (RIDGE_HIGH_M if absf(behind.call(x, z) - RIDGE_M) < 0.5 else 0.0)
		var k := OgCameraRig.step_arm(1.0, TARGET, offset, ridge, 1.0, 1.0)
		var reach := Vector2(offset.x, offset.z).length() * k
		t.check(reach < RIDGE_M - 0.5, "yaw %.0f: the arm reaches %.2f m back, past the ridge at %.1f m" % [yaw_deg, reach, RIDGE_M])


## Walking sideways past a ridge running along the arm (it slides under the camera and out again) must not pop:
## the arm fraction changes by at most 0.1 per tick and the camera never dips into the hard margin.
func test_a_ridge_sliding_under_the_arm_does_not_pop(t: TestContext) -> void:
	var in_part := 1.0 - exp(-OgCameraRig.ARM_IN_RATE / 60.0)
	var out_part := 1.0 - exp(-OgCameraRig.ARM_OUT_RATE / 60.0)
	var offset := lowest_offset(0.0, OgCameraRig.PLAY_DISTANCE_M)
	var arm := 1.0
	var worst := 0.0
	var lowest := INF
	for i in 96:
		var target := Vector3(TARGET.x - 4.0 + i / 12.0, TARGET.y, TARGET.z)
		# A 4 m ridge along z at x = TARGET.x, starting 3 m behind the target.
		var ridge := func(x: float, z: float) -> float:
			return TARGET.y + 4.0 * maxf(0.0, 1.0 - absf(x - TARGET.x) / 0.6) * clampf(z - target.z - 3.0, 0.0, 1.0)
		var k := OgCameraRig.step_arm(arm, target, offset, ridge, in_part, out_part)
		worst = maxf(worst, absf(k - arm))
		arm = k
		var cam := OgCameraRig.camera_point(target, offset, k, ridge)
		lowest = minf(lowest, cam.y - ridge.call(cam.x, cam.z))
	t.check(worst <= 0.1, "the arm jumped by %.3f in one tick" % worst)
	t.check(lowest >= OgCameraRig.CLEAR_GROUND_M - F32_EPS, "the camera came within %.3f m of the ridge" % lowest)


## How far behind the target (along the arm, horizontally) a world point is.
static func _behind(offset: Vector3) -> Callable:
	var back := Vector2(offset.x, offset.z).normalized()
	return func(x: float, z: float) -> float: return (Vector2(x, z) - Vector2(TARGET.x, TARGET.z)).dot(back)
