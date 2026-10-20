class_name OgWandererRig
extends Node3D
## The Blender-built wanderer (ART-028, art/blender/wanderer.py): the skinned model, its clips blended by hand,
## and verlet chains for the robe, the poncho cape, the scarf tails and the hair. Presentation only: it knows
## nothing about the rules. A driver (OgWandererView, or a studio script) sets the inputs below each frame and
## calls advance(delta) from _process.
##
## Pose: idle, walk, run and sprint blend by ground speed, their phase advanced by distance so the stance foot
## stays planted; the attack is layered over the upper body (it works over any locomotion); the dodge overrides
## the whole body. Faces -Z (the model is turned to Godot's forward).
##
## Cloth: each chain is a row of particles hanging from an animated bone, simulated in a frame that moves with the
## character but keeps world orientation, so turning swings the cloth. Each 60 Hz step: inertia, gravity, air drag
## against (wind - body velocity - particle velocity), a pull back toward the animated rest shape, fixed segment
## lengths, an angle limit and pushes out of body capsules. The bones are then turned to follow the particles.

const MODEL := preload("res://assets/wanderer/wanderer.glb")
const ALBEDO := preload("res://assets/wanderer/wanderer_albedo.png")
const SHADER := preload("res://src/render/wanderer.gdshader")

enum Act { NONE, ATTACK, DODGE }

## Locomotion clips: metres travelled per cycle (art/blender/wn_anim.py LOCO); their natural speed is that over
## the clip length.
const CYCLE_M := {"walk": 1.4, "run": 2.8333, "sprint": 4.0}
## Ground speed at which each clip plays alone (m/s); between two, both blend.
const WALK_SPEED := 1.27
const RUN_SPEED := 5.0
const SPRINT_SPEED := 8.0
## Below this ground speed the idle pose fades in.
const IDLE_BELOW := 0.9
## The attack's palm-sweep window in its progress (art/blender/wn_anim.py ATTACK_SWING).
const ATTACK_SWING := Vector2(0.16, 0.42)
## Upper-body layer weights for the attack, by bone.
const ATTACK_MASK := {"hips": 0.25, "spine": 0.65, "chest": 1.0, "neck": 1.0, "head": 1.0,
	"shoulder_L": 1.0, "upper_arm_L": 1.0, "forearm_L": 1.0, "hand_L": 1.0,
	"shoulder_R": 1.0, "upper_arm_R": 1.0, "forearm_R": 1.0, "hand_R": 1.0}
## Strafing: the hips turn toward the movement (up to this), the chest turns back to the facing.
const STRAFE_MAX_DEG := 65.0

## Cloth (per chain kind): gravity scale, air drag (1/s), damping per step, pull to the rest shape per step
## (root to tip), max bend from the rest direction (degrees), collision groups.
const CLOTH := {
	"robe": {"g": 1.0, "air": 1.6, "damp": 0.06, "stiff": [0.02, 0.012, 0.008], "limit": 70.0, "groups": ["legs", "pelvis"]},
	"cape": {"g": 1.0, "air": 2.0, "damp": 0.08, "stiff": [0.03, 0.015], "limit": 62.0, "groups": ["arms", "torso"]},
	"hair": {"g": 0.35, "air": 3.2, "damp": 0.1, "stiff": [0.04, 0.025, 0.015], "limit": 80.0, "groups": ["head"]},
	"scarf": {"g": 1.0, "air": 3.4, "damp": 0.05, "stiff": [0.008, 0.006, 0.005, 0.004], "limit": 130.0, "groups": ["back"]},
}
const STEP_S := 1.0 / 60.0
const MAX_STEPS := 10
const GRAVITY := Vector3(0.0, -9.8, 0.0)

# ---------------------------------------------------------------- inputs (set by the driver every frame)
## Ground speed in m/s (measured motion, not intent).
var ground_speed := 0.0
## Movement direction in the rig's own frame (x right, y forward); zero when not moving.
var move_local := Vector2.ZERO
## The body's velocity in world space (m/s): the cloth feels it as air.
var body_velocity := Vector3.ZERO
## Wind in world space (m/s).
var wind := Vector3(2.2, 0.0, -0.8)
var action := Act.NONE
## Progress of the action, 0..1.
var action_progress := 0.0

