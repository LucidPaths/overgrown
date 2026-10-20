"""The wanderer's clips, keyed by script at FPS frames per second.

Locomotion cycles (walk, run, sprint) share one convention so the game can blend them by phase: phase 0 is the
left heel strike with the left foot forward, phase 0.5 the right one; the game advances phase by distance
travelled / CYCLE_M (exported as clip metadata in the view's table). Feet are placed by analytic leg IK so the
stance foot stays planted at the clip's own speed.

Dodge and attack are normalised: the game maps action progress 0..1 onto the clip's length. The attack is meant
to be layered over locomotion on the upper body only (spine, chest, neck, head, arms).
"""

import math

from mathutils import Vector

from wn_rig import (ANKLE, SIDES, THIGH, leg_ik, make_action, qx, qy, qz, set_pose, side)

FPS = 60

BODY_ANIMATED = [
    "hips", "spine", "chest", "neck", "head",
    "shoulder_L", "upper_arm_L", "forearm_L", "hand_L", "thigh_L", "shin_L", "foot_L",
    "shoulder_R", "upper_arm_R", "forearm_R", "hand_R", "thigh_R", "shin_R", "foot_R",
]

# name: frames per cycle, metres per cycle (two steps), stance fraction, lift, hip drop, bob, lean, arm swing,
# elbow, pelvis yaw, twist, step width, stance offset (fwd), heel kick
LOCO = {
    "walk": dict(frames=66, dist=1.65, stance=0.6, lift=0.1, drop=0.035, bob=0.022, lean=4.0, arm=22.0, elbow=18.0,
                 yaw=7.0, twist=6.0, width=0.105, off=0.04, kick=0.0, run=False),
    "run": dict(frames=40, dist=3.333, stance=0.36, lift=0.2, drop=0.1, bob=0.04, lean=11.0, arm=38.0, elbow=78.0,
                yaw=11.0, twist=9.0, width=0.085, off=0.08, kick=0.22, run=True),
    "sprint": dict(frames=36, dist=4.8, stance=0.3, lift=0.26, drop=0.13, bob=0.05, lean=19.0, arm=52.0, elbow=88.0,
                   yaw=12.0, twist=10.0, width=0.08, off=0.0, kick=0.34, run=True),
}


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def foot_track(phi, p):
    """(fwd, height, pitch_deg) of one foot at phase phi in [0, 1) for clip params p. fwd is toward -Y."""
    beta = p["stance"]
    d_st = p["dist"] * beta
    if phi < beta:
        s = phi / beta
        fwd = p["off"] + d_st * (0.5 - s)
        h = 0.0
        pitch = 0.0
        if s < 0.12:  # heel strike: toes up, settling flat
            pitch = lerp(-12.0, 0.0, smooth(s / 0.12))
        if s > 0.62:  # roll onto the ball of the foot
            k = smooth((s - 0.62) / 0.38)
            pitch = 38.0 * k
            h = 0.12 * math.sin(math.radians(pitch))
        return fwd, h, pitch
    s = (phi - beta) / (1.0 - beta)
    e = smooth(s)
    fwd = p["off"] + d_st * (-0.5 + e)
    lift = p["lift"] * math.sin(math.pi * min(1.0, s * 1.05)) ** 0.9
    # heel kick: the foot rises behind early in the swing (runs)
    kick = p["kick"] * math.sin(math.pi * min(1.0, s / 0.55)) if s < 0.55 else 0.0
    h = max(lift, kick)
    fwd -= kick * 0.35
    pitch = lerp(38.0, -12.0, smooth((s - 0.15) / 0.85)) if s > 0.15 else 38.0
    return fwd, h, pitch


