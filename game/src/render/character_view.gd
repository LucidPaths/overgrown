class_name OgCharacterView
extends Node3D
## The placeholder wanderer (D6; the real model is G1), drawn from one OgCharacter. Reads rules state, never
## writes it. This node sits on the feet point (the camera follows it); a pivot child carries the dodge's dash
## lean, a yaw child the eased facing, and a pose child the bob, lean and attack twist. The dodge's afterimages are
## top-level nodes in world space. Moves in _physics_process after the sim step (process_physics_priority), so
## physics interpolation smooths it between ticks.
##
## Every number below is presentation only (tunable for feel); the rules numbers live in OgRules.

## About 95% of a facing change is shown after this long.
const FACING_TURN_S := 0.08
## Walk bob: one bob per BOB_STRIDE_M travelled, BOB_HEIGHT_M high.
const BOB_STRIDE_M := 0.9
const BOB_HEIGHT_M := 0.05
## Forward lean while walking and while sprinting (degrees), and how fast the lean follows (1/s).
const WALK_LEAN_DEG := 3.0
const SPRINT_LEAN_DEG := 13.0
const LEAN_RATE := 12.0
## Dodge: a full-size dash. The body leans DASH_LEAN_DEG along the dash about the feet, reaching it over the first
## DASH_IN_PART of the dodge and standing back up from DASH_OUT_FROM to its end (upright on the last tick).
## GHOSTS afterimages trail it, each GHOST_GAP_TICKS rules ticks further back, the nearest GHOST_ALPHA opaque.
const DASH_LEAN_DEG := 35.0
const DASH_IN_PART := 0.15
const DASH_OUT_FROM := 0.6
const GHOSTS := 3
const GHOST_GAP_TICKS := 3
const GHOST_ALPHA := 0.5
const GHOST_COLOR := Color(1.0, 0.8, 0.5)
## Attack: the arc sweeps SWING_DEG across the facing over the first SWING_PART of the attack, then fades.
## The body twists with it and lunges forward.
const SWING_DEG := 150.0
const SWING_PART := 0.4
const SWING_TWIST_DEG := 28.0
const SWING_LUNGE_DEG := 9.0
const ARC_SPAN_DEG := 110.0
const ARC_INNER_M := 0.45
const ARC_OUTER_M := 1.35
const ARC_HEIGHT_M := 0.95
const ARC_TILT_DEG := 14.0
## The scarf tail's droop below horizontal at rest and at full sprint speed (degrees).
const SCARF_HANG_DEG := 75.0
const SCARF_STREAM_DEG := 12.0
## Extra sink into shallow water, and how fast it eases (1/s).
const WADE_SINK_M := 0.1
const SINK_RATE := 10.0
## A tick move longer than this is a teleport: the interpolation is reset instead of sweeping across.
const TELEPORT_M := 2.0

const PONCHO := Color(0.93, 0.47, 0.16)
const PONCHO_HEM := Color(0.55, 0.16, 0.09)
const GOLD := Color(0.98, 0.76, 0.25)
const HOOD := Color(0.42, 0.2, 0.1)
const VOID := Color(0.03, 0.025, 0.025)
const CLOTH := Color(0.24, 0.2, 0.18)

var _c: OgCharacter
var _sim: OgSim
var _pivot := Node3D.new()
var _yaw := Node3D.new()
var _pose := Node3D.new()
var _scarf_tail := Node3D.new()
var _arc := MeshInstance3D.new()
var _arc_mat := StandardMaterial3D.new()
var _ghosts: Array[Node3D] = []
var _ghost_mats: Array[StandardMaterial3D] = []
## The pose's world transform at each of the last GHOSTS * GHOST_GAP_TICKS + 1 rules ticks, newest last.
var _trail: Array[Transform3D] = []
var _trail_tick := -1
## [mesh, height] of the body parts the afterimages copy, filled by _build_body.
var _silhouette: Array[Array] = []
var _yaw_angle := 0.0
var _lean := 0.0
var _bob_phase := 0.0
var _sink := 0.0
var _last_pos := Vector2.ZERO


## Builds the model in _init, so every part is owned by this node even if it never enters the tree.
func _init() -> void:
	process_physics_priority = 5 # after the main scene's sim step (0), before the camera rig (10)
	add_child(_pivot)
	_pivot.add_child(_yaw)
	_yaw.add_child(_pose)
	_build_body()
	_build_arc()
	add_child(_arc)
	for i in GHOSTS:
		_build_ghost()


## Starts drawing character c of sim; snaps to it (call again after a teleport).
func setup(sim: OgSim) -> void:
	_sim = sim
	_c = sim.you
	_yaw_angle = _yaw_of(_c.facing)
	_last_pos = _c.pos
	_sync(0.0)
	reset_physics_interpolation()


func _physics_process(delta: float) -> void:
	if _c == null:
		return
	var moved := _last_pos.distance_to(_c.pos)
	_last_pos = _c.pos
	_bob_phase = fmod(_bob_phase + moved / BOB_STRIDE_M, 1.0)
	_sync(delta)
	if moved > TELEPORT_M:
		reset_physics_interpolation()
		_trail.clear()
	_sync_ghosts()


