"""The wanderer's skeleton: the body joints (metres, Blender Z up, facing -Y, character's left = +X), the body
bone table, cloth-chain bones added by the part builders, and the posing helpers the clips use.

Angles in the posing helpers are in degrees about armature (world) axes, relative to the rest pose:
  about +X: positive tips a bone's tip toward -Y for an up-pointing bone (spine leans forward) and toward +Y
            for a down-pointing bone (a leg or arm swings back);
  about +Y: positive turns a down-pointing bone toward -X (the character's right);
  about +Z: positive turns the front (-Y) toward +X (the character's left).
"""

import math

import bpy
from mathutils import Quaternion, Vector

# ---------------------------------------------------------------- joints
HIP = Vector((0.0, 0.0, 0.95))
SPINE = Vector((0.0, 0.012, 1.12))
CHEST = Vector((0.0, 0.0, 1.3))
NECK = Vector((0.0, 0.012, 1.5))
HEAD_BASE = Vector((0.0, 0.0, 1.57))
HEAD_C = Vector((0.0, -0.008, 1.668))
HEAD_TOP = Vector((0.0, 0.0, 1.8))

THIGH = Vector((0.1, 0.0, 0.93))
KNEE = Vector((0.105, -0.02, 0.51))
ANKLE = Vector((0.11, 0.012, 0.095))
TOE = Vector((0.115, -0.135, 0.022))
CLAV = Vector((0.04, 0.0, 1.44))
SHOULDER = Vector((0.185, 0.012, 1.43))
ELBOW = Vector((0.3, 0.04, 1.17))
WRIST = Vector((0.385, 0.01, 0.95))


def side(v: Vector, s: int) -> Vector:
    return Vector((v.x * s, v.y, v.z))


THIGH_LEN = (KNEE - THIGH).length
SHIN_LEN = (ANKLE - KNEE).length

SIDES = (("L", 1), ("R", -1))


def body_bones():
    """(name, head, tail, parent) for the deforming body (plus the root)."""
    t = [
        ("root", Vector((0, 0, 0)), Vector((0, 0.2, 0)), None),
        ("hips", HIP, SPINE, "root"),
        ("spine", SPINE, CHEST, "hips"),
        ("chest", CHEST, NECK, "spine"),
        ("neck", NECK, HEAD_BASE, "chest"),
        ("head", HEAD_BASE, HEAD_TOP, "neck"),
    ]
    for sfx, s in SIDES:
        hand_dir = (side(WRIST, s) - side(ELBOW, s)).normalized()
        t += [
            (f"shoulder_{sfx}", side(CLAV, s), side(SHOULDER, s), "chest"),
            (f"upper_arm_{sfx}", side(SHOULDER, s), side(ELBOW, s), f"shoulder_{sfx}"),
            (f"forearm_{sfx}", side(ELBOW, s), side(WRIST, s), f"upper_arm_{sfx}"),
            (f"hand_{sfx}", side(WRIST, s), side(WRIST, s) + hand_dir * 0.15, f"forearm_{sfx}"),
            (f"thigh_{sfx}", side(THIGH, s), side(KNEE, s), "hips"),
            (f"shin_{sfx}", side(KNEE, s), side(ANKLE, s), f"thigh_{sfx}"),
            (f"foot_{sfx}", side(ANKLE, s), side(TOE, s), f"shin_{sfx}"),
        ]
    return t


def bone_segments():
    """{name: (head, tail)} for the deforming body bones (weights by distance)."""
    return {n: (h, t) for n, h, t, _ in body_bones() if n != "root"}