def locomotion(rig, p):
    n = p["frames"]

    def pose(f):
        phi = (f % n) / n
        w = 2 * math.pi * phi
        if p["run"]:
            mid = p["stance"] / 2
            hz = -p["drop"] - p["bob"] * math.cos(4 * math.pi * (phi - mid))
        else:
            hz = -p["drop"] - p["bob"] * math.cos(4 * math.pi * phi)
        hip = Vector((0, 0, hz))
        yaw = -p["yaw"] * math.cos(w)
        roll = 2.5 * math.sin(2 * w) * (0.5 if p["run"] else 1.0)
        set_pose(rig, "hips", qz(yaw) @ qy(roll), hip)
        for sfx, s in SIDES:
            ph = phi if sfx == "L" else (phi + 0.5) % 1.0
            fwd, h, pitch = foot_track(ph, p)
            tgt = Vector((side(ANKLE, s).x * 0 + p["width"] * s, -fwd + ANKLE.y, ANKLE.z + h))
            leg_ik(rig, sfx, s, hip, tgt, pitch, splay_deg=1.5)
        lean = p["lean"]
        set_pose(rig, "spine", qz(-yaw * 0.5) @ qx(lean * 0.45 + 1.5 * math.sin(4 * math.pi * phi)))
        set_pose(rig, "chest", qz(-yaw * 0.6 - p["twist"] * math.cos(w) * 0.3) @ qx(lean * 0.35))
        set_pose(rig, "neck", qx(-lean * 0.4))
        set_pose(rig, "head", qz(yaw * 0.5) @ qx(-lean * 0.3 + 1.0 * math.sin(4 * math.pi * phi + 0.6)))
        for sfx, s in SIDES:
            c = math.cos(w) if sfx == "L" else -math.cos(w)  # +1: this arm back (its leg is forward)
            swing = p["arm"] * c + (6.0 if p["run"] else 2.0)
            el = p["elbow"] + (12.0 if p["run"] else 10.0) * max(0.0, -c)
            set_pose(rig, f"shoulder_{sfx}", qx(-3.0 * c))
            set_pose(rig, f"upper_arm_{sfx}", qx(swing) @ qy(10.0 * s))
            set_pose(rig, f"forearm_{sfx}", qx(-el))
            set_pose(rig, f"hand_{sfx}", qx(-8.0))

    return make_action(rig, p["name"], range(0, n + 1), pose, BODY_ANIMATED)


IDLE_FRAMES = 240


def idle(rig):
    n = IDLE_FRAMES

    def pose(f):
        t = f / n
        w = 2 * math.pi * t
        br = math.sin(2 * w)  # two breaths per loop
        sway = math.sin(w)
        hip = Vector((0.012 * sway, 0.0, -0.022 + 0.004 * br))
        set_pose(rig, "hips", qy(1.5 * sway) @ qz(3.0), hip)
        for sfx, s in SIDES:
            tgt = Vector((0.125 * s, ANKLE.y + (-0.06 if sfx == "L" else 0.05), ANKLE.z))
            leg_ik(rig, sfx, s, hip, tgt, 0.0, splay_deg=3.0)
        set_pose(rig, "spine", qx(1.0 - 1.2 * br) @ qz(-2.0))
        set_pose(rig, "chest", qx(-1.5 * br) @ qy(-1.0 * sway))
        set_pose(rig, "neck", qx(-2.0))
        # a slow look out over the world: up a little, to one side, back
        look = math.sin(w + 0.8)
        set_pose(rig, "head", qz(9.0 * look) @ qx(-5.0 + 2.0 * math.sin(2 * w + 1.0)))
        for sfx, s in SIDES:
            set_pose(rig, f"shoulder_{sfx}", qx(-1.0 * br) @ qy(1.0 * br * s))
            set_pose(rig, f"upper_arm_{sfx}", qx(3.0 + 1.5 * br) @ qy((9.0 + 1.5 * br) * s))
            set_pose(rig, f"forearm_{sfx}", qx(-16.0 - 2.0 * br))
            set_pose(rig, f"hand_{sfx}", qx(-10.0) @ qz(6.0 * s))

    return make_action(rig, "idle", range(0, n + 1), pose, BODY_ANIMATED)


DODGE_FRAMES = 21  # 0.35 s at 60 fps, normalised by the game anyway


def dodge(rig):
    """A low dash: the wanderer drops into a long glide, cloak streaming, then rises. Full size throughout."""
    n = DODGE_FRAMES
    # keyed poses: p, hip drop, lean, lead foot fwd, trail foot fwd, lead height, trail height, arm back, elbow
    keys = [
        (0.0, 0.06, 10.0, 0.25, -0.25, 0.0, 0.05, 15.0, 40.0),
        (0.18, 0.3, 38.0, 0.48, -0.62, 0.0, 0.1, 60.0, 15.0),
        (0.62, 0.32, 40.0, 0.4, -0.7, 0.02, 0.08, 64.0, 12.0),
        (1.0, 0.08, 12.0, 0.18, -0.2, 0.0, 0.03, 18.0, 35.0),
    ]

    def at(p):
        for k in range(len(keys) - 1):
            a, b = keys[k], keys[k + 1]
            if p <= b[0]:
                t = smooth((p - a[0]) / (b[0] - a[0]))
                return [lerp(a[i], b[i], t) for i in range(1, len(a))]
        return list(keys[-1][1:])

    def pose(f):
        p = f / n
        drop, lean, lead, trail, lh, th, arm, el = at(p)
        hip = Vector((0, 0.04 * lean / 40.0, -drop))
        set_pose(rig, "hips", qz(-10.0 * lean / 40.0), hip)
        leg_ik(rig, "L", 1, hip, Vector((0.13, ANKLE.y - lead, ANKLE.z + lh)), -8.0 * lean / 40.0, splay_deg=4.0)
        leg_ik(rig, "R", -1, hip, Vector((-0.12, ANKLE.y - trail, ANKLE.z + th)), 50.0 * lean / 40.0, splay_deg=4.0)
        set_pose(rig, "spine", qx(lean * 0.55) @ qz(6.0 * lean / 40.0))
        set_pose(rig, "chest", qx(lean * 0.4) @ qz(4.0 * lean / 40.0))
        set_pose(rig, "neck", qx(-lean * 0.35))
        set_pose(rig, "head", qx(-lean * 0.35))
        for sfx, s in SIDES:
            set_pose(rig, f"shoulder_{sfx}", qx(4.0 * lean / 40.0))
            set_pose(rig, f"upper_arm_{sfx}", qx(arm + (6.0 if sfx == "R" else -4.0)) @ qy((14.0 + 10.0 * lean / 40.0) * s))
            set_pose(rig, f"forearm_{sfx}", qx(-el))
            set_pose(rig, f"hand_{sfx}", qx(10.0 * lean / 40.0))

    return make_action(rig, "dodge", range(0, n + 1), pose, BODY_ANIMATED)


