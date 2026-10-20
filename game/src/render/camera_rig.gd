class_name OgCameraRig
extends Node3D
## The tilted action-RPG camera (PLAN D4). The rig follows `target` with frame-rate independent smoothing;
## its Camera3D child sits behind the target on an orbit of yaw (0: south of the target, north up) and pitch,
## aimed at the target and raised by look_raise_deg(pitch) so the top of the frame shows sky. Dragging with
## camera_orbit held turns the yaw (freely) and the play pitch (clamped); camera_left/right turn the yaw at a
## steady rate. Yaw and pitch persist for the session. Below LOOK_UP_FROM_DEG the camera sinks toward the ground
## and tilts up (GOD-009): at PLAY_PITCH_MIN_DEG the view points LOW_LOOK_RAISE_DEG - PLAY_PITCH_MIN_DEG above
## the horizon and the target sits near the bottom of the frame. The camera keeps CLEAR_GROUND_M above the
## terrain under it (read through `ground`, never written) and CLEAR_TARGET_M above the target: where terrain
## would block, the arm pulls in toward a pivot ARM_PIVOT_M above the target (clear_arm) and eases back out.
## Holding camera_vista eases out to a wide, high view at the current yaw; the mouse wheel zooms the play view.
## The rig also moves the depth fog with the pose so the streaming edge stays hidden. Moves in _physics_process
## (physics interpolation smooths it); runs after the target moves (process_physics_priority).

## Play view: the camera starts PLAY_PITCH_DEG above the target line, at the zoom distance (tunable).
const PLAY_PITCH_DEG := 30.0
## Look raise (tunable): PLAY_LOOK_RAISE_DEG at and above LOOK_UP_FROM_DEG, growing along a smoothstep (no kink)
## to LOW_LOOK_RAISE_DEG at PLAY_PITCH_MIN_DEG. The target sits the raise below the frame centre, so the low raise
## stays under half the field of view (FOV_DEG / 2) with room for the feet.
const PLAY_LOOK_RAISE_DEG := 5.0
const LOOK_UP_FROM_DEG := 23.0
const LOW_LOOK_RAISE_DEG := 25.0
const FOV_DEG := 55.0
const PLAY_DISTANCE_M := 14.0
const ZOOM_MIN_M := 8.0
const ZOOM_MAX_M := 24.0
const ZOOM_STEP_M := 2.0
## Orbit (tunable): degrees of yaw and pitch per pixel dragged with camera_orbit held, and the camera_left/right
## yaw rate. The play pitch stays in PLAY_PITCH_MIN..MAX_DEG: at the low end the view looks 20 degrees above the
## horizon (mostly sky), at LOOK_UP_FROM_DEG 18 below, at the high end 60 below (close to top-down).
const ORBIT_DEG_PER_PX := 0.3
const YAW_KEYS_DEG_S := 100.0
const PLAY_PITCH_MIN_DEG := 5.0
const PLAY_PITCH_MAX_DEG := 65.0
## Terrain clearance (tunable): the camera stays CLEAR_GROUND_M above the ground under it and CLEAR_TARGET_M above
## the target. The arm pulls in toward the pivot ARM_PIVOT_M above the target (clear above its own ground), found
## by ARM_SAMPLES steps from the far end and ARM_REFINE halvings, and eases back out at ZOOM_RATE.
const CLEAR_GROUND_M := 0.6
const CLEAR_TARGET_M := 0.3
const ARM_PIVOT_M := 1.0
const ARM_SAMPLES := 16
const ARM_REFINE := 6
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
## Read-only terrain height lookup, (x: float, z: float) -> float in metres (OgChunkStore.height_at).
var ground: Callable

var _zoom_goal := PLAY_DISTANCE_M
var _zoom := PLAY_DISTANCE_M
var _vista := 0.0
## Orbit yaw (radians, turning the view left as it grows) and play pitch (degrees).
var _yaw := 0.0
var _pitch := PLAY_PITCH_DEG
## The arm's eased length as a fraction of the posed one (1: not pulled in).
var _arm := 1.0

@onready var _camera: Camera3D = $Camera3D


func _ready() -> void:
	process_physics_priority = 10
	_camera.fov = FOV_DEG


## Sets the orbit (degrees; the pitch is clamped to the play range). Call snap() after to jump there.
func set_orbit(yaw_deg: float, pitch_deg: float) -> void:
	_yaw = deg_to_rad(yaw_deg)
	_pitch = clampf(pitch_deg, PLAY_PITCH_MIN_DEG, PLAY_PITCH_MAX_DEG)


