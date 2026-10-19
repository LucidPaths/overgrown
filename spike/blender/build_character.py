"""Builds a stylised humanoid entirely in code, rigs it, animates it, exports .glb.

Run:  blender --background --factory-startup --python spike/blender/build_character.py -- \
          --blend spike/build/character.blend --glb spike/godot/assets/character.glb

Conventions: metres, Blender Z up, the character faces -Y (glTF/Godot +Z), feet on z=0.
Every number below is authored here; nothing is downloaded (OQ-030).
"""

import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

T0 = time.perf_counter()
TIMES: list[tuple[str, float]] = []


def step(name: str, t_prev=[T0]) -> None:  # noqa: B006 - deliberate static timer
    now = time.perf_counter()
    TIMES.append((name, now - t_prev[0]))
    print(f"[build] {name}: {now - t_prev[0]:.2f}s", flush=True)
    t_prev[0] = now


def args() -> dict[str, str]:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = {"blend": "spike/build/character.blend", "glb": "spike/godot/assets/character.glb"}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


# ---------------------------------------------------------------- scene reset
def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.render.fps = 24


def link(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj: bpy.types.Object) -> None:
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def join_ordered(target, parts) -> None:
    """Join `parts` into `target` in list order. bpy.ops.object.join merges in a nondeterministic
    order (byte-different .glb on every build), so we append through bmesh instead."""
    mats = list(target.data.materials)
    bm = bmesh.new()
    bm.from_mesh(target.data)
    inv = target.matrix_world.inverted()
    for part in parts:
        me = part.data.copy()
        me.transform(inv @ part.matrix_world)
        remap = []
        for m in part.data.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        src_idx = [poly.material_index for poly in me.polygons]
        n0 = len(bm.faces)
        bm.from_mesh(me)  # appends to the existing bmesh
        bm.faces.ensure_lookup_table()
        for k, mi in enumerate(src_idx):
            bm.faces[n0 + k].material_index = remap[mi] if remap else 0
        bpy.data.meshes.remove(me)
        bpy.data.objects.remove(part)
    for m in mats[len(target.data.materials) :]:  # never materials.clear(): it zeroes every face's index
        target.data.materials.append(m)
    bm.to_mesh(target.data)
    bm.free()


def apply_modifiers(obj: bpy.types.Object) -> None:
    activate(obj)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- materials