ATTACK_FRAMES = 24  # 0.4 s at 60 fps; normalised by the game
# The right palm sweeps from the left shoulder out across the front to the right: the swing window, in
# progress, is ATTACK_SWING (the view's arc follows it).
ATTACK_SWING = (0.16, 0.42)


def attack(rig):
    n = ATTACK_FRAMES
    # p, twist (chest+spine, + = toward the left), R arm forward raise, R arm across(+)/out(-), R elbow,
    # L arm swing back, lean, head counter
    keys = [
        (0.0, 0.0, 0.0, 0.0, 16.0, 0.0, 2.0),
        (0.16, 34.0, -95.0, 55.0, 110.0, -10.0, -2.0),
        (0.3, 0.0, -88.0, 0.0, 25.0, 18.0, 8.0),
        (0.42, -32.0, -78.0, -48.0, 6.0, 30.0, 10.0),
        (0.62, -26.0, -66.0, -40.0, 12.0, 24.0, 7.0),
        (1.0, 0.0, 0.0, 0.0, 16.0, 0.0, 2.0),
    ]

    def at(p):
        for k in range(len(keys) - 1):
            a, b = keys[k], keys[k + 1]
            if p <= b[0]:
                t = (p - a[0]) / (b[0] - a[0])
                # the strike segments are fast-in; the recovery eases
                t = smooth(t) if k >= 3 or k == 0 else 1.0 - (1.0 - t) ** 2
                return [lerp(a[i], b[i], t) for i in range(1, len(a))]
        return list(keys[-1][1:])

    def pose(f):
        p = f / n
        tw, raise_, across, el, lback, lean = at(p)
        hip = Vector((0, 0, -0.03))
        set_pose(rig, "hips", qz(tw * 0.15), hip)
        for sfx, s in SIDES:
            tgt = Vector((0.13 * s, ANKLE.y + (-0.1 if sfx == "R" else 0.08), ANKLE.z))
            leg_ik(rig, sfx, s, hip, tgt, 0.0, splay_deg=4.0)
        set_pose(rig, "spine", qz(tw * 0.4) @ qx(lean * 0.6))
        set_pose(rig, "chest", qz(tw * 0.45) @ qx(lean * 0.4))
        set_pose(rig, "neck", qz(-tw * 0.35))
        set_pose(rig, "head", qz(-tw * 0.35) @ qx(-lean * 0.5))
        # right arm (s = -1): raise forward about X, then across (toward +X) or out (toward -X) about Z
        set_pose(rig, "shoulder_R", qz(across * 0.12) @ qx(raise_ * 0.08))
        set_pose(rig, "upper_arm_R", qz(-across) @ qx(raise_) @ qy(-12.0))
        set_pose(rig, "forearm_R", qx(-el))
        set_pose(rig, "hand_R", qx(10.0 - 30.0 * min(1.0, abs(across) / 50.0)))
        set_pose(rig, "upper_arm_L", qx(lback) @ qy(18.0))
        set_pose(rig, "forearm_L", qx(-30.0 - lback * 0.5))
        set_pose(rig, "hand_L", qx(-10.0))

    return make_action(rig, "attack", range(0, n + 1), pose, BODY_ANIMATED)


def build_all(rig):
    acts = []
    for name, p in LOCO.items():
        acts.append(locomotion(rig, dict(p, name=name)))
    acts.append(idle(rig))
    acts.append(dodge(rig))
    acts.append(attack(rig))
    rig.animation_data.action = acts[3]  # idle
    return acts
