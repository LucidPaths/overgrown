class_name OgCameraRig
extends Node3D
## The tilted action-RPG camera (PLAN D4). The rig follows `target` with frame-rate independent smoothing;
## its Camera3D child sits behind the target on an orbit of yaw (0: south of the target, north up) and orbit pitch.
## Dragging with camera_orbit held turns the yaw (freely) and the orbit pitch (clamped); camera_left/right turn the
## yaw at a steady rate. Yaw and pitch persist for the session. The view always looks PLAY_LOOK_RAISE_DEG less
## steeply than the orbit pitch, so one drag pixel tilts it by ORBIT_DEG_PER_PX over the whole range: 60 degrees
## below the horizon at the top, 45 above at the bottom (GOD-009: room to look up at a floating island).
## At and above LOOK_UP_FROM_DEG the camera sits on the orbit at that pitch (unchanged from GOD-008). Below it the
## camera settles smoothly toward CAMERA_FLOOR_PITCH_DEG and rises by up to LOW_LIFT_M (camera_pitch_deg,
## camera_lift_m), while the view keeps tilting up: the target sinks to the bottom of the frame (in frame down to
## about -10, a view 15 degrees up) and then below it; the sky fills the view.
## Terrain (read through `ground`, never written): the camera is lifted straight up wherever it would come within
## CLEAR_GROUND_M of the ground under it or CLEAR_TARGET_M of the target (camera_point; continuous, so no pops).
## The arm itself is a spring arm from a pivot ARM_PIVOT_M above the target: its goal reaches out to the first point
## less than ARM_LOS_M above the ground (terrain between the camera and the wanderer) and back in to a camera point
## with a GOAL_GROUND_M cushion (arm_goal). The arm pulls in toward it at ARM_IN_RATE and eases out at ARM_OUT_RATE,
## never onto a point inside the hard margin (step_arm).
## When pulled in, the view tilts to keep the target where the posed camera had it. Holding camera_vista eases out
## to a wide, high view at the current yaw; the mouse wheel zooms the play view. The rig also moves the depth fog
## with the pose so the streaming edge stays hidden. Moves in _physics_process (physics interpolation smooths it);
## runs after the target moves (process_physics_priority).

## Play view: the orbit starts PLAY_PITCH_DEG above the target line, at the zoom distance (tunable).
const PLAY_PITCH_DEG := 30.0
const PLAY_LOOK_RAISE_DEG := 5.0
const FOV_DEG := 55.0
const PLAY_DISTANCE_M := 14.0
const ZOOM_MIN_M := 8.0
const ZOOM_MAX_M := 24.0
const ZOOM_STEP_M := 2.0
## Orbit (tunable): degrees of yaw and pitch per pixel dragged with camera_orbit held, and the camera_left/right
## yaw rate. The orbit pitch stays in PLAY_PITCH_MIN..MAX_DEG, a view 45 degrees above the horizon to 60 below.
const ORBIT_DEG_PER_PX := 0.3
const YAW_KEYS_DEG_S := 100.0
const PLAY_PITCH_MIN_DEG := -40.0
const PLAY_PITCH_MAX_DEG := 65.0
## Low end (tunable): below LOOK_UP_FROM_DEG the camera's own pitch eases from it toward CAMERA_FLOOR_PITCH_DEG
## (exponentially, same slope at LOOK_UP_FROM_DEG, so no kink) and the camera rises by up to LOW_LIFT_M (eased in
## from zero slope), keeping it clear of rolling ground.
const LOOK_UP_FROM_DEG := 23.0
const CAMERA_FLOOR_PITCH_DEG := 4.0
const LOW_LIFT_M := 1.5
## Terrain clearance (tunable): the hard margins above the ground under the camera and above the target; the
## goal's cushion at the camera and its line-of-sight margin along the arm; the pivot (the wanderer's neck, clear
## above its own ground); ARM_SAMPLES steps plus ARM_REFINE halvings along the arm; and the arm's approach rates,
## in (faster) and out (1 - exp(-rate * delta) of the gap per tick).
const CLEAR_GROUND_M := 0.6
const CLEAR_TARGET_M := 0.3
const GOAL_GROUND_M := 0.8
const ARM_LOS_M := 0.3
const ARM_PIVOT_M := 1.5
const ARM_SAMPLES := 16
const ARM_REFINE := 6
const ARM_IN_RATE := 6.0
const ARM_OUT_RATE := 2.0
## Vista (tunable).
const VISTA_PITCH_DEG := 38.0
const VISTA_LOOK_RAISE_DEG := 0.0
const VISTA_DISTANCE_M := 55.0
## Smoothing rates: the fraction 1 - exp(-rate * delta) of the remaining gap is closed each tick.
const FOLLOW_RATE := 10.0
const ZOOM_RATE := 8.0
const VISTA_RATE := 2.5
## Depth fog (metres from the camera) in each pose: clear around the target, opaque before the nearest
## possible streaming edge (OgChunkStore.LOAD_RADIUS chunks from the focus chunk; tunable).
const PLAY_FOG_BEGIN_M := 30.0
const PLAY_FOG_END_M := 90.0
const VISTA_FOG_BEGIN_M := 60.0
const VISTA_FOG_END_M := 125.0

