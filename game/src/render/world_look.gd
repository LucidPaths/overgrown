class_name OgWorldLook
extends Node
## The G1 look (ART-027, docs/art/BIBLE.md): the sky, the light, the environment, the wind and the post stack.
## A view node: it reads the wanderer's view node and the camera, writes only rendering state (the
## Environment, the sun, the global shader uniforms og_*) and never touches the rules.
##
## Post quality (`--post off|low|high`, default POST_DEFAULT): off is the raw render with Godot's fog and
## tonemapper, for comparison; low and high run the painterly compositor stack (OgPaintPost).
## `--shot YAW,PITCH,DIST` (debug, captures only) swaps in a free camera around the wanderer: yaw in degrees
## (0 looks north), pitch in degrees below the horizon (negative looks up), distance in metres.

enum Post { OFF, LOW, HIGH }

const POST_DEFAULT := Post.HIGH
const POST_NAMES: Array[String] = ["off", "low", "high"]

## Key light: the low gold sun. Azimuth in degrees clockwise from north, elevation above the horizon.
const SUN_AZIMUTH_DEG := -38.0
const SUN_ELEVATION_DEG := 34.0
const SUN_COLOR := Color(1.0, 0.80, 0.52)
const SUN_ENERGY := 2.3
## The cosmic eye hangs in the north (the default camera looks north) at the height the tilted camera's
## water reflects: look down at a river and the eye looks back up at you. Its nebula ring reaches the strip of
## sky at the top of the frame.
const EYE_AZIMUTH_DEG := 4.0
const EYE_ELEVATION_DEG := 40.0
## Shadow fill: teal, from the sky (sRGB).
const AMBIENT_COLOR := Color(0.28, 0.52, 0.58)
const AMBIENT_ENERGY := 1.7
## Wind: base direction (degrees clockwise from north, the way it blows toward), strength, and how far the
## direction wanders over time.
const WIND_TOWARD_DEG := 62.0
const WIND_STRENGTH := 1.0
const WIND_WANDER_DEG := 18.0

## Fog for post off (Godot's depth fog; the rig still moves its begin/end with the pose).
const OFF_FOG_COLOR := Color(0.62, 0.55, 0.40)

var post := POST_DEFAULT

var _env: Environment
var _sun: DirectionalLight3D
var _focus: Node3D
var _camera: Camera3D
var _shot_cam: Camera3D
var _shot := Vector3.ZERO
var _post_effect: OgPaintPost
var _time := 0.0
var _landmarks: OgLandmarkView


## Sets up the look. world_env: the scene's WorldEnvironment; sun: the key light; camera: the play camera;
## focus: the wanderer's view node; quality: Post; shot: Vector3(yaw, pitch, dist) or null.
func setup(world_env: WorldEnvironment, sun: DirectionalLight3D, camera: Camera3D, focus: Node3D, quality: int, shot: Variant = null, landmarks: OgLandmarkView = null) -> void:
	post = quality
	_landmarks = landmarks
	if landmarks != null:
		landmarks.mesh_pillar = post == Post.OFF
	_env = world_env.environment
	_sun = sun
	_camera = camera
	_focus = focus
	_setup_sun()
	_setup_environment()
	if post != Post.OFF:
		_post_effect = OgPaintPost.new()
		_post_effect.quality = post
		var comp := Compositor.new()
		comp.compositor_effects = [_post_effect]
		world_env.compositor = comp
	if shot != null:
		_shot = shot
		_shot_cam = Camera3D.new()
		_shot_cam.fov = camera.fov
		_shot_cam.near = camera.near
		_shot_cam.far = 400.0
		add_child(_shot_cam)
		_shot_cam.current = true
	_update(0.0)


static func dir_from(azimuth_deg: float, elevation_deg: float) -> Vector3:
	var az := deg_to_rad(azimuth_deg)
	var el := deg_to_rad(elevation_deg)
	return Vector3(sin(az) * cos(el), sin(el), -cos(az) * cos(el))


func _setup_sun() -> void:
	var d := dir_from(SUN_AZIMUTH_DEG, SUN_ELEVATION_DEG)
	_sun.look_at_from_position(Vector3.ZERO, -d, Vector3.UP)
	_sun.light_color = SUN_COLOR
	_sun.light_energy = SUN_ENERGY
	_sun.shadow_enabled = true
	_sun.shadow_blur = 1.5
	_sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	_sun.directional_shadow_max_distance = 120.0
	RenderingServer.global_shader_parameter_set("og_sun_dir", d)
	RenderingServer.global_shader_parameter_set("og_eye_dir", dir_from(EYE_AZIMUTH_DEG, EYE_ELEVATION_DEG))


