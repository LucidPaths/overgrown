extends RefCounted
## Camera terrain clearance (GOD-009): at the lowest pitch the camera arm runs close to the ground, so
## OgCameraRig.clear_arm pulls it in wherever the posed camera would sit within CLEAR_GROUND_M of the terrain.

const TARGET := Vector3(10.0, 2.0, -5.0)
const ZOOMS := [OgCameraRig.ZOOM_MIN_M, OgCameraRig.PLAY_DISTANCE_M, OgCameraRig.ZOOM_MAX_M]
const YAWS_DEG := [0.0, 90.0, 225.0]
## High ground behind the target: a wall WALL_M behind it along the arm, WALL_HIGH_M high; a slope SLOPE_DEG steep.
const WALL_M := 6.0
const WALL_HIGH_M := 5.0
const SLOPE_DEG := 20.0


func test_flat_ground_keeps_the_full_arm(t: TestContext) -> void:
	var flat := func(_x: float, _z: float) -> float: return TARGET.y
	for zoom: float in ZOOMS:
		for yaw_deg: float in YAWS_DEG:
			var offset := OgCameraRig.camera_offset(deg_to_rad(yaw_deg), deg_to_rad(OgCameraRig.PLAY_PITCH_MIN_DEG), zoom)
			var k := OgCameraRig.clear_arm(TARGET, offset, flat)
			var cam := OgCameraRig.arm_point(TARGET, offset, k)
			t.check(k == 1.0, "zoom %.0f yaw %.0f: flat ground pulled the arm in to %.3f" % [zoom, yaw_deg, k])
			t.check(cam.y - TARGET.y >= OgCameraRig.CLEAR_GROUND_M, "zoom %.0f yaw %.0f: camera %.3f m above flat ground" % [zoom, yaw_deg, cam.y - TARGET.y])


func test_high_ground_behind_pulls_the_arm_in_above_it(t: TestContext) -> void:
	for zoom: float in ZOOMS:
		for yaw_deg: float in YAWS_DEG:
			var yaw := deg_to_rad(yaw_deg)
			var offset := OgCameraRig.camera_offset(yaw, deg_to_rad(OgCameraRig.PLAY_PITCH_MIN_DEG), zoom)
			var back := Vector2(offset.x, offset.z).normalized()
			var behind := func(x: float, z: float) -> float: return (Vector2(x, z) - Vector2(TARGET.x, TARGET.z)).dot(back)
			var wall := func(x: float, z: float) -> float: return TARGET.y + (WALL_HIGH_M if behind.call(x, z) > WALL_M else 0.0)
			var slope := func(x: float, z: float) -> float: return TARGET.y + maxf(0.0, behind.call(x, z)) * tan(deg_to_rad(SLOPE_DEG))
			for g: Array in [["wall", wall], ["slope", slope]]:
				var ground: Callable = g[1]
				var k := OgCameraRig.clear_arm(TARGET, offset, ground)
				var cam := OgCameraRig.arm_point(TARGET, offset, k)
				var what := "%s, zoom %.0f yaw %.0f" % [g[0], zoom, yaw_deg]
				var above: float = cam.y - ground.call(cam.x, cam.z)
				t.check(above >= OgCameraRig.CLEAR_GROUND_M, "%s: camera only %.3f m above the ground" % [what, above])
				t.check(cam.y >= TARGET.y + OgCameraRig.CLEAR_TARGET_M, "%s: camera %.3f m above the target" % [what, cam.y - TARGET.y])
				var arm := cam.distance_to(TARGET)
				t.check(arm < offset.length() - 1.0, "%s: arm %.2f m, posed %.2f m: not pulled in" % [what, arm, offset.length()])
				# Pulled in only as far as needed: a little further out is blocked.
				var out := OgCameraRig.arm_point(TARGET, offset, minf(1.0, k + 0.02))
				t.check(out.y < ground.call(out.x, out.z) + OgCameraRig.CLEAR_GROUND_M, "%s: pulled in further than needed (k %.3f)" % [what, k])