@export var target: Node3D
## The environment whose depth fog follows the pose; may be null.
@export var environment: Environment
## Forces the vista pose (capture mode) regardless of input.
var force_vista := false
## Read-only terrain height lookup, (x: float, z: float) -> float in metres (OgChunkStore.height_at). Unset: no
## terrain, the arm is never pulled in.
var ground: Callable

var _zoom_goal := PLAY_DISTANCE_M
var _zoom := PLAY_DISTANCE_M
var _vista := 0.0
## Orbit yaw (radians, turning the view left as it grows) and orbit pitch (degrees).
var _yaw := 0.0
var _pitch := PLAY_PITCH_DEG
## The arm's length as a fraction of the posed one (1: not pulled in).
var _arm := 1.0

@onready var _camera: Camera3D = $Camera3D


func _ready() -> void:
	process_physics_priority = 10
	_camera.fov = FOV_DEG


## Sets the orbit (degrees; the pitch is clamped to the play range). Call snap() after to jump there.
func set_orbit(yaw_deg: float, pitch_deg: float) -> void:
	_yaw = deg_to_rad(yaw_deg)
	_pitch = clampf(pitch_deg, PLAY_PITCH_MIN_DEG, PLAY_PITCH_MAX_DEG)


## Sets the play zoom distance in metres (clamped to ZOOM_MIN_M..ZOOM_MAX_M). Call snap() after to jump there.
func set_zoom(dist_m: float) -> void:
	_zoom_goal = clampf(dist_m, ZOOM_MIN_M, ZOOM_MAX_M)


## The orbit yaw (0..360) and orbit pitch in degrees, for the HUD.
func orbit_deg() -> Vector2:
	return Vector2(fposmod(rad_to_deg(_yaw), 360.0), _pitch)


## The camera's basis at orbit yaw `yaw` (radians), looking `look_down` radians below the horizon.
static func camera_basis(yaw: float, look_down: float) -> Basis:
	return Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -look_down)


## The camera's offset from the target at orbit yaw `yaw` and pitch `pitch` (radians), `dist` metres away.
static func camera_offset(yaw: float, pitch: float, dist: float) -> Vector3:
	return Basis(Vector3.UP, yaw) * Vector3(0.0, sin(pitch) * dist, cos(pitch) * dist)


## The camera's own pitch in degrees at orbit pitch `pitch_deg` (see LOOK_UP_FROM_DEG).
static func camera_pitch_deg(pitch_deg: float) -> float:
	if pitch_deg >= LOOK_UP_FROM_DEG:
		return pitch_deg
	return CAMERA_FLOOR_PITCH_DEG + (LOOK_UP_FROM_DEG - CAMERA_FLOOR_PITCH_DEG) * _settle(pitch_deg)


