class_name OgWandererView
extends Node3D
## The G1 wanderer (ART-028) drawn from one OgCharacter: the Blender-built model in OgWandererRig, fed from the
## same rules state OgCharacterView reads (pos, vel, facing, action, action_start, sim.you). Reads rules state,
## never writes it. This node sits on the feet point (the camera follows it) and moves in _physics_process after
## the sim step, so physics interpolation smooths it; a yaw child carries the eased facing; the rig animates and
## simulates its cloth in _process.
##
## Every number here is presentation only (tunable for feel).

## About 95% of a facing change is shown after this long; the dodge turns the body faster.
const FACING_TURN_S := 0.09
const DODGE_TURN_S := 0.04
## How fast the measured ground speed and velocity follow the rules (1/s).
const SPEED_RATE := 14.0
## Extra sink into shallow water, and how fast it eases (1/s).
const WADE_SINK_M := 0.1
const SINK_RATE := 10.0
## A tick move longer than this is a teleport: the interpolation is reset instead of sweeping across.
const TELEPORT_M := 2.0
## Wind for the cloth and hair (world m/s), until the world exposes one.
const WIND := Vector3(2.2, 0.0, -0.8)
## The attack's wind arc: a painted gold crescent swept with the palm.
const ARC_SPAN_DEG := 120.0
const ARC_INNER_M := 0.5
const ARC_OUTER_M := 1.45
const ARC_HEIGHT_M := 1.05
const ARC_TILT_DEG := 12.0
const ARC_SWEEP_DEG := 150.0

var rig := OgWandererRig.new()
var _c: OgCharacter
var _sim: OgSim
var _yaw := Node3D.new()
var _arc := MeshInstance3D.new()
var _arc_mat := StandardMaterial3D.new()
var _yaw_angle := 0.0
var _sink := 0.0
var _last_pos := Vector2.ZERO
var _last_tick := -1
## Measured velocity (x, z), m/s, eased.
var _vel := Vector2.ZERO
var _vel_goal := Vector2.ZERO


func _init() -> void:
	process_physics_priority = 5 # after the main scene's sim step (0), before the camera rig (10)
	add_child(_yaw)
	_yaw.add_child(rig)
	_build_arc()
	add_child(_arc)


## Starts drawing sim.you; snaps to it (call again after a teleport).
func setup(sim: OgSim) -> void:
	_sim = sim
	_c = sim.you
	_yaw_angle = _yaw_of(_c.facing)
	_last_pos = _c.pos
	_last_tick = sim.tick
	_sync(0.0)
	reset_physics_interpolation()


func _physics_process(delta: float) -> void:
	if _c == null:
		return
	var moved := _last_pos.distance_to(_c.pos)
	# Measure only when the rules advanced (a frozen capture keeps the last motion, so the pose holds).
	if _sim.tick != _last_tick:
		var ticks := maxi(1, _sim.tick - _last_tick)
		_vel_goal = (_c.pos - _last_pos) * float(OgRules.TICK_HZ) / ticks if moved <= TELEPORT_M else Vector2.ZERO
		_last_tick = _sim.tick
		_last_pos = _c.pos
	_sync(delta)
	if moved > TELEPORT_M:
		reset_physics_interpolation()


func _sync(delta: float) -> void:
	var c := _c
	var depth: int = OgWalkability.TILE_RULES[_sim.store.tile_at(floori(c.pos.x), floori(c.pos.y))]["depth"]
	_sink = lerpf(_sink, WADE_SINK_M if depth > 0 else 0.0, _ease(SINK_RATE, delta))
	position = Vector3(c.pos.x, _sim.store.height_at(c.pos.x, c.pos.y) - _sink, c.pos.y)
	_vel = _vel.lerp(_vel_goal, _ease(SPEED_RATE, delta))
	# The body faces the rules facing; a dodge turns it along the dash.
	var goal := _yaw_of(c.facing)
	var turn := FACING_TURN_S
	if c.action == OgCharacter.Action.DODGE and c.vel != Vector2.ZERO:
		goal = _yaw_of(c.vel.normalized())
		turn = DODGE_TURN_S
	_yaw_angle = lerp_angle(_yaw_angle, goal, _ease(3.0 / turn, delta))
	_yaw.rotation = Vector3(0.0, _yaw_angle, 0.0)