# ---------------------------------------------------------------- state
var skeleton: Skeleton3D
var mesh: MeshInstance3D
var _material := ShaderMaterial.new()
var _model: Node3D
var _clips := {} # name -> {"anim": Animation, "tracks": [[track, slot, is_rot]]}
var _body: PackedInt32Array = [] # bone index per body slot
var _slot_of := {} # bone name -> body slot
var _rest_rot: Array[Quaternion] = []
var _rest_pos: Array[Vector3] = []
var _phase := 0.0
var _idle_t := 0.0
var _time := 0.0
var _chains: Array[Dictionary] = []
var _capsules: Array = [] # [bone_a, bone_b, radius, group, extend]
var _acc := 0.0
var _last_body_velocity := Vector3.ZERO
var _cloth_ready := false
var _frame_origin := Vector3.ZERO


func _init() -> void:
	_model = MODEL.instantiate()
	# The model faces +Z (glTF); Godot's forward is -Z.
	_model.rotation.y = PI
	add_child(_model)
	skeleton = _model.find_children("*", "Skeleton3D", true, false)[0]
	mesh = _model.find_children("*", "MeshInstance3D", true, false)[0]
	var player: AnimationPlayer = _model.find_children("*", "AnimationPlayer", true, false)[0]
	_material.shader = SHADER
	_material.set_shader_parameter("albedo_tex", ALBEDO)
	mesh.material_override = _material
	_read_clips(player)
	player.get_parent().remove_child(player)
	player.free()
	_find_chains()
	_define_capsules()


func _read_clips(player: AnimationPlayer) -> void:
	for clip_name in player.get_animation_list():
		var anim := player.get_animation(clip_name)
		var tracks := []
		for t in anim.get_track_count():
			var path := String(anim.track_get_path(t))
			var bone := skeleton.find_bone(path.get_slice(":", 1))
			var kind := anim.track_get_type(t)
			if bone < 0 or (kind != Animation.TYPE_ROTATION_3D and kind != Animation.TYPE_POSITION_3D):
				continue
			var bname := skeleton.get_bone_name(bone)
			if not _slot_of.has(bname):
				_slot_of[bname] = _body.size()
				_body.append(bone)
				var rest := skeleton.get_bone_rest(bone)
				_rest_rot.append(rest.basis.get_rotation_quaternion())
				_rest_pos.append(rest.origin)
			tracks.append([t, _slot_of[bname], kind == Animation.TYPE_ROTATION_3D])
		_clips[String(clip_name)] = {"anim": anim, "tracks": tracks}


## Is every clip and chain the view relies on present? (A test guards the build script's names.)
func missing_parts() -> PackedStringArray:
	var out := PackedStringArray()
	for n in ["idle", "walk", "run", "sprint", "dodge", "attack"]:
		if not _clips.has(n):
			out.append("clip " + n)
	for kind in CLOTH:
		if not _chains.any(func(c: Dictionary) -> bool: return c["kind"] == kind):
			out.append("chains " + kind)
	return out


func chain_count() -> int:
	return _chains.size()


# ---------------------------------------------------------------- per frame
func advance(delta: float) -> void:
	_time += delta
	_idle_t += delta
	_pose_body(delta)
	_cloth(delta)


func _sample(clip_name: String, time: float, rot: Array[Quaternion], pos: Array[Vector3], loop := true) -> void:
	var c: Dictionary = _clips[clip_name]
	var anim: Animation = c["anim"]
	var t := fposmod(time, anim.length) if loop else clampf(time, 0.0, anim.length)
	for tr in c["tracks"]:
		if tr[2]:
			rot[tr[1]] = anim.rotation_track_interpolate(tr[0], t)
		else:
			pos[tr[1]] = anim.position_track_interpolate(tr[0], t)


func _rest_arrays() -> Array:
	var r: Array[Quaternion] = _rest_rot.duplicate()
	var p: Array[Vector3] = _rest_pos.duplicate()
	return [r, p]


func _blend_into(dst: Array, src: Array, w: float, mask: Dictionary = {}) -> void:
	if w <= 0.0:
		return
	var dr: Array[Quaternion] = dst[0]
	var dp: Array[Vector3] = dst[1]
	var sr: Array[Quaternion] = src[0]
	var sp: Array[Vector3] = src[1]
	for s in _body.size():
		var k := w
		if not mask.is_empty():
			k *= float(mask.get(skeleton.get_bone_name(_body[s]), 0.0))
			if k <= 0.0:
				continue
		dr[s] = dr[s].slerp(sr[s], k)
		dp[s] = dp[s].lerp(sp[s], k)


func _clip_len(n: String) -> float:
	return (_clips[n]["anim"] as Animation).length


