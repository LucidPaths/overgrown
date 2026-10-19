# Spike scene: procedural terrain + the Blender character walking, top-down 3/4 ARPG camera.
# Everything visible is generated here or by spike/blender (OQ-030). No downloaded assets.
#
# Interactive:  godot --path spike/godot
# Capture:      xvfb-run godot --path spike/godot --rendering-method forward_plus -- \
#                   --capture spike/img/godot_forward_plus --tag forward_plus
#   writes <prefix>_still.png, <prefix>_walk_0..7.png, <prefix>_timing.json, then quits.
extends Node3D

const TERRAIN_SIZE := 64.0  # metres
const TERRAIN_CELLS := 128  # grid resolution (cells per side)
const WALK_SPEED := 1.5  # m/s; the walk cycle is 1.0 s and covers ~1.5 m
const HEADING := Vector3(1.0, 0.0, 0.45)  # direction the character walks

var noise := FastNoiseLite.new()
var character: Node3D
var anim: AnimationPlayer
var camera: Camera3D
var walk_t := 0.0  # seconds walked; drives position and the animation
var capturing := false


func _ready() -> void:
	noise.seed = 7
	noise.frequency = 0.07
	noise.fractal_octaves = 4
	build_environment()
	build_terrain()
	build_props()
	spawn_character()
	camera = Camera3D.new()
	camera.fov = 45.0
	add_child(camera)
	place(0.0)
	var args := OS.get_cmdline_user_args()
	var i := args.find("--capture")
	if i >= 0 and i + 1 < args.size():
		var tag := "unknown"
		var j := args.find("--tag")
		if j >= 0 and j + 1 < args.size():
			tag = args[j + 1]
		capture(args[i + 1], tag)


# ------------------------------------------------------------------ terrain
func height(x: float, z: float) -> float:
	var h := noise.get_noise_2d(x, z) * 3.0 + noise.get_noise_2d(x * 3.1, z * 3.1) * 0.3
	# flatten toward the walking line so the path stays readable
	var d := absf(z - x * HEADING.z / HEADING.x)
	return h * clampf(d / 4.0, 0.3, 1.0)


func terrain_color(h: float, slope: float) -> Color:
	var grass := Color(0.24, 0.42, 0.16)
	var dry := Color(0.47, 0.50, 0.22)
	var dirt := Color(0.40, 0.30, 0.18)
	var rock := Color(0.42, 0.41, 0.40)
	var c := grass.lerp(dry, clampf(h * 0.4 + 0.35, 0.0, 1.0))
	c = c.lerp(dirt, clampf((slope - 0.12) * 4.0, 0.0, 1.0))
	return c.lerp(rock, clampf((slope - 0.35) * 4.0, 0.0, 1.0))


func build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := TERRAIN_CELLS
	var step := TERRAIN_SIZE / n
	var half := TERRAIN_SIZE * 0.5
	for gz in n + 1:
		for gx in n + 1:
			var x := -half + gx * step
			var z := -half + gz * step
			var h := height(x, z)
			var nrm := Vector3(height(x - step, z) - height(x + step, z), 2.0 * step, height(x, z - step) - height(x, z + step)).normalized()
			st.set_normal(nrm)
			st.set_color(terrain_color(h, 1.0 - nrm.y * nrm.y))
			st.add_vertex(Vector3(x, h, z))
	for gz in n:
		for gx in n:
			var a := gz * (n + 1) + gx
			st.add_index(a)
			st.add_index(a + 1)
			st.add_index(a + n + 1)
			st.add_index(a + 1)
			st.add_index(a + n + 2)
			st.add_index(a + n + 1)
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true  # the colours above are authored in sRGB
	mat.roughness = 0.95
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.name = "Terrain"
	add_child(mi)


func build_props() -> void:
	# trees and rocks from primitives, placed by a seeded RNG (deterministic)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.33, 0.22, 0.13)
	var leaf_mat := StandardMaterial3D.new()
	leaf_mat.albedo_color = Color(0.16, 0.36, 0.14)
	leaf_mat.roughness = 0.9
	var rock_mat := StandardMaterial3D.new()
	rock_mat.albedo_color = Color(0.45, 0.44, 0.42)
	var placed := 0
	while placed < 60:
		var p := Vector3(rng.randf_range(-28, 28), 0, rng.randf_range(-28, 28))
		var off_path := absf(p.z - p.x * HEADING.z / HEADING.x)
		if off_path < 2.5:
			continue
		p.y = height(p.x, p.z)
		placed += 1
		if rng.randf() < 0.65:
			var trunk := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.12
			cyl.bottom_radius = 0.18
			cyl.height = 1.6
			cyl.radial_segments = 8
			trunk.mesh = cyl
			trunk.material_override = trunk_mat
			trunk.position = p + Vector3(0, 0.8, 0)
			add_child(trunk)
			for k in 3:
				var crown := MeshInstance3D.new()
				var cone := CylinderMesh.new()
				cone.top_radius = 0.0
				cone.bottom_radius = 1.3 - k * 0.3
				cone.height = 1.4
				cone.radial_segments = 10
				crown.mesh = cone
				crown.material_override = leaf_mat
				crown.position = p + Vector3(0, 1.7 + k * 0.7, 0)
				crown.rotation.y = rng.randf() * TAU
				add_child(crown)
		else:
			var rock := MeshInstance3D.new()
			var sph := SphereMesh.new()
			sph.radius = rng.randf_range(0.3, 0.8)
			sph.height = sph.radius * 1.3
			sph.radial_segments = 7
			sph.rings = 4
			rock.mesh = sph
			rock.material_override = rock_mat
			rock.position = p
			rock.rotation = Vector3(rng.randf(), rng.randf() * TAU, rng.randf()) * 0.4
			add_child(rock)