func _process(delta: float) -> void:
	if _c == null:
		return
	var c := _c
	var elapsed := float(_sim.tick - c.action_start)
	rig.ground_speed = _vel.length()
	# Movement in the rig's frame: x right, y forward (the rig faces -Z after the yaw).
	var fwd := Vector2(-sin(_yaw_angle), -cos(_yaw_angle))
	var right := Vector2(cos(_yaw_angle), -sin(_yaw_angle))
	rig.move_local = Vector2(_vel.dot(right), _vel.dot(fwd)) if _vel.length() > 0.05 else Vector2.ZERO
	rig.body_velocity = Vector3(_vel.x, 0.0, _vel.y)
	rig.wind = WIND
	match c.action:
		OgCharacter.Action.ATTACK:
			rig.action = OgWandererRig.Act.ATTACK
			rig.action_progress = clampf(elapsed / OgRules.ATTACK_TICKS, 0.0, 1.0)
		OgCharacter.Action.DODGE:
			rig.action = OgWandererRig.Act.DODGE
			rig.action_progress = clampf(elapsed / OgRules.DODGE_TICKS, 0.0, 1.0)
		_:
			rig.action = OgWandererRig.Act.NONE
	rig.advance(delta)
	_update_arc()


## The arc follows the palm: it sweeps across the facing during the attack's swing window, then fades.
func _update_arc() -> void:
	if rig.action != OgWandererRig.Act.ATTACK:
		_arc.visible = false
		return
	var p := rig.action_progress
	var w := OgWandererRig.ATTACK_SWING
	var s := clampf((p - w.x) / (w.y - w.x), 0.0, 1.0)
	if p < w.x:
		_arc.visible = false
		return
	var sweep := 1.0 - (1.0 - s) * (1.0 - s)
	if not _arc.visible:
		_arc.visible = true
		_arc.reset_physics_interpolation()
	_arc.basis = Basis(Vector3.UP, _yaw_of(_c.facing) + deg_to_rad(ARC_SWEEP_DEG * (0.5 - sweep))) * Basis(Vector3.BACK, deg_to_rad(ARC_TILT_DEG))
	_arc_mat.albedo_color.a = 1.0 if p <= w.y else clampf(1.0 - (p - w.y) / (1.0 - w.y) * 1.8, 0.0, 1.0)


## Node yaw that turns the model's forward (-Z) to the facing (x, z).
static func _yaw_of(facing: Vector2) -> float:
	return atan2(-facing.x, -facing.y)


## The fraction of the remaining gap closed this tick at `rate` per second (1 when delta is 0: snap).
static func _ease(rate: float, delta: float) -> float:
	return 1.0 if delta == 0.0 else 1.0 - exp(-rate * delta)


## A crescent ribbon from the leading edge (angle 0, along -Z) back over ARC_SPAN_DEG: gold at the outer edge,
## thinning and fading toward the tail, with a brushy broken inner edge.
func _build_arc() -> void:
	const SEGMENTS := 28
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	for i in SEGMENTS + 1:
		var u := float(i) / SEGMENTS
		var a := deg_to_rad(ARC_SPAN_DEG) * u
		var dir := Vector3(-sin(a), 0.0, -cos(a))
		var alpha := pow(1.0 - u, 1.4)
		var inner := lerpf(ARC_INNER_M, ARC_OUTER_M - 0.1, u * 0.7) + 0.05 * sin(u * 37.0)
		verts.append(dir * inner)
		verts.append(dir * ARC_OUTER_M * (1.0 - 0.06 * u))
		colors.append(Color(1.0, 0.62, 0.22, alpha * 0.0))
		colors.append(Color(1.0, 0.9, 0.62, alpha))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colors
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLE_STRIP, arrays)
	_arc_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_arc_mat.vertex_color_use_as_albedo = true
	_arc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_arc_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_arc.mesh = m
	_arc.material_override = _arc_mat
	_arc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_arc.position.y = ARC_HEIGHT_M
	_arc.visible = false