func _pose_body(delta: float) -> void:
	var speed := ground_speed
	# Which two locomotion clips, and how far between them.
	var a := "walk"
	var b := "run"
	var t := 0.0
	if speed <= WALK_SPEED:
		t = 0.0
	elif speed <= RUN_SPEED:
		t = (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)
	else:
		a = "run"
		b = "sprint"
		t = clampf((speed - RUN_SPEED) / (SPRINT_SPEED - RUN_SPEED), 0.0, 1.0)
	var cycle := lerpf(CYCLE_M[a], CYCLE_M[b], t)
	# Moving backward (strafing away from the facing) plays the cycle in reverse.
	var backward := move_local.y < -0.35 * move_local.length()
	_phase = fposmod(_phase + (-1.0 if backward else 1.0) * speed * delta / cycle, 1.0)

	var pose := _rest_arrays()
	_sample("idle", _idle_t, pose[0], pose[1])
	var moving := smoothstep(0.05, IDLE_BELOW, speed)
	if moving > 0.0:
		var pa := _rest_arrays()
		_sample(a, _phase * _clip_len(a), pa[0], pa[1])
		if t > 0.0:
			var pb := _rest_arrays()
			_sample(b, _phase * _clip_len(b), pb[0], pb[1])
			_blend_into(pa, pb, t)
		_blend_into(pose, pa, moving)

	if action == Act.ATTACK:
		var p := clampf(action_progress, 0.0, 1.0)
		var w := smoothstep(0.0, 0.06, p) * (1.0 - smoothstep(0.82, 1.0, p))
		var pk := _rest_arrays()
		_sample("attack", p * _clip_len("attack"), pk[0], pk[1], false)
		_blend_into(pose, pk, w, ATTACK_MASK)
	elif action == Act.DODGE:
		var p := clampf(action_progress, 0.0, 1.0)
		var w := smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.86, 1.0, p))
		var pk := _rest_arrays()
		_sample("dodge", p * _clip_len("dodge"), pk[0], pk[1], false)
		_blend_into(pose, pk, w)

	var rot: Array[Quaternion] = pose[0]
	var pos: Array[Vector3] = pose[1]
	for s in _body.size():
		skeleton.set_bone_pose_rotation(_body[s], rot[s])
		skeleton.set_bone_pose_position(_body[s], pos[s])
	_strafe(speed)


## Turns the hips toward the movement and the chest back toward the facing (attacking while strafing).
func _strafe(speed: float) -> void:
	if speed < 0.3 or move_local == Vector2.ZERO or action == Act.DODGE:
		return
	var ang := atan2(-move_local.x, move_local.y) # + = moving to the left of the facing
	if absf(ang) > PI * 0.6:
		ang = ang - signf(ang) * PI # backward: turn toward the reversed direction
	ang = clampf(ang, -deg_to_rad(STRAFE_MAX_DEG), deg_to_rad(STRAFE_MAX_DEG)) * smoothstep(0.3, 1.5, speed)
	if absf(ang) < 0.01:
		return
	# The model is turned by PI, so the rig's up is the skeleton's up and angles keep their sign.
	_turn_bone("hips", ang)
	_turn_bone("spine", -ang * 0.45)
	_turn_bone("chest", -ang * 0.55)


func _turn_bone(bname: String, ang: float) -> void:
	var b := skeleton.find_bone(bname)
	var parent := skeleton.get_bone_parent(b)
	var pg := skeleton.get_bone_global_pose(parent).basis if parent >= 0 else Basis.IDENTITY
	var q_local := Basis(pg.inverse() * Basis(Vector3.UP, ang) * pg)
	skeleton.set_bone_pose_rotation(b, (q_local * Basis(skeleton.get_bone_pose_rotation(b))).get_rotation_quaternion())


