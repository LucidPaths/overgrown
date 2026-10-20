"""The wanderer (ART-028): modelled, textured, rigged and animated in code, exported as one glTF binary.

Run through art/blender/build.sh (one command), or directly:
    blender --background --factory-startup --python art/blender/wanderer.py -- \
        --glb game/assets/wanderer/wanderer.glb --png game/assets/wanderer/wanderer_albedo.png [--blend out.blend]

Conventions: metres, Blender Z up, the character faces -Y (glTF and Godot +Z), feet on z = 0, the character's
left is +X. Everything is authored here; nothing is downloaded.

Parts (one joined mesh, one material): a Skin-modifier body (hidden mostly; legs, sleeves and neck show), boots,
gloves, woven cuffs, a faceless head with a starry void face, a lumpy hair cap and wind-blown locks, a chunky
three-wrap gold scarf with two tails, the poncho cape over the shoulders and the long robe beneath it (open at
the front below the waist). Cloth, hair and scarf tails hang on bone chains that the game simulates.
"""

import math
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import wn_anim as A  # noqa: E402
import wn_mesh as M  # noqa: E402
import wn_paint as paint  # noqa: E402
import wn_rig as R  # noqa: E402
from wn_rig import SIDES, side  # noqa: E402

T0 = time.perf_counter()


def log(msg):
    print(f"[wanderer {time.perf_counter() - T0:6.2f}s] {msg}", flush=True)


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = {"glb": "game/assets/wanderer/wanderer.glb", "png": "game/assets/wanderer/wanderer_albedo.png", "blend": ""}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


def sstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def tent_weights(f, n_bones, prefix, base_bone, base_share=0.5):
    """Skin weights along a chain: f in [0, n_bones] (joint units from the root). Each bone peaks at its middle;
    near the root the parent (base_bone) takes over."""
    w = {}
    for b in range(n_bones):
        x = max(0.0, 1.0 - abs(f - (b + 0.5)))
        if x > 0:
            w[f"{prefix}_{b + 1}"] = x
    if f < 0.5:
        w[base_bone] = w.get(base_bone, 0.0) + (0.5 - f) * 2.0 * base_share + 1e-6
    return w


def blend(*parts):
    """blend((weight_dict, share), ...) -> one dict."""
    out = {}
    for wd, share in parts:
        tot = sum(wd.values())
        if tot <= 0 or share <= 0:
            continue
        for k in sorted(wd):
            out[k] = out.get(k, 0.0) + wd[k] / tot * share
    return out


# ---------------------------------------------------------------- body weights (envelopes)
SEGS = R.bone_segments()


def body_weight(co, allowed=None, k=3, power=4.0):
    cands = []
    for name in sorted(SEGS):
        if allowed is not None and name not in allowed:
            continue
        if name.endswith("_L") and co.x < -0.015:
            continue
        if name.endswith("_R") and co.x > 0.015:
            continue
        h, t = SEGS[name]
        d = (co - M.seg_closest(co, h, t)).length
        cands.append((d, name))
    cands.sort()
    return {n: 1.0 / max(d, 0.012) ** power for d, n in cands[:k]}


def capsules():
    caps = []
    for _, s in SIDES:
        caps += [
            (side(R.SHOULDER, s), side(R.SHOULDER, s), 0.078),
            (side(R.SHOULDER, s), side(R.ELBOW, s), 0.062),
            (side(R.ELBOW, s), side(R.WRIST, s), 0.052),
            (side(R.THIGH, s), side(R.KNEE, s), 0.1),
            (side(R.KNEE, s), side(R.ANKLE, s), 0.072),
            (Vector((0.055 * s, 0.0, 0.98)), Vector((0.055 * s, 0.0, 1.36)), 0.115),
        ]
    caps.append((R.NECK, R.HEAD_BASE, 0.065))
    return caps


CAPS = capsules()


def smooth_grid(P, wrap_i, iters, fix_top=True, fac=0.5):
    ni, nj = len(P), len(P[0])
    for _ in range(iters):
        Q = [[p.copy() for p in row] for row in P]
        for i in range(ni):
            for j in range(nj):
                if fix_top and j == 0:
                    continue
                nb = []
                if wrap_i or i > 0:
                    nb.append(P[(i - 1) % ni][j])
                if wrap_i or i < ni - 1:
                    nb.append(P[(i + 1) % ni][j])
                if j > 0:
                    nb.append(P[i][j - 1])
                if j < nj - 1:
                    nb.append(P[i][j + 1])
                avg = sum(nb, Vector()) / len(nb)
                Q[i][j] = P[i][j].lerp(avg, fac)
        P = Q
    return P