def material(name: str, rgb: tuple[float, float, float], rough: float = 0.7, vcol: bool = True):
    """Principled BSDF; base colour = colour attribute "AO" x rgb (glTF: COLOR_0 x baseColorFactor)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if vcol:
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "AO"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(attr.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = (*rgb, 1.0)
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    return mat


# ---------------------------------------------------------------- shaping helpers
def smooth_falloff(d: float, r: float) -> float:
    if d >= r:
        return 0.0
    x = 1.0 - (d / r) ** 2
    return x * x


def grab(obj, center, radius, offset, scale=(1.0, 1.0, 1.0)) -> None:
    """Sculpt-style grab brush: move verts near `center` by `offset` with smooth falloff.
    `scale` stretches the brush (an ellipsoid) per axis."""
    c = Vector(center)
    off = Vector(offset)
    for v in obj.data.vertices:
        d = v.co - c
        d = Vector((d.x / scale[0], d.y / scale[1], d.z / scale[2]))
        w = smooth_falloff(d.length, radius)
        if w:
            v.co += off * w


def inflate(obj, center, radius, amount, scale=(1.0, 1.0, 1.0)) -> None:
    """Sculpt-style inflate brush: push verts along their normals."""
    c = Vector(center)
    for v in obj.data.vertices:
        d = v.co - c
        d = Vector((d.x / scale[0], d.y / scale[1], d.z / scale[2]))
        w = smooth_falloff(d.length, radius)
        if w:
            v.co += v.normal * amount * w


def bm_smooth(obj, iterations=2, factor=0.5) -> None:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(obj.data)
    bm.free()


# ---------------------------------------------------------------- skin-modifier bodies
def skin_object(name, nodes, edges, root=0, subdiv_edges=0, levels=2, smooth=True):
    """Build a mesh from a skeleton graph with the Skin modifier.

    nodes: list of (co, (rx, ry)) ; edges: index pairs.
    subdiv_edges inserts extra rings along every edge (interpolated radius) so limbs bend well.
    """
    me = bpy.data.meshes.new(name)
    obj = link(bpy.data.objects.new(name, me))
    bm = bmesh.new()
    verts = [bm.verts.new(co) for co, _ in nodes]
    radii = {}
    bm.verts.index_update()
    for a, b in edges:
        bm.edges.new((verts[a], verts[b]))
    if subdiv_edges:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv_edges, use_grid_fill=False)
    bm.to_mesh(me)
    bm.free()
    obj.modifiers.new("Skin", "SKIN")
    sk = me.skin_vertices[0].data
    # radii: original verts keep their own radius; inserted verts interpolate from nearest originals
    orig = [Vector(co) for co, _ in nodes]
    for i, v in enumerate(me.vertices):
        if i < len(nodes):
            radii[i] = nodes[i][1]
        else:
            ds = sorted(((v.co - o).length, j) for j, o in enumerate(orig))
            (d0, j0), (d1, j1) = ds[0], ds[1]
            t = d0 / (d0 + d1)
            r0, r1 = nodes[j0][1], nodes[j1][1]
            radii[i] = (r0[0] * (1 - t) + r1[0] * t, r0[1] * (1 - t) + r1[1] * t)
        sk[i].radius = radii[i]
        sk[i].use_root = i == root
    sub = obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    apply_modifiers(obj)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return obj


def quad_sphere(name, radius, location, levels=2, scale=(1.0, 1.0, 1.0)):
    """Cube -> subsurf -> cast to sphere: an all-quad sphere.

    Not primitive_uv_sphere_add: in Blender 4.5.14 it emits its polygons in a different order on
    every run, and Subdivision Surface on its pole triangles moves vertices; both break
    byte-identical rebuilds. Quad-only cages subdivide deterministically.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    sub = obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = levels
    cast = obj.modifiers.new("Cast", "CAST")
    cast.cast_type = "SPHERE"
    cast.factor = 1.0
    apply_modifiers(obj)
    r_avg = sum(v.co.length for v in obj.data.vertices) / len(obj.data.vertices)
    for v in obj.data.vertices:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) * (radius / r_avg)
    return obj


# ---------------------------------------------------------------- the character
# Key joint positions (metres). L = character's left = +X.
HIP = Vector((0.0, 0.0, 0.96))
SPINE = Vector((0.0, 0.0, 1.12))
CHEST = Vector((0.0, 0.0, 1.30))
NECK = Vector((0.0, 0.0, 1.46))
HEAD_BASE = Vector((0.0, 0.0, 1.55))
HEAD_C = Vector((0.0, -0.01, 1.68))


def side(v: Vector, s: int) -> Vector:
    return Vector((v.x * s, v.y, v.z))


THIGH = Vector((0.095, 0.0, 0.92))
KNEE = Vector((0.105, -0.015, 0.52))
ANKLE = Vector((0.11, 0.015, 0.11))
TOE = Vector((0.115, -0.13, 0.03))
CLAV = Vector((0.06, 0.0, 1.42))
SHOULDER = Vector((0.18, 0.01, 1.41))
ELBOW = Vector((0.33, 0.04, 1.18))
WRIST = Vector((0.45, 0.0, 0.98))