func _setup_environment() -> void:
	var sky_mat := ShaderMaterial.new()
	sky_mat.shader = load("res://src/render/shaders/sky.gdshader")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky_mat.set_shader_parameter("post_on", post != Post.OFF)
	sky_mat.set_shader_parameter("below_color", OFF_FOG_COLOR)
	sky.radiance_size = Sky.RADIANCE_SIZE_32
	sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
	_env.background_mode = Environment.BG_SKY
	_env.sky = sky
	_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	_env.ambient_light_color = AMBIENT_COLOR
	_env.ambient_light_energy = AMBIENT_ENERGY
	_env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	_env.glow_enabled = true
	_env.glow_normalized = true
	_env.glow_intensity = 0.7
	_env.glow_bloom = 0.04
	_env.glow_hdr_threshold = 0.9
	_env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN
	_env.set_glow_level(0, 0.0)
	_env.set_glow_level(1, 0.0)
	_env.set_glow_level(2, 0.6)
	_env.set_glow_level(3, 1.0)
	_env.set_glow_level(4, 0.8)
	_env.set_glow_level(5, 0.4)
	if post == Post.OFF:
		_env.tonemap_mode = Environment.TONE_MAPPER_AGX
		_env.tonemap_exposure = 1.0
		_env.fog_enabled = true
		_env.fog_light_color = OFF_FOG_COLOR
	else:
		# The compositor tonemaps and grades itself and draws its own painted fog from depth (it reads the
		# begin and end distances the camera rig writes into the Environment every tick).
		_env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
		_env.tonemap_exposure = 1.0
		_env.tonemap_white = 1.0
		_env.fog_enabled = false


func _process(delta: float) -> void:
	_update(delta)


func _update(delta: float) -> void:
	_time += delta
	if _focus != null:
		RenderingServer.global_shader_parameter_set("og_focus", _focus.global_position)
	var wander := deg_to_rad(WIND_WANDER_DEG) * sin(_time * 0.05) + deg_to_rad(WIND_WANDER_DEG) * 0.5 * sin(_time * 0.13 + 1.7)
	var a := deg_to_rad(WIND_TOWARD_DEG) + wander
	var wind := Vector4(sin(a), -cos(a), WIND_STRENGTH, 0.0)
	RenderingServer.global_shader_parameter_set("og_wind", wind)
	if _post_effect != null and _env != null:
		_post_effect.fog_begin = _env.fog_depth_begin
		_post_effect.fog_end = _env.fog_depth_end
	if _shot_cam != null and _focus != null:
		var yaw := deg_to_rad(_shot.x)
		var pitch := deg_to_rad(_shot.y)
		var fwd := Vector3(sin(yaw) * cos(pitch), -sin(pitch), -cos(yaw) * cos(pitch))
		var f := _focus.global_position + Vector3(0, 1.0, 0)
		_shot_cam.global_position = f - fwd * _shot.z
		_shot_cam.look_at(f, Vector3.UP)
	var b := _landmarks.nearest(_focus.global_position) if _landmarks != null and _focus != null else {}
	RenderingServer.global_shader_parameter_set("og_landmark", Vector4.ZERO if b.is_empty() else Vector4(b["glyph"].x, b["glyph"].y, b["glyph"].z, 0.0))
	if _post_effect != null:
		_post_effect.time = _time
		_post_effect.wind = wind
		_post_effect.beam_radius = 0.0 if b.is_empty() else b["radius"]
		if not b.is_empty():
			_post_effect.beam_origin = b["origin"]
			_post_effect.beam_dir = b["dir"]
			_post_effect.beam_length = b["length"]
		_post_effect.eye_dir = dir_from(EYE_AZIMUTH_DEG, EYE_ELEVATION_DEG)
		var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
		if cam != null and _focus != null:
			var at := _focus.global_position + Vector3(0, 0.9, 0)
			if cam.is_position_behind(at):
				_post_effect.focus_uv = Vector2(-10, -10)
			else:
				_post_effect.focus_uv = cam.unproject_position(at) / get_viewport().get_visible_rect().size
				_post_effect.focus_dist = cam.global_position.distance_to(at)