## The camera's rise in metres above the orbit at orbit pitch `pitch_deg` (see LOOK_UP_FROM_DEG).
static func camera_lift_m(pitch_deg: float) -> float:
	if pitch_deg >= LOOK_UP_FROM_DEG:
		return 0.0
	var u := 1.0 - _settle(pitch_deg)
	return LOW_LIFT_M * u * u


## exp(-(LOOK_UP_FROM_DEG - pitch) / (LOOK_UP_FROM_DEG - CAMERA_FLOOR_PITCH_DEG)): 1 at LOOK_UP_FROM_DEG, toward 0.
static func _settle(pitch_deg: float) -> float:
	var span := LOOK_UP_FROM_DEG - CAMERA_FLOOR_PITCH_DEG
	return exp(-(LOOK_UP_FROM_DEG - pitch_deg) / span)


## The camera's position with the arm pulled in to fraction `k`: on the segment from the pivot (ARM_PIVOT_M above
## `target`) to the posed position `target + offset`.
static func arm_point(target: Vector3, offset: Vector3, k: float) -> Vector3:
	var pivot := target + Vector3(0.0, ARM_PIVOT_M, 0.0)
	return pivot + (target + offset - pivot) * k


## The camera's position at arm fraction `k`: arm_point, lifted straight up wherever it would be closer than the
## hard margins (CLEAR_GROUND_M above `ground.call(x, z)`, CLEAR_TARGET_M above `target`). The lift follows the
## ground continuously, so it never pops.
static func camera_point(target: Vector3, offset: Vector3, k: float, ground: Callable) -> Vector3:
	var p := arm_point(target, offset, k)
	p.y = maxf(p.y, maxf(ground.call(p.x, p.z) + CLEAR_GROUND_M, target.y + CLEAR_TARGET_M))
	return p


## The arm's goal fraction: out from the pivot to the first point less than ARM_LOS_M above the ground (terrain
## between the camera and the wanderer), then in from there to the first camera point with the cushion
## (GOAL_GROUND_M above the ground, CLEAR_TARGET_M above the target). ARM_SAMPLES steps, ARM_REFINE halvings.
static func arm_goal(target: Vector3, offset: Vector3, ground: Callable) -> float:
	var los := 1.0
	for i in range(1, ARM_SAMPLES + 1):
		var k := float(i) / ARM_SAMPLES
		if not _passes(target, offset, ground, k, ARM_LOS_M):
			los = _refine(target, offset, ground, float(i - 1) / ARM_SAMPLES, k, ARM_LOS_M)
			break
	for i in range(0, ARM_SAMPLES + 1):
		var k := los * (1.0 - float(i) / ARM_SAMPLES)
		if _passes(target, offset, ground, k, GOAL_GROUND_M):
			return k if i == 0 else _refine(target, offset, ground, k, los * (1.0 - float(i - 1) / ARM_SAMPLES), GOAL_GROUND_M)
	return 0.0


## True if arm_point(k) is `margin` above the ground under it and CLEAR_TARGET_M above the target.
static func _passes(target: Vector3, offset: Vector3, ground: Callable, k: float, margin: float) -> bool:
	var p := arm_point(target, offset, k)
	return p.y >= ground.call(p.x, p.z) + margin and p.y >= target.y + CLEAR_TARGET_M


## Halves [lo (passes), hi (fails)] ARM_REFINE times; returns the passing end.
static func _refine(target: Vector3, offset: Vector3, ground: Callable, lo: float, hi: float, margin: float) -> float:
	for j in ARM_REFINE:
		var mid := (lo + hi) * 0.5
		if _passes(target, offset, ground, mid, margin):
			lo = mid
		else:
			hi = mid
	return lo


