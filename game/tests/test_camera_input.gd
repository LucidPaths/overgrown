extends RefCounted
## Camera-relative input (GOD-008): screen directions map to the world through the orbit yaw, so "up" (W, the left
## stick or the right-stick aim pushed up) always points away from the camera, at any yaw and pitch.

const EPS := 1e-5


## [yaw deg, screen dir, world dir (x, z)]. At yaw 0 the camera is south of the target looking north (-z); +90 puts
## it east looking west; 180 north looking south.
const CASES := [
	[0.0, Vector2(0, -1), Vector2(0, -1)],
	[0.0, Vector2(1, 0), Vector2(1, 0)],
	[90.0, Vector2(0, -1), Vector2(-1, 0)],
	[90.0, Vector2(1, 0), Vector2(0, -1)],
	[180.0, Vector2(0, -1), Vector2(0, 1)],
	[180.0, Vector2(1, 0), Vector2(-1, 0)],
]


## At the lowest orbit pitch the view looks up above the horizon (GOD-009); screen_to_world must still map up to away.
func test_screen_directions_map_through_the_orbit_yaw(t: TestContext) -> void:
	t.check(OgCameraRig.PLAY_PITCH_MIN_DEG < OgCameraRig.PLAY_LOOK_RAISE_DEG, "the lowest pitch no longer looks above the horizon")
	for pitch_deg in [OgCameraRig.PLAY_PITCH_MIN_DEG, OgCameraRig.LOOK_UP_FROM_DEG, OgCameraRig.PLAY_PITCH_MAX_DEG]:
		var look := deg_to_rad(pitch_deg - OgCameraRig.PLAY_LOOK_RAISE_DEG)
		for c: Array in CASES:
			var yaw := deg_to_rad(c[0])
			var basis := OgCameraRig.camera_basis(yaw, look)
			var got := OgLocalInput.screen_to_world(c[1], basis)
			t.check(got.distance_to(c[2]) < EPS, "yaw %.0f pitch %.0f: screen %s -> world %s, want %s" % [c[0], pitch_deg, c[1], got, c[2]])
			# Up is away from the camera: opposite to the camera's offset from the target on the orbit.
			var offset := OgCameraRig.camera_offset(yaw, deg_to_rad(OgCameraRig.camera_pitch_deg(pitch_deg)), 1.0)
			var up := OgLocalInput.screen_to_world(Vector2(0, -1), basis)
			t.check(up.distance_to(-Vector2(offset.x, offset.z).normalized()) < EPS, "yaw %.0f: up maps to %s, not away from the camera at %s" % [c[0], up, offset])
