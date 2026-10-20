extends SceneTree
## The wanderer studio (ART-028): renders OgWandererRig with the game's shader under the main scene's sun and
## ambient, for turnarounds, contact sheets and close-ups. Run through tools/godot/wanderer_studio.sh.
##   -- turnaround OUT.png    idle, front / three-quarter / side / back / three-quarter back
##   -- sheet OUT.png         a row per clip (idle, walk, run, sprint, dodge, attack over a run), 6 frames each
##   -- closeup OUT.png       a portrait three-quarter view, standing in the wind
##   -- frame OUT.png CLIP P [AZ]   one frame: CLIP in idle|walk|run|sprint|dodge|attack|attackrun, progress P
##   -- portrait OUT.png AZ         a low-angle dusk portrait, backlit like the mood-board paintings (side-by-sides)
## With WANDERER_GAME_ZOOM=M in the environment it instead runs the real main scene with the main scene's own
## arguments (e.g. -- --capture OUT.png --autopilot --capture-tick 60) and only pulls the play camera in to M
## metres: an in-game close-up (the rig's zoom has no flag).
## The rig is stepped at 60 Hz between renders, so cloth and hair carry their motion from frame to frame.

const DT := 1.0 / 60.0
const SKY_TOP := Color(0.08, 0.3, 0.38)
const HORIZON := Color(0.94, 0.74, 0.5)

var _root := Node3D.new()
var _rig: OgWandererRig
var _cam := Camera3D.new()
var _vp: Viewport
var _sun := DirectionalLight3D.new()
var _env: Environment
var _sky_mat: ProceduralSkyMaterial
var _ground_mat: StandardMaterial3D


func _initialize() -> void:
	var zoom := OS.get_environment("WANDERER_GAME_ZOOM")
	if zoom != "":
		var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
		root.add_child(main)
		_zoom_game.call_deferred(main, float(zoom))
		return
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		printerr("usage: -- turnaround|sheet|closeup|frame OUT.png ...")
		quit(2)
		return
	_build_stage()
	_run.call_deferred(args)


func _zoom_game(main: Node, metres: float) -> void:
	var cam_rig := main.get_node("CameraRig")
	cam_rig.set("_zoom", metres)
	cam_rig.set("_zoom_goal", metres)


func _build_stage() -> void:
	root.add_child(_root)
	var env := Environment.new()
	_env = env
	var sky_mat := ProceduralSkyMaterial.new()
	_sky_mat = sky_mat
	sky_mat.sky_top_color = SKY_TOP
	sky_mat.sky_horizon_color = HORIZON
	sky_mat.ground_bottom_color = HORIZON
	sky_mat.ground_horizon_color = HORIZON
	sky_mat.sky_curve = 0.12
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.42, 0.6, 0.66)
	env.ambient_light_energy = 0.65
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	var we := WorldEnvironment.new()
	we.environment = env
	_root.add_child(we)
	_sun.light_color = Color(1, 0.91, 0.76)
	_sun.light_energy = 1.15
	_sun.shadow_enabled = true
	_root.add_child(_sun)
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(60, 60)
	ground.mesh = plane
	var gm := StandardMaterial3D.new()
	_ground_mat = gm
	gm.albedo_color = Color(0.42, 0.5, 0.2)
	gm.roughness = 1.0
	ground.material_override = gm
	_root.add_child(ground)
	_rig = OgWandererRig.new()
	_root.add_child(_rig)
	_cam.fov = 30.0
	_root.add_child(_cam)
	_cam.current = true
	_vp = root


func _look(az_deg: float, dist: float, height: float, target_y: float) -> void:
	# az 0: in front of the wanderer (who faces -Z), looking back at it
	var az := deg_to_rad(az_deg)
	var target := Vector3(0, target_y, 0)
	_cam.position = target + Vector3(sin(az) * dist, height, -cos(az) * dist)
	_cam.look_at(target, Vector3.UP)
	# Key light from over the camera's left shoulder, 40 degrees up (the game's sun stays fixed; this is a studio).
	_sun.rotation = Vector3(deg_to_rad(-40.0), _cam.rotation.y - deg_to_rad(40.0), 0.0)


func _set_state(clip: String, p: float) -> void:
	_rig.action = OgWandererRig.Act.NONE
	_rig.action_progress = 0.0
	var speed := 0.0
	match clip:
		"walk":
			speed = OgWandererRig.WALK_SPEED
		"run", "attackrun":
			speed = OgWandererRig.RUN_SPEED
		"sprint":
			speed = OgWandererRig.SPRINT_SPEED
		"dodge":
			speed = 8.57
	_rig.ground_speed = speed if clip != "dodge" else 0.0
	_rig.move_local = Vector2(0, 1) if speed > 0.0 else Vector2.ZERO
	_rig.body_velocity = Vector3(0, 0, -speed)
	if clip == "dodge":
		_rig.action = OgWandererRig.Act.DODGE
		_rig.action_progress = p
	elif clip == "attack" or clip == "attackrun":
		_rig.action = OgWandererRig.Act.ATTACK
		_rig.action_progress = p


## Steps the rig for `seconds` holding the state (cloth settles into it).
func _settle(seconds: float) -> void:
	for i in roundi(seconds / DT):
		_rig.advance(DT)


func _snap() -> Image:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	return _vp.get_texture().get_image()