# ---------------------------------------------------------------- cloth
func _find_chains() -> void:
	var re := RegEx.create_from_string("^(robe|cape|hair|scarf)_(\\d+)_(\\d+)$")
	var groups := {}
	for b in skeleton.get_bone_count():
		var m := re.search(skeleton.get_bone_name(b))
		if m == null:
			continue
		var key := m.get_string(1) + "_" + m.get_string(2)
		if not groups.has(key):
			groups[key] = {"kind": m.get_string(1), "bones": {}}
		groups[key]["bones"][m.get_string(3).to_int()] = b
	var keys := groups.keys()
	keys.sort()
	for key in keys:
		var g: Dictionary = groups[key]
		var idx: Array = g["bones"].keys()
		idx.sort()
		var bones := PackedInt32Array()
		for i in idx:
			bones.append(g["bones"][i])
		# Rest joints in skeleton space; the tip extends the last bone by the previous segment's length.
		var joints: Array[Vector3] = []
		for bi in bones:
			joints.append(skeleton.get_bone_global_rest(bi).origin)
		var n := joints.size()
		var last_dir := (joints[n - 1] - joints[n - 2]).normalized() if n > 1 else Vector3.DOWN
		var seg := (joints[n - 1] - joints[n - 2]).length() if n > 1 else 0.1
		var tip := joints[n - 1] + last_dir * seg
		joints.append(tip)
		var lens := PackedFloat32Array()
		for k in n:
			lens.append(joints[k + 1].distance_to(joints[k]))
		# Each bone's child joint in the bone's own rest frame (to aim it).
		var child_local: Array[Vector3] = []
		for k in n:
			child_local.append(skeleton.get_bone_global_rest(bones[k]).affine_inverse() * joints[k + 1])
		_chains.append({"kind": g["kind"], "name": key, "bones": bones, "parent": skeleton.get_bone_parent(bones[0]),
			"lens": lens, "child_local": child_local, "p": [], "prev": [], "target": [], "phase": float(_chains.size()) * 1.37})


func _define_capsules() -> void:
	# [from bone, to bone (or -1: extend the from bone's own direction by `extend`), radius, group]
	var defs := [
		["thigh_L", "shin_L", 0.1, "legs"], ["thigh_R", "shin_R", 0.1, "legs"],
		["shin_L", "foot_L", 0.075, "legs"], ["shin_R", "foot_R", 0.075, "legs"],
		["hips", "spine", 0.17, "pelvis"],
		["upper_arm_L", "forearm_L", 0.075, "arms"], ["upper_arm_R", "forearm_R", 0.075, "arms"],
		["forearm_L", "hand_L", 0.085, "arms"], ["forearm_R", "hand_R", 0.085, "arms"],
		["spine", "neck", 0.15, "torso"],
		["neck", "head", 0.13, "head"], ["head", "", 0.125, "head"],
		["spine", "neck", 0.25, "back"],
	]
	for d in defs:
		_capsules.append([skeleton.find_bone(d[0]), skeleton.find_bone(d[1]) if d[1] != "" else -1, d[2], d[3]])


func _skeleton_xf() -> Transform3D:
	if skeleton.is_inside_tree():
		return skeleton.get_global_transform_interpolated()
	return _model.transform * skeleton.transform


func _capsule_points(xf: Transform3D, origin: Vector3) -> Array:
	var out := []
	for c in _capsules:
		var a := skeleton.get_bone_global_pose(c[0]).origin
		var b: Vector3
		if c[1] >= 0:
			b = skeleton.get_bone_global_pose(c[1]).origin
		else:
			var parent := skeleton.get_bone_parent(c[0])
			var dir := (a - skeleton.get_bone_global_pose(parent).origin).normalized()
			b = a + dir * 0.13
		out.append([xf * a - origin, xf * b - origin, c[2], c[3]])
	return out


func _cloth(delta: float) -> void:
	var xf := _skeleton_xf()
	var origin := xf.origin
	var shift := origin - _frame_origin # frame motion since last frame (particles are kept relative to it)
	_frame_origin = origin
	# Animated rest targets: cloth bones at their rest local poses under the animated parents.
	for ch in _chains:
		for bi in ch["bones"]:
			skeleton.set_bone_pose_rotation(bi, skeleton.get_bone_rest(bi).basis.get_rotation_quaternion())
	var prev_targets := []
	for ch in _chains:
		prev_targets.append(ch["target"])
		var tg: Array[Vector3] = []
		var bones: PackedInt32Array = ch["bones"]
		var g := skeleton.get_bone_global_pose(ch["parent"])
		for k in bones.size():
			g = g * skeleton.get_bone_rest(bones[k])
			tg.append(xf * g.origin - origin)
		g = skeleton.get_bone_global_pose(ch["parent"])
		for k in bones.size():
			g = g * skeleton.get_bone_rest(bones[k])
		tg.append(xf * (g * ch["child_local"][bones.size() - 1]) - origin)
		ch["target"] = tg
	var caps := _capsule_points(xf, origin)
	if not _cloth_ready or shift.length() > 3.0:
		for ch in _chains:
			ch["p"] = (ch["target"] as Array).duplicate()
			ch["prev"] = (ch["target"] as Array).duplicate()
		_cloth_ready = true
		_last_body_velocity = body_velocity
		_write_chains(xf, origin)
		return
	# Steps at 60 Hz; the anchors move linearly across the frame's steps.
	_acc = minf(_acc + delta, STEP_S * MAX_STEPS)
	var steps := 0
	while _acc >= STEP_S:
		_acc -= STEP_S
		steps += 1
	if steps > 0:
		var accel := (body_velocity - _last_body_velocity) / (STEP_S * steps)
		_last_body_velocity = body_velocity
		for s in steps:
			var alpha := float(s + 1) / steps
			for ci in _chains.size():
				_step_chain(_chains[ci], prev_targets[ci], alpha, accel, caps)
	_write_chains(xf, origin)