## The orbit yaw (0..360) and play pitch in degrees, for the HUD.
func orbit_deg() -> Vector2:
	return Vector2(fposmod(rad_to_deg(_yaw), 360.0), _pitch)


## The camera's basis at orbit yaw `yaw` (radians), looking `look_down` radians below the horizon.
static func camera_basis(yaw: float, look_down: float) -> Basis:
	return Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -look_down)


## The camera's offset from the target at orbit yaw `yaw` and pitch `pitch` (radians), `dist` metres away.
static func camera_offset(yaw: float, pitch: float, dist: float) -> Vector3:
	return Basis(Vector3.UP, yaw) * Vector3(0.0, sin(pitch) * dist, cos(pitch) * dist)


## The play look raise in degrees at play pitch `pitch_deg` (see LOOK_UP_FROM_DEG).
static func look_raise_deg(pitch_deg: float) -> float:
	var u := clampf((LOOK_UP_FROM_DEG - pitch_deg) / (LOOK_UP_FROM_DEG - PLAY_PITCH_MIN_DEG), 0.0, 1.0)
	return lerpf(PLAY_LOOK_RAISE_DEG, LOW_LOOK_RAISE_DEG, u * u * (3.0 - 2.0 * u))


## The camera's position with the arm pulled in to fraction `k`: on the segment from the pivot (ARM_PIVOT_M above
## `target`) to the posed position `target + offset`.
static func arm_point(target: Vector3, offset: Vector3, k: float) -> Vector3:
	var pivot := target + Vector3(0.0, ARM_PIVOT_M, 0.0)
	return pivot + (target + offset - pivot) * k


## The largest arm fraction k in [0, 1] whose arm_point clears the terrain: CLEAR_GROUND_M above
## `ground.call(x, z)` and CLEAR_TARGET_M above the target. 0 when nothing is clear (the pivot itself clears the
## ground under a target standing on it).
static func clear_arm(target: Vector3, offset: Vector3, ground: Callable) -> float:
	var hi := 1.0
	for i in ARM_SAMPLES + 1:
		var k := 1.0 - float(i) / ARM_SAMPLES
		if _is_clear(arm_point(target, offset, k), target, ground):
			if i == 0:
				return 1.0
			var lo := k
			for j in ARM_REFINE:
				var mid := (lo + hi) * 0.5
				if _is_clear(arm_point(target, offset, mid), target, ground):
					lo = mid
				else:
					hi = mid
			return lo
		hi = k
	return 0.0


static func _is_clear(p: Vector3, target: Vector3, ground: Callable) -> bool:
	return p.y >= ground.call(p.x, p.z) + CLEAR_GROUND_M and p.y >= target.y + CLEAR_TARGET_M


## Jumps straight to the current goal pose (scene start, teleports, captures).
func snap() -> void:
	global_position = target.global_position
	_zoom = _zoom_goal
	_vista = _vista_goal()
	_apply(1.0)
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
	_apply(1.0 - exp(-ZOOM_RATE * delta))


## Poses the camera; `arm_ease` is the fraction of the way the arm eases back out this call (1: jump).
func _apply(arm_ease: float) -> void:
	var t := smoothstep(0.0, 1.0, _vista)
	var dist := lerpf(_zoom, VISTA_DISTANCE_M, t)
	var pitch := deg_to_rad(lerpf(_pitch, VISTA_PITCH_DEG, t))
	var raise := deg_to_rad(lerpf(look_raise_deg(_pitch), VISTA_LOOK_RAISE_DEG, t))
	var offset := camera_offset(_yaw, pitch, dist)
	# Pull in at once where terrain blocks; ease back out like a zoom.
	var clear := clear_arm(global_position, offset, ground)
	_arm = minf(lerpf(_arm, clear, arm_ease), clear)
	_camera.position = arm_point(Vector3.ZERO, offset, _arm)
	# Aim at the target from where the camera is; on the posed arm this is the pitch itself.
	var p := _camera.position
	_camera.basis = camera_basis(_yaw, atan2(p.y, Vector2(p.x, p.z).length()) - raise)
	if environment != null:
		environment.fog_depth_begin = lerpf(PLAY_FOG_BEGIN_M, VISTA_FOG_BEGIN_M, t)
		environment.fog_depth_end = lerpf(PLAY_FOG_END_M, VISTA_FOG_END_M, t)