def drape(P, wrap_i, margin, caps, rounds=4):
    for _ in range(rounds):
        P = [[M.push_out(p, caps, margin) for p in row] for row in P]
        P = smooth_grid(P, wrap_i, 2, fac=0.35)
    return [[M.push_out(p, caps, margin) for p in row] for row in P]


def grid_sample(P, ci: float, j: int, wrap_i: bool):
    ni = len(P)
    c0 = math.floor(ci)
    t = ci - c0
    a = P[c0 % ni if wrap_i else min(max(c0, 0), ni - 1)][j]
    b = P[(c0 + 1) % ni if wrap_i else min(max(c0 + 1, 0), ni - 1)][j]
    return a.lerp(b, t)


# ---------------------------------------------------------------- body
def swatch_cyl(region, axis_x, z0, z1, co):
    ang = math.atan2(co.x - axis_x, co.y)
    a = 0.5 + 0.5 * math.sin(ang)
    b = (z1 - co.z) / (z1 - z0)
    return paint.uv(region, min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0))


def build_body(geo):
    nodes = [
        (R.HIP, (0.14, 0.1)),
        (R.SPINE, (0.13, 0.09)),
        (R.CHEST, (0.155, 0.1)),
        (R.NECK, (0.056, 0.056)),
        (R.HEAD_BASE + Vector((0, 0, 0.02)), (0.05, 0.05)),
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    for _, s in SIDES:
        b = len(nodes)
        nodes += [
            (side(R.THIGH, s), (0.086, 0.086)),
            (side(R.KNEE, s), (0.066, 0.068)),
            (side(R.ANKLE, s) + Vector((0, 0, 0.03)), (0.052, 0.052)),
            (side(R.CLAV, s) + Vector((0.03 * s, 0, 0)), (0.07, 0.07)),
            (side(R.SHOULDER, s), (0.06, 0.06)),
            (side(R.ELBOW, s), (0.05, 0.05)),
            (side(R.WRIST, s), (0.04, 0.037)),
        ]
        edges += [(0, b), (b, b + 1), (b + 1, b + 2), (2, b + 3), (b + 3, b + 4), (b + 4, b + 5), (b + 5, b + 6)]
    body = M.skin_object("Body", nodes, edges, root=0, subdiv_edges=1, levels=2)
    for _, s in SIDES:  # calves and a little thigh mass
        M.grab(body, side(Vector((0.105, 0.03, 0.36)), s), 0.1, (0, 0.02, 0), scale=(1, 1, 1.6))
        M.grab(body, side(Vector((0.13, -0.01, 0.62)), s), 0.12, (0.012 * s, -0.008, 0), scale=(1, 1, 1.5))

    def uv(co, c):
        ax = abs(c.x)
        if c.z < 0.9 and ax > 0.035:
            sx = 0.105 if c.x > 0 else -0.105
            return swatch_cyl("wrap" if c.z < 0.47 else "trousers", sx, 0.0, 0.9, co)
        if c.z > 1.47:
            return swatch_cyl("skin", 0.0, 1.47, 1.62, co)
        if ax > 0.16 and c.z < 1.43:
            sx = 0.3 if c.x > 0 else -0.3
            return swatch_cyl("sleeve", sx, 0.9, 1.45, co)
        return swatch_cyl("sleeve", 0.0, 0.9, 1.5, co)

    M.absorb(geo, body, uv, lambda co: body_weight(co), "body")


def build_boot(geo, s):
    a = side(R.ANKLE, s)
    nodes = [
        (a + Vector((0, 0.0, 0.2)), (0.066, 0.068)),
        (a + Vector((0, 0.006, 0.0)), (0.06, 0.066)),
        (Vector((a.x, 0.065, 0.042)), (0.053, 0.05)),
        (Vector((a.x * 1.02, -0.06, 0.044)), (0.062, 0.047)),
        (side(R.TOE, s) + Vector((0, 0, 0.004)), (0.053, 0.035)),
    ]
    edges = [(0, 1), (1, 2), (1, 3), (3, 4)]
    boot = M.skin_object("Boot", nodes, edges, root=0, subdiv_edges=1, levels=2)
    for v in boot.data.vertices:
        if v.co.z < 0.014:
            v.co.z = 0.003 + (v.co.z - 0.003) * 0.15

    def uv(co, c):
        if c.z < 0.016:
            return swatch_cyl("sole", a.x, 0.0, 0.03, co)
        if c.z > 0.17:
            return swatch_cyl("wrap", a.x, 0.17, 0.32, co)
        return swatch_cyl("leather", a.x, 0.0, 0.26, co)

    def w(co):
        fwd = sstep(a.y - 0.01, a.y - 0.07, co.y)
        low = sstep(0.12, 0.06, co.z)
        f = max(fwd, low)
        return blend(({f"foot_{'L' if s > 0 else 'R'}": 1}, f), ({f"shin_{'L' if s > 0 else 'R'}": 1}, 1 - f))

    M.absorb(geo, boot, uv, w, "boot")


def build_hand(geo, s):
    sfx = "L" if s > 0 else "R"
    nodes = [((0.0, 0.0, 0.0), (0.033, 0.024)), ((0.055, 0.0, 0.0), (0.046, 0.02))]
    edges = [(0, 1)]
    for yy in (-0.024, 0.0, 0.024):
        b = len(nodes)
        ln = 0.055 - abs(yy) * 0.4
        nodes += [((0.083, yy, 0.0), (0.013, 0.012)), ((0.083 + ln, yy, -0.01), (0.0115, 0.0105))]
        edges += [(1, b), (b, b + 1)]
    b = len(nodes)
    nodes += [((0.033, -0.038, 0.0), (0.015, 0.013)), ((0.06, -0.066, -0.012), (0.012, 0.011))]
    edges += [(1, b), (b, b + 1)]
    hand = M.skin_object("Hand", nodes, edges, root=0, subdiv_edges=1, levels=1)
    d = (side(R.WRIST, s) - side(R.ELBOW, s)).normalized()
    q = Vector((1, 0, 0)).rotation_difference(d)
    # thumb (local -Y) toward the front (-Y); roll the palm to face the thigh
    roll = Matrix.Rotation(math.radians(-90 * s), 4, "X")
    hand.matrix_world = Matrix.Translation(side(R.WRIST, s) - d * 0.012) @ q.to_matrix().to_4x4() @ roll
    wr = side(R.WRIST, s)

    def w(co):
        t = (co - wr).dot(d)
        f = sstep(-0.01, 0.03, t)
        return blend(({f"hand_{sfx}": 1}, f), ({f"forearm_{sfx}": 1}, 1 - f))

    M.absorb(geo, hand, lambda co, c: swatch_cyl("glove", wr.x, wr.z - 0.2, wr.z + 0.02, co), w, "hand")


def build_cuffs(geo):
    """Bell sleeves over the forearms, ending in a woven cuff band."""
    for sfx, s in SIDES:
        e, wr = side(R.ELBOW, s), side(R.WRIST, s)
        d = (wr - e).normalized()
        ts = [-0.15, 0.1, 0.35, 0.6, 0.82, 0.97]
        path = [e.lerp(wr, t) for t in ts]
        radii = [0.06, 0.062, 0.066, 0.071, 0.077, 0.081]

        def wf(k, t, co, sfx=sfx, e=e, d=d):
            u = (co - e).dot(d)
            f = sstep(-0.05, 0.05, u)
            return blend(({f"forearm_{sfx}": 1}, f), ({f"upper_arm_{sfx}": 1}, 1 - f))

        M.add_tube(geo, path, radii, 14, "sleeve", wf, "sleeve", cap_end=False, swap_uv=True, up_hint=(0, -1, 0))
        path = [e.lerp(wr, t) for t in (0.84, 0.92, 1.0)]
        M.add_tube(geo, path, [0.083, 0.085, 0.086], 14, "cuff", lambda k, t, co, sfx=sfx: {f"forearm_{sfx}": 1.0},
                   "cuff", cap_end=False, swap_uv=True, up_hint=(0, -1, 0))


# ---------------------------------------------------------------- head and hair
def build_head(geo):
    head = M.quad_sphere("Head", 0.106, R.HEAD_C, levels=3, scale=(0.88, 0.96, 1.1))
    for v in head.data.vertices:
        p = v.co
        if p.z < 0:
            k = 1.0 + p.z / 0.117 * 0.24
            v.co.x *= k
            v.co.y *= 0.93 + 0.07 * k
    M.grab(head, (0, -0.1, 0.0), 0.045, (0, -0.011, -0.003))  # the hint of a nose
    M.grab(head, (0, -0.09, 0.04), 0.07, (0, -0.007, 0.002))  # brow
    M.grab(head, (0, -0.07, -0.085), 0.05, (0, -0.008, 0))  # chin
    c0 = R.HEAD_C

    def uv(co, c):
        p, pc = co - c0, c - c0
        ac = math.atan2(pc.x, -pc.y)
        av = math.atan2(p.x, -p.y)
        av = ac + (av - ac + math.pi) % (2 * math.pi) - math.pi
        return paint.uv("face", min(max(0.5 + av / (2 * math.pi), 0.0), 1.0), min(max((0.13 - p.z) / 0.26, 0), 1))

    def w(co):
        f = sstep(-0.06, -0.11, co.z - c0.z)
        return blend(({"head": 1}, 1 - f), ({"neck": 1}, f))

    M.absorb(geo, head, uv, w, "head")


HAIR_SCALE = (0.88 * 1.09, 0.96 * 1.1, 1.1 * 1.07)


def head_surface(az_deg, el_deg, out=0.0):
    """A point on the hair cap (az 0 = front, +90 = left; el from the equator) and its outward normal."""
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    r = 0.106
    p = Vector((d.x * r * HAIR_SCALE[0], d.y * r * HAIR_SCALE[1], d.z * r * HAIR_SCALE[2]))
    n = Vector((d.x / HAIR_SCALE[0], d.y / HAIR_SCALE[1], d.z / HAIR_SCALE[2])).normalized()
    return R.HEAD_C + p + n * out, n


def build_hair_cap(geo):
    cap = M.quad_sphere("HairCap", 0.106, R.HEAD_C + Vector((0, 0.008, 0.004)), levels=3, scale=HAIR_SCALE)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    # hairline: high over the brow, down the sides past the temples, low at the nape
    drop = [f for f in bm.faces if not (f.calc_center_median().z > 0.065 - 0.75 * f.calc_center_median().y
                                        - 0.6 * abs(f.calc_center_median().x))]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.to_mesh(cap.data)
    bm.free()
    tex = bpy.data.textures.new("HairClouds", "CLOUDS")
    tex.noise_scale = 0.045
    disp = cap.modifiers.new("Displace", "DISPLACE")
    disp.texture = tex
    disp.texture_coords = "LOCAL"
    disp.strength = 0.04
    disp.mid_level = 0.2
    M.apply_modifiers(cap)
    c0 = R.HEAD_C

    def uv(co, c):
        p = co - c0
        a = 0.5 + 0.5 * math.sin(math.atan2(p.x, p.y))
        return paint.uv("hair", a, min(max((0.14 - p.z) / 0.22, 0), 1))

    M.absorb(geo, cap, uv, lambda co: {"head": 1.0}, "hair")


# (az, el, length, root width, rise) per chain; az 0 = front, +90 = the character's left
HAIR_CHAINS = [
    (22.0, 62.0, 0.27, 0.05, 0.1),
    (-26.0, 56.0, 0.26, 0.05, 0.1),
    (72.0, 34.0, 0.32, 0.055, 0.12),
    (-72.0, 34.0, 0.3, 0.055, 0.12),
    (150.0, 46.0, 0.37, 0.06, -0.05),
    (-150.0, 46.0, 0.35, 0.06, -0.05),
    (118.0, 8.0, 0.34, 0.056, -0.25),
    (-118.0, 8.0, 0.32, 0.056, -0.25),
    (180.0, -4.0, 0.3, 0.06, -0.4),
    (4.0, 40.0, 0.2, 0.046, -0.15),
    (96.0, -6.0, 0.24, 0.05, -0.2),
    (-96.0, -6.0, 0.23, 0.05, -0.2),
]
WIND_DRIFT = Vector((0.62, 0.0, 0.0))  # the rest pose already leans the hair to the left (+X), downwind
HAIR_LEN = 1.3  # every lock is this much longer than its table length: the mood board's hair streams


def lock_path(az, el, length, rise, wiggle, n=8):
    root, nrm = head_surface(az, el, -0.012)
    # locks from the back of the head hang and stream sideways rather than straight back (seen from behind,
    # straight-back locks are end-on stubs; the mood board's backs show a dark mass with strands blowing aside)
    back = Vector((0, 1.0 - 0.55 * sstep(100.0, 160.0, abs(az)), 0))
    up = Vector((0, 0, 1.0))
    # crown locks leave the scalp flat (along it, not out of it): rising out of the crown they read as horns
    crown = sstep(30.0, 70.0, el)
    d0 = (nrm * 0.5 * (1.0 - 0.7 * crown) + back * 1.0 + up * (rise - 0.3 * crown)).normalized()
    d1 = (back * 1.0 + WIND_DRIFT + up * (rise * 0.35) + nrm * 0.08).normalized()
    pts = [root]
    step = length / (n - 1)
    for k in range(1, n):
        t = k / (n - 1)
        d = d0.lerp(d1, sstep(0.0, 0.75, t)).normalized()
        jig = Vector((math.sin(wiggle + 2.3 * k) * 0.14, 0, math.cos(wiggle * 1.7 + 1.9 * k) * 0.12))
        pts.append(pts[-1] + (d + jig * t).normalized() * step)
    return pts, nrm


def resample(path, ts):
    lens = [0.0]
    for k in range(1, len(path)):
        lens.append(lens[-1] + (path[k] - path[k - 1]).length)
    out = []
    for t in ts:
        target = t * lens[-1]
        k = 1
        while k < len(path) - 1 and lens[k] < target:
            k += 1
        seg = max(lens[k] - lens[k - 1], 1e-9)
        out.append(path[k - 1].lerp(path[k], (target - lens[k - 1]) / seg))
    return out


def build_hair_locks(geo, chains):
    for ci, (az, el, ln, wd, rise) in enumerate(HAIR_CHAINS):
        prefix = f"hair_{ci}"
        ln *= HAIR_LEN
        main, nrm = lock_path(az, el, ln, rise, 0.7 * ci + 0.3)
        chains.append((prefix, "head", resample(main, [0.0, 1 / 3, 2 / 3, 1.0])))
        locks = [(main, nrm, wd)]
        for k, (daz, del_, lf) in enumerate(((17.0, -8.0, 0.8), (-15.0, 7.0, 0.72))):
            sgn = 1.0 if ci % 2 == 0 else -1.0
            p, nn = lock_path(az + daz * sgn, el + del_, ln * lf, rise * 0.8, 1.3 * ci + 2.0 + k)
            locks.append((p, nn, wd * (0.85 - 0.1 * k)))
        for path, nn, w0 in locks:
            n = len(path)
            radii = [0.9 * w0 * (1.0 - 0.9 * (k / (n - 1)) ** 1.2) for k in range(n)]
            flat = [(1.0, 0.32 + 0.2 * (k / (n - 1))) for k in range(n)]

            def wf(k, t, co, prefix=prefix):
                return tent_weights(3.0 * t, 3, prefix, "head", 1.0)

            M.add_tube(geo, path, radii, 6, "hair", wf, "hair", flatten=flat, swap_uv=True, up_hint=tuple(nn))


# ---------------------------------------------------------------- the cape (poncho top)
CAPE_NI = 72
CAPE_NJ = 19
CAPE_JOINT_ROWS = [6, 10, 14, 18]  # chain joints: 3 bones from s = 1/3 to the hem


def cape_raw(th, s):
    sn, cs = math.sin(th), math.cos(th)
    C = Vector((0.118 * sn, -0.104 * cs + 0.006, 1.505))
    Q = Vector((0.33 * sn, -0.22 * cs + 0.01, 1.49))
    # hem: a long poncho (mood-board 01, 09, 12): a long back panel to the knees, the front to mid-thigh, the
    # sides draped over the arms and ending at the wrists so the hands show below; the front and back points
    # are a little sharper than the Fourier curve
    c2 = math.cos(2 * th)
    zh = 0.8 + 0.08 * cs - 0.1 * c2 - 0.03 * max(0.0, cs) ** 8 - 0.04 * max(0.0, -cs) ** 6
    zh += 0.014 * math.sin(5 * th + 1.0) + 0.008 * math.sin(11 * th + 0.3)  # wool hangs unevenly
    rr = 1.0 + 0.05 * c2 * c2
    ry = 0.3 if cs > 0 else 0.34
    H = Vector((0.53 * sn * rr, (-ry * cs) * rr + 0.015, zh))
    p = C * ((1 - s) ** 2) + Q * (2 * s * (1 - s)) + H * (s * s)
    fold = 0.052 * s**1.5 * (0.5 * math.sin(9 * th + 0.7) + 0.35 * math.sin(5 * th + 2.1) + 0.15 * math.sin(14 * th))
    radial = Vector((p.x, p.y, 0.0))
    if radial.length > 1e-6:
        p += radial.normalized() * fold
    return p


def build_cape(geo, chains):
    P = [[cape_raw(2 * math.pi * i / CAPE_NI, j / (CAPE_NJ - 1)) for j in range(CAPE_NJ)] for i in range(CAPE_NI)]
    caps = [c for c in CAPS if c[2] != 0.1 and c[2] != 0.072]  # shoulders, arms, torso, neck
    P = drape(P, True, 0.028, caps)
    # chain joints: 8 chains (front, front-left, left, ...), joints at s = 1/3, 2/3, 1
    N = M.grid_normals(P, CAPE_NI, CAPE_NJ, True)
    for k in range(8):
        i = k * CAPE_NI // 8
        joints = []
        for j in CAPE_JOINT_ROWS:
            n = N[i][j]
            out = Vector((P[i][j].x, P[i][j].y, 0))
            if n.dot(out) < 0:
                n = -n
            joints.append(P[i][j] - n * 0.012)
        chains.append((f"cape_{k}", "chest", joints))

    def weight(i, j, co):
        th = 2 * math.pi * i / CAPE_NI
        s = j / (CAPE_NJ - 1)
        sn = math.sin(th)
        arm = abs(sn) ** 3 * sstep(0.25, 0.75, s) * 0.45
        arm_bone = "upper_arm_L" if sn > 0 else "upper_arm_R"
        sh_bone = "shoulder_L" if sn > 0 else "shoulder_R"
        chain_share = sstep(0.3, 0.62, s) * (1.0 - arm) * 0.92
        rest = 1.0 - arm - chain_share
        # neighbouring chains around
        u = th / (2 * math.pi) * 8
        k0 = int(math.floor(u)) % 8
        k1 = (k0 + 1) % 8
        a = u - math.floor(u)
        nb = len(CAPE_JOINT_ROWS) - 1
        f = max(0.0, (s - 1 / 3) / ((2 / 3) / nb))  # joint units from the chain root (s = 1/3)
        w0 = tent_weights(f, nb, f"cape_{k0}", "chest", 0.0)
        w1 = tent_weights(f, nb, f"cape_{k1}", "chest", 0.0)
        top = blend(({"chest": 1}, 0.75), ({"neck": 1}, 0.25)) if s < 0.12 else {"chest": 1.0}
        return blend((w0, chain_share * (1 - a)), (w1, chain_share * a), ({arm_bone: 1}, arm * 0.8),
                     ({sh_bone: 1}, arm * 0.2 + abs(sn) ** 2 * 0.15 * rest), (top, rest * (1 - abs(sn) ** 2 * 0.15)))

    # v by arc length up from the hem (the longest column spans the whole region), so the hem band keeps one
    # width around a hem whose length varies from the arms to the back
    arc = []
    for i in range(CAPE_NI):
        acc = [0.0]
        for j in range(1, CAPE_NJ):
            acc.append(acc[-1] + (P[i][j] - P[i][j - 1]).length)
        arc.append(acc)
    longest = max(a[-1] for a in arc)

    def v_of(c, j):
        a = arc[c % CAPE_NI]
        return 1.0 - (a[-1] - a[j]) / longest

    def uv_out(c, j):
        return paint.uv("cape", c / CAPE_NI, v_of(c, j))

    def uv_in(c, j):
        return paint.uv("lining", c / CAPE_NI, v_of(c, j))

    M.add_sheet(geo, P, True, uv_out, uv_in, 0.011, weight, "cape",
                rim_uv=lambda c, j: paint.uv("cape", c / CAPE_NI, 0.985))
    return P


def cape_point(P, th, s, out):
    """A point on the draped cape (bilinear in the grid) pushed `out` metres along its outward normal."""
    ci = th / (2 * math.pi) * CAPE_NI
    jf = s * (CAPE_NJ - 1)
    j0 = min(int(math.floor(jf)), CAPE_NJ - 2)
    t = jf - j0
    a = grid_sample(P, ci, j0, True)
    b = grid_sample(P, ci, j0 + 1, True)
    p = a.lerp(b, t)
    a2 = grid_sample(P, ci + 0.5, j0, True) - grid_sample(P, ci - 0.5, j0, True)
    n = a2.cross(b - a).normalized()
    if n.dot(Vector((p.x, p.y, 0))) < 0:
        n = -n
    return p + n * out


# ---------------------------------------------------------------- the robe (long layer)
ROBE_NI = 84
ROBE_NJ = 18
ROBE_TOP = 1.38
ROBE_HEM = 0.33
ROBE_TH0 = -0.25
ROBE_TH1 = 2 * math.pi + 0.25
ROBE_RADII = [(1.38, 0.196, 0.13), (1.2, 0.206, 0.15), (1.05, 0.222, 0.165), (0.95, 0.252, 0.19),
              (0.75, 0.295, 0.24), (0.55, 0.322, 0.272), (0.33, 0.348, 0.3)]
ROBE_CHAIN_ROWS = [7, 11, 14, 17]  # z 0.95, 0.70, 0.51, 0.33


def robe_z(j):
    return ROBE_TOP - (ROBE_TOP - ROBE_HEM) * j / (ROBE_NJ - 1)


def robe_th(i):
    return ROBE_TH0 + (ROBE_TH1 - ROBE_TH0) * i / (ROBE_NI - 1)


def robe_raw(th, z):
    pts = ROBE_RADII
    rx, ry = pts[-1][1], pts[-1][2]
    for k in range(len(pts) - 1):
        z0, z1 = pts[k][0], pts[k + 1][0]
        if z1 <= z <= z0:
            t = sstep(0.0, 1.0, (z0 - z) / (z0 - z1)) * 0.5 + (z0 - z) / (z0 - z1) * 0.5
            rx, ry = lerp(pts[k][1], pts[k + 1][1], t), lerp(pts[k][2], pts[k + 1][2], t)
            break
    amp = 0.04 * sstep(1.05, 0.36, z)
    fold = amp * (0.5 * math.sin(11 * th + 0.4) + 0.3 * math.sin(6 * th + 1.9) + 0.2 * math.sin(17 * th + 0.9))
    over = 0.0
    if th < 0.5:
        over = 0.02 * sstep(0.5, 0.3, th)  # the left panel laps over the right at the front
    elif th > 2 * math.pi - 0.35:
        over = -0.006
    zz = z + 0.014 * math.sin(7 * th + 1.0) * sstep(0.62, 0.36, z)
    return Vector(((rx + fold + over) * math.sin(th), -(ry + fold + over) * math.cos(th), zz))


def build_robe(geo, chains):
    P = [[robe_raw(robe_th(i), robe_z(j)) for j in range(ROBE_NJ)] for i in range(ROBE_NI)]
    P = drape(P, False, 0.02, CAPS)
    N = M.grid_normals(P, ROBE_NI, ROBE_NJ, False)
    chain_th = [math.radians(15 + 30 * k) for k in range(12)]
    for k, th in enumerate(chain_th):
        ci = (th - ROBE_TH0) / (ROBE_TH1 - ROBE_TH0) * (ROBE_NI - 1)
        joints = []
        for j in ROBE_CHAIN_ROWS:
            p = grid_sample(P, ci, j, False)
            n = Vector((p.x, p.y, 0)).normalized()
            joints.append(p - n * 0.014)
        chains.append((f"robe_{k:02d}", "hips", joints))

    def weight(i, j, co):
        th = robe_th(i)
        z = robe_z(j)
        if z >= 0.96 + 1e-6:
            t = sstep(0.98, 1.24, z)
            return blend(({"hips": 1}, 1 - t), ({"spine": 1}, t * 0.8), ({"chest": 1}, t * 0.2 * sstep(1.2, 1.36, z)))
        # f in joint units along the chain
        zs = [robe_z(r) for r in ROBE_CHAIN_ROWS]
        f = 0.0
        for b in range(3):
            if zs[b + 1] - 1e-9 <= z <= zs[b] + 1e-9:
                f = b + (zs[b] - z) / (zs[b] - zs[b + 1])
                break
        if th <= chain_th[0]:
            k0, k1, a = 0, 0, 0.0
        elif th >= chain_th[-1]:
            k0, k1, a = 11, 11, 0.0
        else:
            u = (th - chain_th[0]) / (chain_th[1] - chain_th[0])
            k0 = int(math.floor(u))
            k1 = k0 + 1
            a = u - k0
        w0 = tent_weights(f, 3, f"robe_{k0:02d}", "hips", 1.0)
        w1 = tent_weights(f, 3, f"robe_{k1:02d}", "hips", 1.0)
        return blend((w0, 1 - a), (w1, a))

    def uv_out(c, j):
        return paint.uv("robe", c / (ROBE_NI - 1), j / (ROBE_NJ - 1))

    def uv_in(c, j):
        return paint.uv("lining", c / (ROBE_NI - 1), j / (ROBE_NJ - 1))

    M.add_sheet(geo, P, False, uv_out, uv_in, 0.01, weight, "robe",
                rim_uv=lambda c, j: paint.uv("robe", c / (ROBE_NI - 1), 0.99))


# ---------------------------------------------------------------- scarf
SCARF_WRAPS = [  # z, rx, ry, tube r, tilt (deg, + = front lower), phase, (chest, neck, head) shares
    (1.47, 0.172, 0.158, 0.06, 9.0, 0.0, (0.75, 0.25, 0.0)),
    (1.53, 0.142, 0.132, 0.053, -4.0, 1.7, (0.35, 0.65, 0.0)),
    (1.588, 0.108, 0.104, 0.043, 7.0, 3.1, (0.0, 0.6, 0.4)),
]


def build_scarf(geo, chains, cape_P):
    for wi, (z, rx, ry, r0, tilt, ph, shares) in enumerate(SCARF_WRAPS):
        n = 48
        path, radii = [], []
        rot = Matrix.Rotation(math.radians(tilt), 3, "X")
        for k in range(n):
            a = 2 * math.pi * k / n
            p = Vector((rx * math.sin(a), -ry * math.cos(a), 0.0))
            p = rot @ p + Vector((0, 0.012, z))
            path.append(p)
            p.z += 0.012 * math.sin(2 * a + ph)
            path[-1] = p
            radii.append(r0 * (1.0 + 0.24 * math.sin(3 * a + ph) + 0.12 * math.sin(5 * a + 2 * ph) + 0.05 * math.sin(11 * a)))
        wd = blend(({"chest": 1}, shares[0]), ({"neck": 1}, shares[1]), ({"head": 1}, shares[2]))
        M.add_tube(geo, path, radii, 10, "scarf", lambda k, t, co, wd=wd: wd, "scarf", closed_loop=True,
                   u_scale=1.0, u0=0.0)
    # two tails from the knot at the back-left, hanging over the cape
    tails = [("scarf_0", 150.0, 0.05, 0.44, 0.046), ("scarf_1", 172.0, 0.04, 0.33, 0.04)]
    for name, az, s0, s1, wd0 in tails:
        th = math.radians(az)
        pts = [cape_point(cape_P, th, lerp(s0, s1, t), 0.03 + 0.012 * t) for t in [k / 8 for k in range(9)]]
        pts[0] = pts[0] + Vector((0, -0.01, 0.025))
        chains.append((name, "chest", resample(pts, [0.0, 0.25, 0.5, 0.75, 1.0])))
        radii = [wd0 * (1.0 - 0.15 * (k / 8)) for k in range(9)]
        flat = [(1.0, 0.24) for _ in range(9)]

        def wf(k, t, co, name=name):
            return tent_weights(4.0 * t, 4, name, "chest", 1.0)

        out = Vector((pts[2].x, pts[2].y, 0)).normalized()
        M.add_tube(geo, pts, radii, 8, "scarf", wf, "scarf", flatten=flat, up_hint=tuple(out), u_scale=0.45, u0=0.5,
                   cap_end=True)


# ---------------------------------------------------------------- occlusion
def bake_ao(geo):
    for vi, co in enumerate(geo.verts):
        tag = geo.tags[vi]
        k = 1.0
        if tag == "body":
            k = 0.85 if co.z < 0.7 else 0.55
            if abs(co.x) > 0.25 and co.z < 1.15:
                k = 0.9
        elif tag == "robe":
            k = 0.5 + 0.5 * sstep(1.05, 0.8, co.z)  # under the cape
            k *= 0.88 + 0.12 * sstep(0.36, 0.6, co.z)
        elif tag == "cape":
            k = 0.75 + 0.25 * sstep(1.47, 1.4, co.z)
        elif tag == "hair":
            # dark at the roots (the mass reads as one shape, the rim stays off its bumps), lit toward the tips
            k = 0.66 + 0.3 * sstep(0.13, 0.32, (co - R.HEAD_C).length)
        elif tag == "scarf":
            k = 0.82 + 0.18 * sstep(1.42, 1.5, co.z)
        geo.ao[vi] = k
    # inner shells: the add_sheet inner sides use lining UVs; darken them (they face in)
    # (marked by position: a vertex whose UV-region is lining gets 0.55; done per face)
    for fi, f in enumerate(geo.faces):
        u, v = geo.face_uvs[fi][0]
        x0, y0, w, h = paint.REGIONS["lining"]
        px, py = u * paint.W, (1 - v) * paint.H
        if x0 <= px <= x0 + w and y0 <= py <= y0 + h:
            for k in f:
                geo.ao[k] = min(geo.ao[k], 0.6)


# ---------------------------------------------------------------- material
def make_material(png_path):
    mat = bpy.data.materials.new("Wanderer")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    img = bpy.data.images.load(str(Path(png_path).resolve()))
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "AO"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], mul.inputs["A"])
    nt.links.new(vc.outputs["Color"], mul.inputs["B"])
    nt.links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