# ---------------------------------------------------------------- armature
def build_armature(chains):
    """chains: [(prefix, parent, [joint Vectors])] -> bones prefix_1 .. prefix_n."""
    arm_data = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    table = list(body_bones())
    for prefix, parent, joints in chains:
        prev = parent
        for k in range(len(joints) - 1):
            name = f"{prefix}_{k + 1}"
            table.append((name, joints[k], joints[k + 1], prev))
            prev = name
    for name, h, tl, parent in table:
        b = arm_data.edit_bones.new(name)
        b.head = Vector(h)
        b.tail = Vector(tl)
        d = Vector(tl) - Vector(h)
        b.align_roll(Vector((0, -1, 0)) if abs(d.y) < 0.9 * d.length else Vector((0, 0, 1)))
        if parent:
            b.parent = arm_data.edit_bones[parent]
            b.use_connect = (b.parent.tail - b.head).length < 1e-4
        b.use_deform = name != "root"
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig, [n for n, _, _, _ in table]


# ---------------------------------------------------------------- posing
def q(axis, deg):
    return Quaternion(Vector(axis), math.radians(deg))


def qx(d):
    return q((1, 0, 0), d)


def qy(d):
    return q((0, 1, 0), d)


def qz(d):
    return q((0, 0, 1), d)


def set_pose(rig, bone, q_world=None, loc_world=None):
    """Pose a bone with a rotation / offset in armature axes, relative to its rest (the spike's convention)."""
    pb = rig.pose.bones[bone]
    r = rig.data.bones[bone].matrix_local.to_quaternion()
    pb.rotation_mode = "QUATERNION"
    if q_world is not None:
        pb.rotation_quaternion = r.inverted() @ q_world @ r
    if loc_world is not None:
        pb.location = r.inverted() @ Vector(loc_world)


def clear_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))


def rest_angle(a: Vector, b: Vector) -> float:
    """Sagittal angle of a -> b from straight down, positive toward +Y (back), radians."""
    d = b - a
    return math.atan2(d.y, -d.z)


THIGH_A0 = rest_angle(THIGH, KNEE)
SHIN_A0 = rest_angle(KNEE, ANKLE)


def leg_ik(rig, sfx, s, hip_offset: Vector, ankle_target: Vector, foot_pitch_deg: float, splay_deg: float = 0.0):
    """Analytic two-bone IK in the sagittal plane. hip_offset moves the hip joint (the hips bone's translation);
    ankle_target is the ankle in armature space; foot_pitch_deg is the foot's world pitch (+ = toes down).
    splay_deg turns the whole leg about Y (positive = outward). Returns the reach error in metres."""
    hj = side(THIGH, s) + hip_offset
    dy = ankle_target.y - hj.y
    dz = ankle_target.z - hj.z
    L = math.hypot(dy, dz)
    reach = (THIGH_LEN + SHIN_LEN) * 0.9995
    err = max(0.0, L - reach)
    L = min(max(L, 0.25), reach)
    a_d = math.atan2(dy, -dz)
    l1, l2 = THIGH_LEN, SHIN_LEN
    alpha = math.acos(max(-1.0, min(1.0, (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L))))
    gamma = math.acos(max(-1.0, min(1.0, (l1 * l1 + l2 * l2 - L * L) / (2 * l1 * l2))))
    a_thigh = a_d - alpha  # knee forward of the hip-ankle line
    a_shin = a_thigh + (math.pi - gamma)
    d_thigh = math.degrees(a_thigh - THIGH_A0)
    d_shin_rel = math.degrees((a_shin - SHIN_A0) - (a_thigh - THIGH_A0))
    set_pose(rig, f"thigh_{sfx}", qy(-splay_deg * s) @ qx(d_thigh))
    set_pose(rig, f"shin_{sfx}", qx(d_shin_rel))
    # foot: cancel the shin's world pitch, then apply the wanted world pitch
    set_pose(rig, f"foot_{sfx}", qx(foot_pitch_deg - math.degrees(a_shin - SHIN_A0)))
    return err


def key_all(rig, frame, bones):
    for name in bones:
        pb = rig.pose.bones[name]
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)


def make_action(rig, name, frames, fn, bones):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for f in frames:
        clear_pose(rig)
        fn(f)
        key_all(rig, f, bones)
    return act