## One tick of the arm fraction: close `in_part` of the gap to a shorter arm_goal, or `out_part` of the gap to a
## longer one, but never out onto a point inside the hard margin. With both parts 1 it jumps to the goal.
static func step_arm(arm: float, target: Vector3, offset: Vector3, ground: Callable, in_part: float, out_part: float) -> float:
	var goal := arm_goal(target, offset, ground)
	if goal <= arm:
		return lerpf(arm, goal, in_part)
	var k := lerpf(arm, goal, out_part)
	return k if out_part >= 1.0 or _passes(target, offset, ground, k, CLEAR_GROUND_M) else arm


## Jumps straight to the current goal pose (scene start, teleports, captures).
func snap() -> void:
	global_position = target.global_position
	_zoom = _zoom_goal
	_vista = _vista_goal()
	_apply(1.0, 1.0)
	reset_physics_interpolation()
	_camera.reset_physics_interpolation()


func _vista_goal() -> float:
	return 1.0 if force_vista or Input.is_action_pressed("camera_vista") else 0.0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_action_pressed(&"camera_orbit"):
		var drag := (event as InputEventMouseMotion).relative * ORBIT_DEG_PER_PX
		# Drag right: the view turns right. Drag down: it looks down more steeply.
		_yaw = wrapf(_yaw - deg_to_rad(drag.x), -PI, PI)
		_pitch = clampf(_pitch + drag.y, PLAY_PITCH_MIN_DEG, PLAY_PITCH_MAX_DEG)
	elif event.is_action_pressed("camera_zoom_in"):
		_zoom_goal = maxf(ZOOM_MIN_M, _zoom_goal - ZOOM_STEP_M)
	elif event.is_action_pressed("camera_zoom_out"):
		_zoom_goal = minf(ZOOM_MAX_M, _zoom_goal + ZOOM_STEP_M)


func _physics_process(delta: float) -> void:
	_yaw = wrapf(_yaw + deg_to_rad(YAW_KEYS_DEG_S) * delta * Input.get_axis(&"camera_right", &"camera_left"), -PI, PI)
	global_position = global_position.lerp(target.global_position, 1.0 - exp(-FOLLOW_RATE * delta))
	_zoom = lerpf(_zoom, _zoom_goal, 1.0 - exp(-ZOOM_RATE * delta))
	_vista = lerpf(_vista, _vista_goal(), 1.0 - exp(-VISTA_RATE * delta))
	_apply(1.0 - exp(-ARM_IN_RATE * delta), 1.0 - exp(-ARM_OUT_RATE * delta))


## Poses the camera; the arm closes `in_part` / `out_part` of the gap to its goal this call (1: jump).
func _apply(in_part: float, out_part: float) -> void:
	var t := smoothstep(0.0, 1.0, _vista)
	var dist := lerpf(_zoom, VISTA_DISTANCE_M, t)
	var pitch := deg_to_rad(lerpf(camera_pitch_deg(_pitch), VISTA_PITCH_DEG, t))
	var lift := lerpf(camera_lift_m(_pitch), 0.0, t)
	var view := deg_to_rad(lerpf(_pitch - PLAY_LOOK_RAISE_DEG, VISTA_PITCH_DEG - VISTA_LOOK_RAISE_DEG, t))
	var offset := camera_offset(_yaw, pitch, dist) + Vector3(0.0, lift, 0.0)
	_arm = step_arm(_arm, global_position, offset, ground, in_part, out_part) if ground.is_valid() else 1.0
	_camera.position = camera_point(global_position, offset, _arm, ground) - global_position if ground.is_valid() else offset
	# Pulled in, the camera tilts by the change in its elevation seen from the target, keeping the target in place.
	_camera.basis = camera_basis(_yaw, view + _elevation(_camera.position) - _elevation(offset))
	if environment != null:
		environment.fog_depth_begin = lerpf(PLAY_FOG_BEGIN_M, VISTA_FOG_BEGIN_M, t)
		environment.fog_depth_end = lerpf(PLAY_FOG_END_M, VISTA_FOG_END_M, t)


static func _elevation(offset: Vector3) -> float:
	return atan2(offset.y, Vector2(offset.x, offset.z).length())