func _run(args: PackedStringArray) -> void:
	var mode := args[0]
	var out := args[1]
	DirAccess.make_dir_recursive_absolute(out.get_base_dir())
	var img: Image
	match mode:
		"turnaround":
			img = await _turnaround()
		"sheet":
			img = await _sheet()
		"closeup":
			img = await _closeup()
		"frame":
			img = await _frame(args[2], float(args[3]), float(args[4]) if args.size() > 4 else 35.0)
		"portrait":
			img = await _portrait(float(args[2]) if args.size() > 2 else 160.0)
		_:
			printerr("unknown mode " + mode)
			quit(2)
			return
	var err := img.save_png(out)
	print("STUDIO ", out, " err ", err)
	quit(0 if err == OK else 1)


func _turnaround() -> Image:
	_set_state("idle", 0.0)
	_settle(2.0)
	var tiles: Array[Image] = []
	for az in [0.0, 40.0, 90.0, 180.0, 220.0]:
		_look(az, 5.4, 0.9, 0.95)
		_rig.advance(DT)
		tiles.append(_crop(await _snap(), 0.3))
	return _grid(tiles, tiles.size())


func _closeup() -> Image:
	_set_state("idle", 0.0)
	_settle(2.5)
	_cam.fov = 22.0
	var tiles: Array[Image] = []
	for az in [150.0, -28.0]:
		_look(az, 4.6, 0.55, 1.3)
		_rig.advance(DT)
		tiles.append(_crop(await _snap(), 0.5))
	return _grid(tiles, 2)


func _frame(clip: String, p: float, az: float) -> Image:
	_set_state(clip, 0.0 if clip in ["dodge", "attack", "attackrun"] else p)
	if clip in ["dodge", "attack", "attackrun"]:
		_set_state("run" if clip != "attack" else "idle", 0.0)
		_settle(1.0)
		var n := roundi(p * (0.35 if clip == "dodge" else 0.4) / DT)
		for i in n:
			_set_state(clip, float(i) / maxf(1.0, (0.35 if clip == "dodge" else 0.4) / DT))
			_rig.advance(DT)
		_set_state(clip, p)
	else:
		_settle(1.5)
	_look(az, 5.4, 0.9, 0.95)
	_rig.advance(DT)
	return _crop(await _snap(), 0.3)


## Low camera, looking a little up at the figure against a dusk sky; the sun low behind it on the far side, so
## the near side sits in the cool ambient and the rim draws the silhouette, as in mood-board 01, 02 and 09.
func _portrait(az_deg: float) -> Image:
	_sky_mat.sky_top_color = Color(0.04, 0.13, 0.17)
	_sky_mat.sky_horizon_color = Color(0.86, 0.55, 0.24)
	_sky_mat.ground_bottom_color = Color(0.86, 0.55, 0.24)
	_sky_mat.ground_horizon_color = Color(0.86, 0.55, 0.24)
	_sky_mat.sky_curve = 0.05
	_env.ambient_light_color = Color(0.3, 0.46, 0.52)
	_env.ambient_light_energy = 0.8
	_ground_mat.albedo_color = Color(0.2, 0.19, 0.1)
	_set_state("idle", 0.0)
	_settle(2.5)
	_cam.fov = 30.0
	var az := deg_to_rad(az_deg)
	var target := Vector3(0, 1.15, 0)
	_cam.position = Vector3(sin(az) * 3.4, 0.75, -cos(az) * 3.4)
	_cam.look_at(target, Vector3.UP)
	_sun.light_color = Color(1.0, 0.78, 0.5)
	_sun.light_energy = 1.3
	_sun.rotation = Vector3(deg_to_rad(-18.0), _cam.rotation.y + deg_to_rad(180.0 - 55.0), 0.0)
	_rig.advance(DT)
	return _crop(await _snap(), 0.45)


## Rows: idle, walk, run, sprint, dodge, attack over a run; 6 frames each across the cycle or the action.
func _sheet() -> Image:
	var tiles: Array[Image] = []
	var rows := [["idle", 4.0], ["walk", 1.1], ["run", 0.5667], ["sprint", 0.5], ["dodge", 0.35], ["attackrun", 0.4]]
	for row in rows:
		var clip: String = row[0]
		var length: float = row[1]
		var action := clip == "dodge" or clip == "attackrun"
		_set_state("run" if action else clip, 0.0)
		_settle(1.2)
		_look(-62.0 if clip != "idle" else 30.0, 5.4, 0.9, 0.95)
		var steps := roundi(length / DT)
		var shot_every := maxi(1, roundi(steps / 6.0))
		var k := 0
		for i in steps:
			if action:
				_set_state(clip, float(i) / steps)
			_rig.advance(DT)
			if i % shot_every == 0 and k < 6:
				tiles.append(_crop(await _snap(), 0.3))
				k += 1
		while k < 6:
			tiles.append(_crop(await _snap(), 0.3))
			k += 1
	return _grid(tiles, 6)


## A centred crop `frac` of the frame width wide (portrait).
func _crop(img: Image, frac: float) -> Image:
	var w := img.get_width()
	var h := img.get_height()
	var cw := int(w * frac)
	return img.get_region(Rect2i((w - cw) / 2, 0, cw, h))


func _grid(tiles: Array[Image], cols: int) -> Image:
	var tw := tiles[0].get_width()
	var th := tiles[0].get_height()
	var rows := ceili(tiles.size() / float(cols))
	var out := Image.create(tw * cols, th * rows, false, tiles[0].get_format())
	for i in tiles.size():
		out.blit_rect(tiles[i], Rect2i(0, 0, tw, th), Vector2i((i % cols) * tw, (i / cols) * th))
	return out
