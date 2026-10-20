class_name OgCameraRig
extends Node3D
## The tilted action-RPG camera (PLAN D4). The rig follows `target` with frame-rate independent smoothing;
## its Camera3D child sits behind the target on an orbit of yaw (0: south of the target, north up) and pitch,
## looking down along the pitch and raised by LOOK_RAISE_DEG so the top of the frame shows sky. Dragging with
## camera_orbit held turns the yaw (freely) and the play pitch (clamped); camera_left/right turn the yaw at a
## steady rate. Yaw and pitch persist for the session. Holding camera_vista eases out to a wide, high view at
## the current yaw; the mouse wheel zooms the play view. The rig also moves the depth fog with the pose so the
## streaming edge stays hidden. Moves in _physics_process (physics interpolation smooths it); runs after the
## target moves (process_physics_priority).

## Play view: the camera starts PLAY_PITCH_DEG above the target line, at the zoom distance (tunable).
const PLAY_PITCH_DEG := 30.0
const PLAY_LOOK_RAISE_DEG := 5.0
const FOV_DEG := 55.0
const PLAY_DISTANCE_M := 14.0
const ZOOM_MIN_M := 8.0
const ZOOM_MAX_M := 24.0
const ZOOM_STEP_M := 2.0
## Orbit (tunable): degrees of yaw and pitch per pixel dragged with camera_orbit held, and the camera_left/right
## yaw rate. The play pitch stays in PLAY_PITCH_MIN..MAX_DEG, a view PLAY_LOOK_RAISE_DEG less steep: 18 degrees
## below the horizon at the low end (a strip of sky shows), 60 at the high end (close to top-down).
const ORBIT_DEG_PER_PX := 0.3
const YAW_KEYS_DEG_S := 100.0
const PLAY_PITCH_MIN_DEG := 23.0
const PLAY_PITCH_MAX_DEG := 65.0
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

var _zoom_goal := PLAY_DISTANCE_M
var _zoom := PLAY_DISTANCE_M
var _vista := 0.0
## Orbit yaw (radians, turning the view left as it grows) and play pitch (degrees).
var _yaw := 0.0
var _pitch := PLAY_PITCH_DEG

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


## Jumps straight to the current goal pose (scene start, teleports, captures).
func snap() -> void:
	global_position = target.global_position
	_zoom = _zoom_goal
	_vista = _vista_goal()
	_apply()
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
	_apply()


func _apply() -> void:
	var t := smoothstep(0.0, 1.0, _vista)
	var dist := lerpf(_zoom, VISTA_DISTANCE_M, t)
	var pitch := deg_to_rad(lerpf(_pitch, VISTA_PITCH_DEG, t))
	var raise := deg_to_rad(lerpf(PLAY_LOOK_RAISE_DEG, VISTA_LOOK_RAISE_DEG, t))
	_camera.position = camera_offset(_yaw, pitch, dist)
	_camera.basis = camera_basis(_yaw, pitch - raise)
	if environment != null:
		environment.fog_depth_begin = lerpf(PLAY_FOG_BEGIN_M, VISTA_FOG_BEGIN_M, t)
		environment.fog_depth_end = lerpf(PLAY_FOG_END_M, VISTA_FOG_END_M, t)