func _step_chain(ch: Dictionary, prev_target: Array, alpha: float, accel: Vector3, caps: Array) -> void:
	var cfg: Dictionary = CLOTH[ch["kind"]]
	var p: Array = ch["p"]
	var prev: Array = ch["prev"]
	var tg: Array = ch["target"]
	var lens: PackedFloat32Array = ch["lens"]
	var stiff: Array = cfg["stiff"]
	var n := p.size()
	var dt := STEP_S
	# Gusts and a per-chain flutter so the chains don't move in lockstep.
	var ph: float = ch["phase"]
	var gust := 1.0 + 0.35 * sin(_time * 0.9 + ph * 0.2) + 0.2 * sin(_time * 2.3 + ph)
	var flutter := Vector3(sin(_time * 7.1 + ph * 2.0), sin(_time * 5.3 + ph) * 0.5, cos(_time * 6.2 + ph * 1.3)) * 0.8
	var air_world := wind * gust + flutter * wind.length() * 0.35 - body_velocity
	var anchor: Vector3 = tg[0] if prev_target.is_empty() else (prev_target[0] as Vector3).lerp(tg[0], alpha)
	p[0] = anchor
	prev[0] = anchor
	for k in range(1, n):
		var cur: Vector3 = p[k]
		var v: Vector3 = (cur - prev[k]) * (1.0 - cfg["damp"])
		prev[k] = cur
		var vel := v / dt
		var a: Vector3 = GRAVITY * cfg["g"] + (air_world - vel) * cfg["air"] - accel
		cur += v + a * dt * dt
		var target_k: Vector3 = tg[k] if prev_target.is_empty() else (prev_target[k] as Vector3).lerp(tg[k], alpha)
		cur = cur.lerp(target_k, stiff[mini(k - 1, stiff.size() - 1)])
		p[k] = cur
	var limit := deg_to_rad(cfg["limit"])
	var groups: Array = cfg["groups"]
	for it in 2:
		for k in range(1, n):
			var base: Vector3 = p[k - 1]
			var d: Vector3 = p[k] - base
			var td: Vector3 = (tg[k] as Vector3) - (tg[k - 1] as Vector3)
			var len := lens[k - 1]
			if d.length_squared() < 1e-12:
				d = td
			var dn := d.normalized()
			var tdn := td.normalized()
			var ang := dn.angle_to(tdn)
			if ang > limit:
				dn = tdn.slerp(dn, limit / ang).normalized()
			var q: Vector3 = base + dn * len
			for c in caps:
				if not groups.has(c[3]):
					continue
				q = _push_out(q, c[0], c[1], c[2])
			# keep the length after the pushes
			p[k] = base + (q - base).normalized() * len


static func _push_out(p: Vector3, a: Vector3, b: Vector3, r: float) -> Vector3:
	var ab := b - a
	var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-9), 0.0, 1.0)
	var c := a + ab * t
	var d := p - c
	var l := d.length()
	if l >= r:
		return p
	if l < 1e-6:
		return c + Vector3.UP * r
	return c + d * (r / l)


func _write_chains(xf: Transform3D, origin: Vector3) -> void:
	var inv := xf.affine_inverse()
	for ch in _chains:
		var bones: PackedInt32Array = ch["bones"]
		var p: Array = ch["p"]
		var g := skeleton.get_bone_global_pose(ch["parent"])
		for k in bones.size():
			var b := bones[k]
			var parent_basis := g.basis
			g = g * skeleton.get_bone_rest(b)
			var have: Vector3 = (g * (ch["child_local"][k] as Vector3)) - g.origin
			var want := (inv * ((p[k + 1] as Vector3) + origin)) - (inv * ((p[k] as Vector3) + origin))
			if have.length_squared() < 1e-12 or want.length_squared() < 1e-12:
				continue
			var q := Quaternion(have.normalized(), want.normalized())
			var nb := Basis(q) * g.basis
			g = Transform3D(nb, g.origin)
			skeleton.set_bone_pose_rotation(b, (parent_basis.inverse() * nb).get_rotation_quaternion())