def build_body():
    nodes = [
        (HIP, (0.15, 0.10)),  # 0 root
        (SPINE, (0.135, 0.09)),  # 1
        (CHEST, (0.165, 0.105)),  # 2
        (NECK, (0.06, 0.055)),  # 3
        (HEAD_BASE, (0.05, 0.05)),  # 4
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    for s in (1, -1):
        b = len(nodes)
        nodes += [
            (side(THIGH, s), (0.085, 0.085)),  # b
            (side(KNEE, s), (0.055, 0.058)),  # b+1
            (side(ANKLE, s), (0.04, 0.042)),  # b+2
            (side(CLAV, s) + Vector((0, 0, 0.0)), (0.07, 0.07)),  # b+3
            (side(SHOULDER, s), (0.06, 0.06)),  # b+4
            (side(ELBOW, s), (0.042, 0.042)),  # b+5
            (side(WRIST, s), (0.033, 0.03)),  # b+6
        ]
        edges += [(0, b), (b, b + 1), (b + 1, b + 2), (2, b + 3), (b + 3, b + 4), (b + 4, b + 5), (b + 5, b + 6)]
    body = skin_object("Body", nodes, edges, root=0, subdiv_edges=2, levels=2)

    # sculpt-like shaping (grab / inflate brushes)
    for s in (1, -1):
        inflate(body, side(Vector((0.08, -0.08, 1.31)), s), 0.10, 0.018)  # pecs
        inflate(body, side(Vector((0.20, 0.0, 1.40)), s), 0.08, 0.015)  # deltoids
        grab(body, side(Vector((0.09, 0.08, 0.90)), s), 0.12, (0, 0.025, -0.005))  # glutes
        grab(body, side(Vector((0.105, 0.04, 0.38)), s), 0.10, (0, 0.018, 0), scale=(1, 1, 1.6))  # calves
        inflate(body, side(Vector((0.10, -0.03, 0.72)), s), 0.12, 0.012, scale=(1, 1, 1.5))  # quads
    grab(body, Vector((0, -0.10, 1.05)), 0.12, (0, 0.012, 0))  # tuck belly
    grab(body, Vector((0, 0.10, 1.25)), 0.16, (0, 0.010, 0))  # shoulder blades back
    bm_smooth(body, iterations=2, factor=0.4)
    return body


def build_head():
    head = quad_sphere("Head", 0.135, HEAD_C, levels=4)
    # stylised proportions: tall cranium, narrow jaw, flat back of the face
    for v in head.data.vertices:
        p = v.co  # local, centred
        if p.z < 0:  # jaw taper
            k = 1.0 + p.z / 0.135 * 0.28
            v.co.x *= k
            v.co.y *= 0.9 + 0.1 * k
        v.co.y *= 0.93
    grab(head, (0, -0.13, 0.0), 0.06, (0, -0.022, -0.004))  # nose
    grab(head, (0, -0.10, -0.08), 0.07, (0, -0.012, 0.0))  # chin
    for s in (1, -1):
        grab(head, (0.045 * s, -0.12, 0.012), 0.035, (0, 0.012, 0))  # eye sockets
        grab(head, (0.065 * s, -0.10, -0.035), 0.05, (0.006 * s, -0.006, 0))  # cheeks
    activate(head)
    bpy.ops.object.shade_smooth()
    head.data.materials.append(MATS["skin"])

    parts = [head]
    # ears: flattened spheres pushed into the head
    for s in (1, -1):
        ear = quad_sphere("Ear", 0.035, HEAD_C + Vector((0.125 * s, 0.0, -0.005)), levels=2, scale=(0.45, 0.8, 1.15))
        bpy.ops.object.shade_smooth()
        ear.data.materials.append(MATS["skin"])
        parts.append(ear)
    # eyes
    for s in (1, -1):
        eye = quad_sphere("Eye", 0.027, HEAD_C + Vector((0.046 * s, -0.114, 0.008)), levels=2, scale=(0.9, 0.55, 1.35))
        bpy.ops.object.shade_smooth()
        eye.data.materials.append(MATS["eye"])
        parts.append(eye)
    # hair: a shell of the head, cut by a tilted plane, roughened with a procedural Displace texture
    hair = head.copy()
    hair.data = head.data.copy()
    hair.name = "Hair"
    link(hair)
    hair.data.materials.clear()
    hair.data.materials.append(MATS["hair"])
    bm = bmesh.new()
    bm.from_mesh(hair.data)
    for v in bm.verts:
        v.co = v.co * 1.07
    # keep the cranium cap: cut front low at the brow, back low at the nape
    bmesh.ops.bisect_plane(
        bm,
        geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
        plane_co=Vector((0, 0, 0.02)),
        plane_no=Vector((0, 0.4, 1.0)).normalized(),  # hairline high at the brow, low at the nape
        clear_inner=True,
    )
    bm.to_mesh(hair.data)
    bm.free()
    tex = bpy.data.textures.new("HairClouds", "CLOUDS")
    tex.noise_scale = 0.04
    disp = hair.modifiers.new("Displace", "DISPLACE")
    disp.texture = tex
    disp.strength = 0.03
    disp.mid_level = 0.3
    solid = hair.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = 0.012
    apply_modifiers(hair)
    parts.append(hair)

    join_ordered(head, parts[1:])  # one head object, per-part materials kept
    return head


def build_hand(s: int):
    """Mitten-ish hand (3 fingers + thumb) built along local +X, then aimed down the forearm."""
    nodes = [
        ((0.0, 0.0, 0.0), (0.03, 0.022)),  # 0 wrist
        ((0.05, 0.0, 0.0), (0.042, 0.018)),  # 1 palm
    ]
    edges = [(0, 1)]
    for yy in (-0.022, 0.0, 0.022):
        b = len(nodes)
        ln = 0.05 - abs(yy) * 0.4
        nodes += [((0.075, yy, 0.0), (0.012, 0.011)), ((0.075 + ln, yy, -0.008), (0.0105, 0.0095))]
        edges += [(1, b), (b, b + 1)]
    b = len(nodes)
    nodes += [((0.03, -0.035, -0.0), (0.014, 0.012)), ((0.055, -0.06, -0.01), (0.011, 0.01))]
    edges += [(1, b), (b, b + 1)]
    hand = skin_object(f"Hand.{'L' if s > 0 else 'R'}", nodes, edges, root=0, subdiv_edges=1, levels=1)
    # aim: local +X -> forearm direction; thumb (local -Y) stays to the front (-Y)
    d = (side(WRIST, s) - side(ELBOW, s)).normalized()
    q = Vector((1, 0, 0)).rotation_difference(d)
    hand.matrix_world = Matrix.Translation(side(WRIST, s) - d * 0.01) @ q.to_matrix().to_4x4()
    activate(hand)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    hand.data.materials.append(MATS["skin"])
    return hand


def build_boot(s: int):
    a = side(ANKLE, s)
    nodes = [
        (a + Vector((0, 0.0, 0.17)), (0.058, 0.06)),  # 0 shaft top
        (a + Vector((0, 0.005, 0.0)), (0.055, 0.06)),  # 1 ankle
        (Vector((a.x, 0.055, 0.045)), (0.05, 0.045)),  # 2 heel
        (Vector((a.x * 1.02, -0.06, 0.045)), (0.058, 0.045)),  # 3 ball
        (side(TOE, s), (0.05, 0.034)),  # 4 toe
    ]
    edges = [(0, 1), (1, 2), (1, 3), (3, 4)]
    boot = skin_object(f"Boot.{'L' if s > 0 else 'R'}", nodes, edges, root=0, subdiv_edges=1, levels=2)
    # flatten the sole on the ground
    for v in boot.data.vertices:
        if v.co.z < 0.012:
            v.co.z = 0.004 + (v.co.z - 0.004) * 0.15
    boot.data.materials.append(MATS["boot"])
    # sole: a slightly bigger copy of the lowest ring, darker
    return boot


def region_copy(src, name, pred, push, thickness, mat):
    """Clothing: copy the body faces whose centre passes `pred`, push out along normals, solidify."""
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.normal_update()
    drop = [f for f in bm.faces if not pred(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    for v in bm.verts:
        v.co += v.normal * push
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    sol = obj.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 1.0
    apply_modifiers(obj)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return obj


def build_clothes(body):
    def tunic(c):
        if c.z < 0.86 or c.z > 1.50:
            return False
        if abs(c.x) > 0.17 and c.z < 1.30:  # sleeves: only the upper arm
            return abs(c.x) < 0.27 and c.z > 1.24
        return True

    def pants(c):
        return 0.20 < c.z < 0.99 and abs(c.x) < 0.24

    shirt = region_copy(body, "Tunic", tunic, 0.010, 0.008, MATS["tunic"])
    # flare the hem: verts low on the tunic move outward
    for v in shirt.data.vertices:
        if v.co.z < 0.95:
            k = (0.95 - v.co.z) / 0.09
            v.co.x *= 1.0 + 0.12 * k
            v.co.y *= 1.0 + 0.15 * k
    trousers = region_copy(body, "Trousers", pants, 0.006, 0.006, MATS["trousers"])
    # belt: a torus at the waist, flattened and squashed to the body's oval
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.022, major_segments=40, minor_segments=8, location=(0, 0.0, 0.965))
    belt = bpy.context.active_object
    belt.name = "Belt"
    belt.scale = (1.06, 0.78, 0.65)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    belt.data.materials.append(MATS["leather"])
    bpy.ops.mesh.primitive_cube_add(size=0.05, location=(0, -0.122, 0.965))
    buckle = bpy.context.active_object
    buckle.scale = (1.0, 0.25, 0.8)
    bev = buckle.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.006
    bev.segments = 2
    apply_modifiers(buckle)
    buckle.data.materials.append(MATS["metal"])
    join_ordered(belt, [buckle])
    return [shirt, trousers, belt]


# ---------------------------------------------------------------- vertex colours ("AO")
def bake_vertex_ao(obj) -> None:
    """Cheap authored occlusion: darker toward the feet and in concave spots (vertex colour "AO")."""
    me = obj.data
    if "AO" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["AO"])
    attr = me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        h = min(max(v.co.z / 1.8, 0.0), 1.0)
        cav = 0.0
        if v.link_edges:
            avg = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            cav = (avg - v.co).dot(v.normal)  # >0 = concave
        k = 0.78 + 0.22 * h - max(cav, 0.0) * 25.0
        k = min(max(k, 0.55), 1.0)
        attr.data[v.index].color = (k, k, k, 1.0)
    bm.free()
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("AO")


def triangulate_fixed(obj) -> None:
    """Triangulate with a fixed diagonal. Left to the exporter, quads split differently run to run."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="FIXED", ngon_method="EAR_CLIP")
    bm.to_mesh(obj.data)
    bm.free()


# ---------------------------------------------------------------- armature
BONES = []  # (name, head, tail, parent)


def bone_table():
    t = [
        ("root", (0, 0, 0), (0, 0.25, 0), None),
        ("hips", HIP, SPINE, "root"),
        ("spine", SPINE, CHEST, "hips"),
        ("chest", CHEST, NECK, "spine"),
        ("neck", NECK, HEAD_BASE, "chest"),
        ("head", HEAD_BASE, HEAD_BASE + Vector((0, 0, 0.25)), "neck"),
    ]
    for s, sfx in ((1, "L"), (-1, "R")):
        hand_dir = (side(WRIST, s) - side(ELBOW, s)).normalized()
        t += [
            (f"shoulder.{sfx}", side(CLAV, s), side(SHOULDER, s), "chest"),
            (f"upper_arm.{sfx}", side(SHOULDER, s), side(ELBOW, s), f"shoulder.{sfx}"),
            (f"forearm.{sfx}", side(ELBOW, s), side(WRIST, s), f"upper_arm.{sfx}"),
            (f"hand.{sfx}", side(WRIST, s), side(WRIST, s) + hand_dir * 0.13, f"forearm.{sfx}"),
            (f"thigh.{sfx}", side(THIGH, s), side(KNEE, s), "hips"),
            (f"shin.{sfx}", side(KNEE, s), side(ANKLE, s), f"thigh.{sfx}"),
            (f"foot.{sfx}", side(ANKLE, s), side(TOE, s) + Vector((0, 0, 0.0)), f"shin.{sfx}"),
        ]
    return t


def build_armature():
    arm_data = bpy.data.armatures.new("Rig")
    rig = link(bpy.data.objects.new("Rig", arm_data))
    activate(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, tl, parent in bone_table():
        b = arm_data.edit_bones.new(name)
        b.head = Vector(h)
        b.tail = Vector(tl)
        d = Vector(tl) - Vector(h)
        b.align_roll(Vector((0, -1, 0)) if abs(d.y) < 0.9 * d.length else Vector((0, 0, 1)))
        if parent:
            b.parent = arm_data.edit_bones[parent]
            b.use_connect = (b.parent.tail - b.head).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def skin_to_rig(rig, auto_objs, rigid):
    """Automatic (bone-heat) weights for the deforming meshes; rigid parts get one bone each."""
    for o in bpy.context.view_layer.objects:
        o.select_set(o in auto_objs)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    for obj, bone in rigid:
        obj.vertex_groups.clear()
        vg = obj.vertex_groups.new(name=bone)
        vg.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
        obj.parent = rig
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
    # report verts that got no weight (bone heat failures show up here)
    for obj in auto_objs:
        unweighted = sum(1 for v in obj.data.vertices if not any(g.weight > 0 for g in v.groups))
        print(f"[build] weights {obj.name}: {len(obj.vertex_groups)} groups, {unweighted} unweighted verts", flush=True)


# ---------------------------------------------------------------- animation
def rest_rot(rig, bone):
    return rig.data.bones[bone].matrix_local.to_quaternion()


def world_q(axis, deg):
    return Quaternion(Vector(axis), math.radians(deg))


def set_pose(rig, bone, q_world=None, loc_world=None):
    """Pose a bone with a rotation/offset given in armature (world) axes, relative to rest."""
    pb = rig.pose.bones[bone]
    r = rest_rot(rig, bone)
    pb.rotation_mode = "QUATERNION"
    if q_world is not None:
        pb.rotation_quaternion = r.inverted() @ q_world @ r
    if loc_world is not None:
        pb.location = r.inverted() @ Vector(loc_world)


def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)


def clear_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))


def arms_down(rig, extra_l=0.0, extra_r=0.0, swing_l=0.0, swing_r=0.0, elbow_l=12.0, elbow_r=12.0):
    """A-pose rest -> relaxed arms. swing = forward(-)/back(+) about X; elbow bends forward."""
    for s, sfx, ex, sw, el in ((1, "L", extra_l, swing_l, elbow_l), (-1, "R", extra_r, swing_r, elbow_r)):
        q = world_q((1, 0, 0), sw) @ world_q((0, 1, 0), (22 + ex) * s)
        set_pose(rig, f"upper_arm.{sfx}", q)
        set_pose(rig, f"forearm.{sfx}", world_q((1, 0, 0), -el))


def ground_feet(rig, hips_q):
    """Tiny solver: after FK posing, drop/raise the hips so the lowest foot point rests on z=0."""
    bpy.context.view_layer.update()
    low = min(
        min(rig.pose.bones[f"foot.{sfx}"].head.z - (ANKLE.z - 0.004), rig.pose.bones[f"foot.{sfx}"].tail.z - (TOE.z - 0.004))
        for sfx in ("L", "R")
    )
    set_pose(rig, "hips", hips_q, (0, 0, -low))


def make_action(rig, name, frames, fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for f in frames:
        clear_pose(rig)
        fn(f)
        key_all(rig, f)
    # the last key equals the first: make cyclic explicit for Blender's own playback
    return act


def build_animations(rig):
    walk_len = 24  # frames per cycle at 24 fps -> 1.0 s, two steps

    def walk(f):
        t = f / walk_len
        w = 2 * math.pi * t
        for sfx, ph in (("L", 0.0), ("R", math.pi)):
            c = math.cos(w + ph)
            sn = math.sin(w + ph)
            thigh = -26.0 * c  # negative = forward
            knee = 6.0 + 52.0 * max(0.0, -sn) ** 1.4 + 8.0 * max(0.0, sn) * max(0.0, c)
            foot = -(thigh + knee) * 0.85 + (18.0 * max(0.0, -sn) * max(0.0, -c))  # flat + toe-off
            set_pose(rig, f"thigh.{sfx}", world_q((1, 0, 0), thigh))
            set_pose(rig, f"shin.{sfx}", world_q((1, 0, 0), knee))
            set_pose(rig, f"foot.{sfx}", world_q((1, 0, 0), foot))
        hips_q = world_q((0, 0, 1), 6.0 * math.cos(w)) @ world_q((0, 1, 0), 3.0 * math.sin(w))
        set_pose(rig, "hips", hips_q, (0, 0, 0))
        set_pose(rig, "spine", world_q((0, 0, 1), -4.0 * math.cos(w)) @ world_q((1, 0, 0), -4.0))
        set_pose(rig, "chest", world_q((0, 0, 1), -4.0 * math.cos(w)))
        set_pose(rig, "head", world_q((0, 0, 1), 2.0 * math.cos(w)) @ world_q((1, 0, 0), 3.0))
        arms_down(rig, swing_l=24.0 * math.cos(w), swing_r=-24.0 * math.cos(w), elbow_l=18 + 12 * max(0, -math.cos(w)), elbow_r=18 + 12 * max(0, math.cos(w)))
        ground_feet(rig, hips_q)

    idle_len = 48

    def idle(f):
        t = f / idle_len
        w = 2 * math.pi * t
        br = math.sin(w)
        set_pose(rig, "hips", world_q((0, 1, 0), 1.0 * math.sin(w)), (0, 0, -0.004 + 0.004 * br))
        set_pose(rig, "chest", world_q((1, 0, 0), -2.0 * br))
        set_pose(rig, "head", world_q((1, 0, 0), 2.0 * math.sin(w + 1.0)) @ world_q((0, 0, 1), 3.0 * math.sin(w * 0.5 * 2)))
        set_pose(rig, "shoulder.L", world_q((0, 1, 0), -1.5 * br))
        set_pose(rig, "shoulder.R", world_q((0, 1, 0), 1.5 * br))
        arms_down(rig, extra_l=2.0 * br, extra_r=2.0 * br, swing_l=3.0 * br, swing_r=-3.0 * br)
        for sfx in ("L", "R"):
            set_pose(rig, f"thigh.{sfx}", world_q((1, 0, 0), -3.0))
            set_pose(rig, f"shin.{sfx}", world_q((1, 0, 0), 6.0))
            set_pose(rig, f"foot.{sfx}", world_q((1, 0, 0), -3.0))

    # keys from frame 0 so glTF times start at 0.0 s (frame 1 would start the clip at 1/24 s)
    walk_act = make_action(rig, "walk", range(0, walk_len + 1, 2), walk)
    idle_act = make_action(rig, "idle", range(0, idle_len + 1, 4), idle)
    rig.animation_data.action = idle_act
    return walk_act, idle_act


# ---------------------------------------------------------------- main
MATS: dict[str, bpy.types.Material] = {}


def main():
    a = args()
    reset()
    MATS.update(
        skin=material("Skin", (0.80, 0.55, 0.42), 0.55),
        eye=material("Eye", (0.03, 0.03, 0.04), 0.15, vcol=False),
        hair=material("Hair", (0.42, 0.13, 0.06), 0.8),
        tunic=material("Tunic", tuple(float(c) for c in a.get("tunic", "0.18,0.42,0.20").split(",")), 0.85),
        trousers=material("Trousers", (0.30, 0.22, 0.15), 0.85),
        boot=material("Boot", (0.16, 0.09, 0.05), 0.6),
        leather=material("Leather", (0.35, 0.18, 0.07), 0.5),
        metal=material("Metal", (0.85, 0.70, 0.30), 0.3, vcol=False),
    )
    MATS["metal"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    step("setup+materials")

    body = build_body()
    body.data.materials.append(MATS["skin"])
    step("body (skin modifier + subsurf + sculpt brushes)")
    head = build_head()
    step("head (sphere + brushes, ears, eyes, hair)")
    hands = [build_hand(1), build_hand(-1)]
    boots = [build_boot(1), build_boot(-1)]
    step("hands + boots (skin modifier)")
    clothes = build_clothes(body)
    step("clothes (region copy + solidify, belt)")
    for o in [body, head, *hands, *boots, *clothes]:
        bake_vertex_ao(o)
        triangulate_fixed(o)
    step("vertex colour AO + fixed triangulation")

    rig = build_armature()
    belt = clothes[2]
    skin_to_rig(
        rig,
        auto_objs=[body, clothes[0], clothes[1], *boots],
        rigid=[(head, "head"), (hands[0], "hand.L"), (hands[1], "hand.R"), (belt, "hips")],
    )
    step("armature + automatic weights")
    build_animations(rig)
    step("actions: walk, idle")

    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == "MESH" for p in o.data.polygons)
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.name = o.name  # glTF mesh names (Godot node names) follow the objects
            print(f"[build]   {o.name}: {sum(len(p.vertices) - 2 for p in o.data.polygons)} tris", flush=True)
    print(f"[build] objects={len([o for o in bpy.data.objects if o.type == 'MESH'])} tris={tris} bones={len(rig.data.bones)}", flush=True)

    Path(a["blend"]).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(a["blend"]).resolve()))
    step("save .blend")

    Path(a["glb"]).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(Path(a["glb"]).resolve()),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_vertex_color="MATERIAL",
        export_texcoords=False,  # no textures; torus UVs also jitter by 1 ulp between runs
        export_force_sampling=True,
        export_frame_step=1,
    )
    step("export .glb")
    print(f"[build] TOTAL {time.perf_counter() - T0:.2f}s", flush=True)


if __name__ == "__main__":
    main()