# ------------------------------------------------------------------ lighting / environment
func build_environment() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48.0, -35.0, 0.0)
	sun.light_energy = 1.3
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)

	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.32, 0.50, 0.78)
	sky_mat.sky_horizon_color = Color(0.70, 0.76, 0.82)
	sky_mat.ground_horizon_color = Color(0.55, 0.58, 0.55)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.fog_enabled = true
	env.fog_light_color = Color(0.70, 0.76, 0.82)
	env.fog_density = 0.004
	env.fog_sky_affect = 0.2
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.ssao_enabled = true  # Forward+ and Compatibility; Mobile ignores it (and warns)
	env.ssao_radius = 1.2
	env.ssao_intensity = 2.0
	# triage switches for renderer comparisons: --no-glow --no-fog --linear-tonemap
	var args := OS.get_cmdline_user_args()
	if args.has("--no-glow"):
		env.glow_enabled = false
	if args.has("--no-fog"):
		env.fog_enabled = false
	if args.has("--linear-tonemap"):
		env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)


# ------------------------------------------------------------------ character
func spawn_character() -> void:
	var scene: PackedScene = load("res://assets/character.glb")
	character = scene.instantiate()
	add_child(character)
	anim = character.find_children("*", "AnimationPlayer", true, false)[0]
	anim.get_animation("walk").loop_mode = Animation.LOOP_LINEAR
	anim.get_animation("idle").loop_mode = Animation.LOOP_LINEAR
	anim.play("walk")
	character.rotation.y = atan2(HEADING.x, HEADING.z)  # glTF front is +Z


# Puts the character t seconds along its path, feet on the terrain, camera following.
func place(t: float) -> void:
	var dir := HEADING.normalized()
	var p := -dir * 6.0 + dir * WALK_SPEED * t
	p.y = height(p.x, p.z)
	character.position = p
	camera.position = p + Vector3(0.0, 6.0, 5.2)
	camera.look_at(p + Vector3(0, 0.9, 0), Vector3.UP)


func _process(delta: float) -> void:
	if capturing:
		return
	walk_t += delta
	place(fmod(walk_t, 8.0))


# ------------------------------------------------------------------ capture
func capture(prefix: String, tag: String) -> void:
	capturing = true
	# safety net: never hang a pipeline (e.g. a renderer that never presents a frame)
	get_tree().create_timer(300.0).timeout.connect(func() -> void:
		printerr("CAPTURE TIMEOUT")
		get_tree().quit(2))
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	var vp_rid := get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(vp_rid, true)
	DirAccess.make_dir_recursive_absolute(prefix.get_base_dir())
	var t_start := Time.get_ticks_usec()
	var info := {
		"tag": tag,
		"rendering_method": RenderingServer.get_current_rendering_method(),
		"rendering_driver": RenderingServer.get_current_rendering_driver_name(),
		"adapter": RenderingServer.get_video_adapter_name(),
		"adapter_vendor": RenderingServer.get_video_adapter_vendor(),
		"api_version": RenderingServer.get_video_adapter_api_version(),
		"godot": Engine.get_version_info()["string"],
		"viewport": [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y],
	}
	# 1) warm-up: the first frames compile shaders / pipelines
	var first_frame_ms := -1.0
	for k in 5:
		var t0 := Time.get_ticks_usec()
		await RenderingServer.frame_post_draw
		if k == 0:
			first_frame_ms = (Time.get_ticks_usec() - t0) / 1000.0
	info["warmup_5_frames_ms"] = (Time.get_ticks_usec() - t_start) / 1000.0
	info["first_frame_ms"] = first_frame_ms

	# 2) timed frames while walking (wall clock per frame + Godot's render-time measurement)
	var times: Array[float] = []
	var cpu: Array[float] = []
	var gpu: Array[float] = []
	var last := Time.get_ticks_usec()
	for k in 30:
		place(k / 30.0)
		anim.seek(fmod(k / 30.0, 1.0), true)
		await RenderingServer.frame_post_draw
		var now := Time.get_ticks_usec()
		times.append((now - last) / 1000.0)
		last = now
		cpu.append(RenderingServer.viewport_get_measured_render_time_cpu(vp_rid))
		gpu.append(RenderingServer.viewport_get_measured_render_time_gpu(vp_rid))
	info["frame_ms_median"] = _median(times)
	info["frame_ms_min"] = times.min()
	info["frame_ms_max"] = times.max()
	info["fps_median"] = 1000.0 / _median(times)
	info["render_cpu_ms_median"] = _median(cpu)
	info["render_gpu_ms_median"] = _median(gpu)

	# 3) a still at a fixed moment, and an 8-frame walk cycle (1/8 s apart)
	place(2.25)
	anim.seek(0.25, true)
	await _settle()
	get_viewport().get_texture().get_image().save_png(prefix + "_still.png")
	for k in 8:
		var t := 3.0 + k / 8.0
		place(t)
		anim.seek(fmod(t, 1.0), true)
		await _settle()
		get_viewport().get_texture().get_image().save_png(prefix + "_walk_%d.png" % k)
	info["total_capture_s"] = (Time.get_ticks_usec() - t_start) / 1e6
	var f := FileAccess.open(prefix + "_timing.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(info, "  "))
	f.close()
	print("CAPTURE ", JSON.stringify(info))
	get_tree().quit(0)


# Two frames: the posed skeleton and the shadow map catch up before we grab.
func _settle() -> void:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw


func _median(a: Array[float]) -> float:
	var b := a.duplicate()
	b.sort()
	return b[b.size() / 2]