func _sync(delta: float) -> void:
	var c := _c
	var depth: int = OgWalkability.TILE_RULES[_sim.store.tile_at(floori(c.pos.x), floori(c.pos.y))]["depth"]
	_sink = lerpf(_sink, WADE_SINK_M if depth > 0 else 0.0, _ease(SINK_RATE, delta))
	position = Vector3(c.pos.x, _sim.store.height_at(c.pos.x, c.pos.y) - _sink, c.pos.y)

	# Ticks since the action started, counting the starting tick: 1 on the first tick shown.
	var elapsed := _sim.tick - c.action_start
	var walking := c.action == OgCharacter.Action.WALK
	var sprinting := walking and c.vel.length() > OgRules.WALK_SPEED_M_S * 1.05

	# Facing: eased yaw toward the rules facing (which is instant).
	_yaw_angle = lerp_angle(_yaw_angle, _yaw_of(c.facing), _ease(3.0 / FACING_TURN_S, delta))

	# Lean and bob.
	var lean_goal := SPRINT_LEAN_DEG if sprinting else (WALK_LEAN_DEG if walking else 0.0)
	_lean = lerpf(_lean, lean_goal, _ease(LEAN_RATE, delta))
	var bob := absf(sin(_bob_phase * PI)) * BOB_HEIGHT_M if walking else 0.0
	var twist := 0.0
	var lunge := 0.0

	# Dodge: a dash lean along the dash direction (not the facing, which holds the aim), about the feet.
	var dash := Basis.IDENTITY
	if c.action == OgCharacter.Action.DODGE and c.vel != Vector2.ZERO:
		var d := Vector3(c.vel.x, 0.0, c.vel.y).normalized()
		dash = Basis(Vector3.UP.cross(d).normalized(), deg_to_rad(DASH_LEAN_DEG) * _dash_amount(elapsed))

	# Attack: the arc sweeps across the rules facing, then fades.
	if c.action == OgCharacter.Action.ATTACK:
		var p := clampf(float(elapsed) / OgRules.ATTACK_TICKS, 0.0, 1.0)
		var s := clampf(p / SWING_PART, 0.0, 1.0)
		var sweep := 1.0 - (1.0 - s) * (1.0 - s) # fast start, settling into the end of the swing
		_arc.basis = Basis(Vector3.UP, _yaw_of(c.facing) + deg_to_rad(SWING_DEG * (0.5 - sweep))) * Basis(Vector3.BACK, deg_to_rad(ARC_TILT_DEG))
		if not _arc.visible:
			_arc.visible = true
			_arc.reset_physics_interpolation() # don't sweep in from where the last swing ended
		_arc_mat.albedo_color.a = 1.0 if p <= SWING_PART else clampf(1.0 - (p - SWING_PART) / (1.0 - SWING_PART) * 1.6, 0.0, 1.0)
		twist = deg_to_rad(SWING_TWIST_DEG * (0.5 - sweep) * 2.0)
		lunge = SWING_LUNGE_DEG * sin(s * PI)
	else:
		_arc.visible = false

	_pivot.basis = dash
	_yaw.rotation = Vector3(0.0, _yaw_angle, 0.0)
	_pose.position.y = bob
	_pose.rotation = Vector3(-deg_to_rad(_lean + lunge), twist, 0.0)
	# The scarf tail streams back with speed.
	var speed := c.vel.length() if c.action == OgCharacter.Action.WALK or c.action == OgCharacter.Action.DODGE else 0.0
	_scarf_tail.rotation.x = deg_to_rad(lerpf(SCARF_HANG_DEG, SCARF_STREAM_DEG, clampf(speed / (OgRules.WALK_SPEED_M_S * OgRules.SPRINT_MULTIPLIER), 0.0, 1.0)))


## How far into the dash lean the dodge is after `elapsed` ticks: 0..1 in, 1, then back to 0 at DODGE_TICKS.
static func _dash_amount(elapsed: int) -> float:
	var p := clampf(float(elapsed) / OgRules.DODGE_TICKS, 0.0, 1.0)
	return smoothstep(0.0, DASH_IN_PART, p) * (1.0 - smoothstep(DASH_OUT_FROM, 1.0, p))


## Records the pose once per rules tick and places the dodge afterimages along that trail. Ghost i shows the pose
## from (i + 1) * GHOST_GAP_TICKS ticks ago, once that tick is inside the dodge; all fade with the stand-up.
func _sync_ghosts() -> void:
	if _sim.tick != _trail_tick:
		_trail_tick = _sim.tick
		_trail.append(_pose.global_transform)
		if _trail.size() > GHOSTS * GHOST_GAP_TICKS + 1:
			_trail.pop_front()
	var dodging := _c.action == OgCharacter.Action.DODGE
	var elapsed := _sim.tick - _c.action_start
	var p := clampf(float(elapsed) / OgRules.DODGE_TICKS, 0.0, 1.0)
	var fade := 1.0 - smoothstep(DASH_OUT_FROM, 1.0, p)
	for i in GHOSTS:
		var back := (i + 1) * GHOST_GAP_TICKS
		var g := _ghosts[i]
		if not dodging or elapsed - back < 1 or back >= _trail.size():
			g.visible = false
			continue
		g.global_transform = _trail[_trail.size() - 1 - back]
		if not g.visible:
			g.visible = true
			g.reset_physics_interpolation() # don't sweep in from where the last dodge left it
		_ghost_mats[i].albedo_color.a = GHOST_ALPHA * (1.0 - float(i) / GHOSTS) * fade