# ---------------------------------------------------------------- main
def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.render.fps = A.FPS

    Path(a["png"]).parent.mkdir(parents=True, exist_ok=True)
    paint.write_png(a["png"], paint.paint())
    log(f"painted {a['png']}")

    geo = M.Geo()
    chains = []
    build_body(geo)
    for _, s in SIDES:
        build_boot(geo, s)
        build_hand(geo, s)
    build_cuffs(geo)
    log("body, boots, hands, cuffs")
    build_head(geo)
    build_hair_cap(geo)
    build_hair_locks(geo, chains)
    log("head and hair")
    cape_P = build_cape(geo, chains)
    build_robe(geo, chains)
    log("cape and robe")
    build_scarf(geo, chains, cape_P)
    log("scarf")
    bake_ao(geo)

    rig, bone_names = R.build_armature(chains)
    deform = [n for n in bone_names if n != "root"]
    mat = make_material(a["png"])
    obj = M.build_object(geo, "Wanderer", deform, mat)
    obj.parent = rig
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    log("mesh and rig")
    A.build_all(rig)
    log("clips")

    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    for tag in sorted(set(geo.tags)):
        log(f"  {tag}: {geo.tri_count(tag)} tris")
    log(f"TOTAL tris={tris} verts={len(obj.data.vertices)} bones={len(rig.data.bones)} chains={len(chains)}")

    if a["blend"]:
        Path(a["blend"]).parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(a["blend"]).resolve()))
    Path(a["glb"]).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(Path(a["glb"]).resolve()),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
        export_texcoords=True,
        export_normals=True,
        export_vertex_color="ACTIVE",
        export_image_format="NONE",
        export_def_bones=False,
    )
    log(f"exported {a['glb']}")


if __name__ == "__main__":
    main()