## Node yaw that turns the model's forward (-Z) to the facing (x, z).
static func _yaw_of(facing: Vector2) -> float:
	return atan2(-facing.x, -facing.y)


## The fraction of the remaining gap closed this tick at `rate` per second (1 when delta is 0: snap).
static func _ease(rate: float, delta: float) -> float:
	return 1.0 if delta == 0.0 else 1.0 - exp(-rate * delta)


func _part(mesh: Mesh, color: Color, at: Vector3, parent: Node3D = _pose) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	m.material_override = mat
	m.position = at
	parent.add_child(m)
	return m


## About 1.75 m tall, feet at y 0, facing -Z.
func _build_body() -> void:
	var body := CapsuleMesh.new()
	body.radius = 0.17
	body.height = 1.3
	_part(body, CLOTH, Vector3(0, 0.65, 0))
	_silhouette.append([body, 0.65])
	var poncho := CylinderMesh.new()
	poncho.top_radius = 0.17
	poncho.bottom_radius = 0.44
	poncho.height = 0.78
	_part(poncho, PONCHO, Vector3(0, 0.96, 0))
	_silhouette.append([poncho, 0.96])
	# The poncho's border: a dark hem band and a gold line above it.
	_part(_band(0.07, 0.418, 0.44), PONCHO_HEM, Vector3(0, 0.605, 0))
	_part(_band(0.025, 0.397, 0.405), GOLD, Vector3(0, 0.68, 0))
	var scarf := TorusMesh.new()
	scarf.inner_radius = 0.1
	scarf.outer_radius = 0.2
	_part(scarf, GOLD, Vector3(0, 1.36, 0)).scale = Vector3(1, 1.5, 1)
	# The scarf's tail, hinged at the back of the neck.
	_scarf_tail.position = Vector3(0.06, 1.36, 0.17)
	_pose.add_child(_scarf_tail)
	var tail := BoxMesh.new()
	tail.size = Vector3(0.1, 0.025, 0.42)
	_part(tail, GOLD, Vector3(0, 0, 0.2), _scarf_tail)
	var hood := SphereMesh.new()
	hood.radius = 0.19
	hood.height = 0.42
	_part(hood, HOOD, Vector3(0, 1.53, 0))
	_silhouette.append([hood, 1.53])
	var tip := CylinderMesh.new()
	tip.top_radius = 0.0
	tip.bottom_radius = 0.09
	tip.height = 0.2
	_part(tip, HOOD, Vector3(0, 1.69, 0.09)).rotation_degrees = Vector3(35, 0, 0)
	# No face (D6): a dark void in the hood's opening.
	var face := SphereMesh.new()
	face.radius = 0.12
	face.height = 0.24
	var void_part := _part(face, VOID, Vector3(0, 1.5, -0.15))
	void_part.scale = Vector3(1, 1.15, 0.5)
	(void_part.material_override as StandardMaterial3D).roughness = 1.0


## A thin ring sitting on the poncho's cone, just outside it.
static func _band(height: float, top_r: float, bottom_r: float) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.height = height
	m.top_radius = top_r + 0.012
	m.bottom_radius = bottom_r + 0.012
	return m


## One afterimage: the body's silhouette (body, poncho, hood) in one unshaded see-through colour, in world space.
func _build_ghost() -> void:
	var g := Node3D.new()
	g.top_level = true
	g.visible = false
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = GHOST_COLOR
	for part: Array in _silhouette:
		var m := MeshInstance3D.new()
		m.mesh = part[0]
		m.material_override = mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.position.y = part[1]
		g.add_child(m)
	add_child(g)
	_ghosts.append(g)
	_ghost_mats.append(mat)


## A flat ribbon from angle 0 (the leading edge, along -Z) back to ARC_SPAN_DEG, fading toward the tail.
func _build_arc() -> void:
	const SEGMENTS := 20
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	for i in SEGMENTS + 1:
		var u := float(i) / SEGMENTS
		var a := deg_to_rad(ARC_SPAN_DEG) * u
		var dir := Vector3(-sin(a), 0.0, -cos(a))
		var alpha := pow(1.0 - u, 1.6)
		verts.append(dir * ARC_INNER_M)
		verts.append(dir * ARC_OUTER_M)
		colors.append(Color(1.0, 0.86, 0.55, alpha * 0.35))
		colors.append(Color(1.0, 0.97, 0.88, alpha))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colors
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLE_STRIP, arrays)
	_arc_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_arc_mat.vertex_color_use_as_albedo = true
	_arc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_arc_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_arc.mesh = mesh
	_arc.material_override = _arc_mat
	_arc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_arc.position.y = ARC_HEIGHT_M
	_arc.visible = false
