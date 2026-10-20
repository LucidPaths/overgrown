"""Geometry helpers for the wanderer build: one Python-side accumulator for every part (vertices, faces, UVs,
per-vertex skin weights and occlusion), turned into a single Blender mesh with one from_pydata at the end.

Determinism: nothing here iterates an unordered container. Skin-modifier and quad-sphere parts are built as
temporary objects, their modifiers applied, then read back in index order and deleted.
"""

import math

import bmesh
import bpy
from mathutils import Vector

import wn_paint as paint


class Geo:
    def __init__(self):
        self.verts: list[Vector] = []
        self.faces: list[tuple[int, ...]] = []
        self.face_uvs: list[tuple[tuple[float, float], ...]] = []
        self.face_smooth: list[bool] = []
        self.weights: list[dict[str, float]] = []
        self.ao: list[float] = []
        self.tags: list[str] = []  # per vertex: which part made it (for reports and the AO pass)

    def add_vert(self, co, weights=None, tag="") -> int:
        self.verts.append(Vector(co))
        self.weights.append(dict(weights or {}))
        self.ao.append(1.0)
        self.tags.append(tag)
        return len(self.verts) - 1

    def add_face(self, idx, uvs, smooth=True) -> None:
        self.faces.append(tuple(idx))
        self.face_uvs.append(tuple(tuple(u) for u in uvs))
        self.face_smooth.append(smooth)

    def add_face_o(self, idx, uvs, expect, smooth=True) -> None:
        """Adds a face wound so its normal (Newell) points along `expect`."""
        n = Vector((0.0, 0.0, 0.0))
        m = len(idx)
        for k in range(m):
            a = self.verts[idx[k]]
            b = self.verts[idx[(k + 1) % m]]
            n.x += (a.y - b.y) * (a.z + b.z)
            n.y += (a.z - b.z) * (a.x + b.x)
            n.z += (a.x - b.x) * (a.y + b.y)
        if n.dot(Vector(expect)) < 0.0:
            idx = tuple(idx)[::-1]
            uvs = tuple(uvs)[::-1]
        self.add_face(idx, uvs, smooth)

    def tri_count(self, tag=None) -> int:
        n = 0
        for f in self.faces:
            if tag is None or self.tags[f[0]] == tag:
                n += len(f) - 2
        return n


# ---------------------------------------------------------------- grids (cloth sheets, tubes)
def grid_normals(P, ni, nj, wrap_i):
    """Per-point normals of a grid P[i][j] (i around, j down) from central differences."""
    N = []
    for i in range(ni):
        row = []
        for j in range(nj):
            if wrap_i:
                a = P[(i + 1) % ni][j] - P[(i - 1) % ni][j]
            else:
                a = P[min(i + 1, ni - 1)][j] - P[max(i - 1, 0)][j]
            b = P[i][min(j + 1, nj - 1)] - P[i][max(j - 1, 0)]
            n = a.cross(b)
            row.append(n.normalized() if n.length > 1e-12 else Vector((0, 0, 1)))
        N.append(row)
    return N


def add_sheet(geo: Geo, P, wrap_i, uv_out, uv_in, thickness, weight_fn, tag, rim_uv=None, outward=None):
    """A two-sided cloth sheet with thickness from a point grid P[i][j] (i around, j from top to bottom).

    The outer side uses uv_out(c, j), the inner side (offset inward by `thickness`) uses uv_in(c, j); the bottom
    edge gets a rim strip with its own vertices so the hem reads sharp (and open sheets get side rims).
    weight_fn(i, j, co) -> {bone: w}. With wrap_i, the seam column is duplicated for the UVs.
    outward(i, j) -> a vector on the outer side, used to orient normals (default: the grid normal sign that
    points away from the sheet's axis through its centroid).
    """
    ni = len(P)
    nj = len(P[0])
    N = grid_normals(P, ni, nj, wrap_i)
    if outward is None:
        cen = Vector((0, 0, 0))
        for row in P:
            for p in row:
                cen += p
        cen /= ni * nj

        def outward(i, j):
            d = P[i][j] - cen
            return Vector((d.x, d.y, 0.0))
    for i in range(ni):
        for j in range(nj):
            if N[i][j].dot(outward(i, j)) < 0:
                N[i][j] = -N[i][j]
    cols = ni + 1 if wrap_i else ni

    def build(uvf, offset, sign):
        idx = [[0] * nj for _ in range(cols)]
        for c in range(cols):
            i = c % ni
            for j in range(nj):
                co = P[i][j] + N[i][j] * offset
                idx[c][j] = geo.add_vert(co, weight_fn(i, j, co), tag)
        for c in range(cols - 1):
            for j in range(nj - 1):
                q = (idx[c][j], idx[c + 1][j], idx[c + 1][j + 1], idx[c][j + 1])
                uvq = (uvf(c, j), uvf(c + 1, j), uvf(c + 1, j + 1), uvf(c, j + 1))
                n = N[c % ni][j] + N[(c + 1) % ni][j + 1]
                geo.add_face_o(q, uvq, n * sign)
        return idx

    out_idx = build(uv_out, 0.0, 1.0)
    in_idx = build(uv_in, -thickness, -1.0)

    def rim(a_list, b_list, uvs, expect):
        va = [geo.add_vert(geo.verts[k].copy(), geo.weights[k], tag) for k in a_list]
        vb = [geo.add_vert(geo.verts[k].copy(), geo.weights[k], tag) for k in b_list]
        for k in range(len(va) - 1):
            q = (va[k], va[k + 1], vb[k + 1], vb[k])
            uvq = (uvs[k][0], uvs[k + 1][0], uvs[k + 1][1], uvs[k][1])
            geo.add_face_o(q, uvq, expect(k), smooth=False)

    ru = rim_uv or uv_out
    bottom_out = [out_idx[c][nj - 1] for c in range(cols)]
    bottom_in = [in_idx[c][nj - 1] for c in range(cols)]
    rim(bottom_in, bottom_out, [(ru(c, nj - 1), ru(c, nj - 1)) for c in range(cols)],
        lambda k: P[k % ni][nj - 1] - P[k % ni][nj - 2])
    if not wrap_i:
        left_out = [out_idx[0][j] for j in range(nj)]
        left_in = [in_idx[0][j] for j in range(nj)]
        rim(left_out, left_in, [(uv_out(0, j), uv_out(0, j)) for j in range(nj)], lambda k: P[0][k] - P[1][k])
        right_out = [out_idx[cols - 1][j] for j in range(nj)]
        right_in = [in_idx[cols - 1][j] for j in range(nj)]
        rim(right_in, right_out, [(uv_out(cols - 1, j), uv_out(cols - 1, j)) for j in range(nj)],
            lambda k: P[ni - 1][k] - P[ni - 2][k])
    return out_idx, in_idx, N


def add_tube(geo: Geo, path, radii, ring_n, region, weight_fn, tag, closed_loop=False, cap_end=True, u_scale=1.0,
             v_scale=1.0, flatten=None, twist=0.0, up_hint=(0, 0, 1), u0=0.0, swap_uv=False):
    """A tube along `path` (list of Vectors) with per-point radii, ring_n sides.

    UV: x of `region` runs along the path (u0 + t * u_scale), y around the ring. weight_fn(k, t, co) with k the
    path index and t in [0, 1] along the path. flatten: per-point (sx, sy) ring scale (sx along the frame's side
    vector, sy along its normal). Parallel-transport frames, so no flips. closed_loop joins the last ring to the
    first (scarf wraps). swap_uv: the region's x runs around the ring and y along the path instead.
    """
    n = len(path)

    def tuv(a_along, b_around):
        return paint.uv(region, b_around, a_along) if swap_uv else paint.uv(region, a_along, b_around)

    tangents = []
    for k in range(n):
        if closed_loop:
            t = path[(k + 1) % n] - path[(k - 1) % n]
        else:
            t = path[min(k + 1, n - 1)] - path[max(k - 1, 0)]
        tangents.append(t.normalized())
    up = Vector(up_hint)
    sv = tangents[0].cross(up)
    if sv.length < 1e-6:
        sv = tangents[0].cross(Vector((1, 0, 0)))
    sv.normalize()
    frames = []
    for k in range(n):
        t = tangents[k]
        sv = (sv - t * sv.dot(t)).normalized()
        nv = t.cross(sv).normalized()
        frames.append((sv.copy(), nv))
    lengths = [0.0]
    for k in range(1, n):
        lengths.append(lengths[-1] + (path[k] - path[k - 1]).length)
    total = lengths[-1] + ((path[0] - path[-1]).length if closed_loop else 0.0)
    total = max(total, 1e-9)
    rings = []
    rows = n + 1 if closed_loop else n
    for kk in range(rows):
        k = kk % n
        s_vec, n_vec = frames[k]
        r = radii[k]
        rw, rh = (r, r) if not isinstance(r, tuple) else r
        if flatten is not None:
            rw *= flatten[k][0]
            rh *= flatten[k][1]
        tpar = (lengths[k] / total) if kk < n else 1.0
        tw = twist * tpar
        ring = []
        for m in range(ring_n):
            a = 2 * math.pi * m / ring_n + tw
            co = path[k] + s_vec * (math.cos(a) * rw) + n_vec * (math.sin(a) * rh)
            ring.append(geo.add_vert(co, weight_fn(k, tpar, co), tag))
        rings.append((ring, tpar, k))
    for kk in range(rows - 1):
        ra, ta, ka = rings[kk]
        rb, tb, kb = rings[kk + 1]
        for m in range(ring_n):
            m2 = (m + 1) % ring_n
            ua, ub = u0 + ta * u_scale, u0 + tb * u_scale
            va, vb = m / ring_n * v_scale, (m + 1) / ring_n * v_scale
            q = (ra[m], rb[m], rb[m2], ra[m2])
            uvq = (tuv(ua, va), tuv(ub, va), tuv(ub, vb), tuv(ua, vb))
            expect = (geo.verts[ra[m]] + geo.verts[ra[m2]]) * 0.5 - path[ka]
            geo.add_face_o(q, uvq, expect)
    if cap_end and not closed_loop:
        ring, _, _ = rings[-1]
        tip = geo.add_vert(path[-1] + tangents[-1] * 0.004, weight_fn(n - 1, 1.0, path[-1]), tag)
        for m in range(ring_n):
            m2 = (m + 1) % ring_n
            uvt = tuv(u0 + u_scale * 0.999, (m + 0.5) / ring_n * v_scale)
            geo.add_face_o((ring[m], tip, ring[m2]), (uvt, uvt, uvt), tangents[-1])
    return rings


# ---------------------------------------------------------------- temporary-object parts
def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    for o in list(bpy.context.view_layer.objects):
        if o is not None:
            o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifiers(obj):
    activate(obj)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def skin_object(name, nodes, edges, root=0, subdiv_edges=0, levels=2):
    """Skin modifier + subsurf from a skeleton graph (the spike's builder). nodes: [(co, (rx, ry))]."""
    me = bpy.data.meshes.new(name)
    obj = link(bpy.data.objects.new(name, me))
    bm = bmesh.new()
    verts = [bm.verts.new(co) for co, _ in nodes]
    for a, b in edges:
        bm.edges.new((verts[a], verts[b]))
    if subdiv_edges:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv_edges, use_grid_fill=False)
    bm.to_mesh(me)
    bm.free()
    obj.modifiers.new("Skin", "SKIN")
    sk = me.skin_vertices[0].data
    orig = [Vector(co) for co, _ in nodes]
    for i, v in enumerate(me.vertices):
        if i < len(nodes):
            r = nodes[i][1]
        else:
            ds = sorted(((v.co - o).length, j) for j, o in enumerate(orig))
            (d0, j0), (d1, j1) = ds[0], ds[1]
            t = d0 / (d0 + d1)
            r0, r1 = nodes[j0][1], nodes[j1][1]
            r = (r0[0] * (1 - t) + r1[0] * t, r0[1] * (1 - t) + r1[1] * t)
        sk[i].radius = r
        sk[i].use_root = i == root
    sub = obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    apply_modifiers(obj)
    return obj


def quad_sphere(name, radius, location, levels=3, scale=(1.0, 1.0, 1.0)):
    """Cube -> subsurf -> cast: an all-quad sphere (primitive_uv_sphere_add is nondeterministic in 4.5.14)."""
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


def absorb(geo: Geo, obj, uv_fn, weight_fn, tag, smooth=True):
    """Copies a temporary object's mesh (world space, index order) into geo and deletes the object.
    uv_fn(co, face_center) -> (u, v); weight_fn(co) -> {bone: w}."""
    me = obj.data
    mw = obj.matrix_world
    base = len(geo.verts)
    for v in me.vertices:
        co = mw @ v.co
        geo.add_vert(co, weight_fn(co), tag)
    for p in me.polygons:
        idx = [base + k for k in p.vertices]
        c = mw @ p.center
        uvs = [uv_fn(geo.verts[k], c) for k in idx]
        geo.add_face(idx, uvs, smooth)
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    bpy.context.view_layer.update()


def smooth_falloff(d, r):
    if d >= r:
        return 0.0
    x = 1.0 - (d / r) ** 2
    return x * x


def grab(obj, center, radius, offset, scale=(1.0, 1.0, 1.0)):
    c = Vector(center)
    off = Vector(offset)
    for v in obj.data.vertices:
        d = v.co - c
        d = Vector((d.x / scale[0], d.y / scale[1], d.z / scale[2]))
        w = smooth_falloff(d.length, radius)
        if w:
            v.co += off * w


# ---------------------------------------------------------------- collision (draping)
def seg_closest(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return a + ab * t


def push_out(p: Vector, capsules, margin) -> Vector:
    """Moves p out of every capsule (a, b, r) to distance r + margin. Capsules are processed in list order."""
    for a, b, r in capsules:
        c = seg_closest(p, a, b)
        d = p - c
        L = d.length
        need = r + margin
        if L < need:
            if L < 1e-9:
                d = Vector((0, 0, 1))
                L = 1.0
            p = c + d * (need / L)
    return p


# ---------------------------------------------------------------- final mesh
def build_object(geo: Geo, name, bone_names, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in geo.verts], [], geo.faces)
    me.validate(clean_customdata=False)
    if len(me.polygons) != len(geo.faces):
        raise RuntimeError(f"validate dropped faces: {len(geo.faces)} -> {len(me.polygons)}")
    uvl = me.uv_layers.new(name="UVMap")
    li = 0
    for fi, p in enumerate(me.polygons):
        for k in range(p.loop_total):
            uvl.data[p.loop_start + k].uv = geo.face_uvs[fi][k]
        p.use_smooth = geo.face_smooth[fi]
        li += p.loop_total
    obj = link(bpy.data.objects.new(name, me))
    groups = {b: obj.vertex_groups.new(name=b) for b in bone_names}
    for vi, w in enumerate(geo.weights):
        items = sorted(((x, b) for b, x in w.items() if x > 1e-4), key=lambda t: (-t[0], t[1]))[:4]
        tot = sum(x for x, _ in items)
        if tot <= 0:
            raise RuntimeError(f"vertex {vi} ({geo.tags[vi]}) has no weight")
        for x, b in items:
            groups[b].add([vi], x / tot, "REPLACE")
    attr = me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
    for vi, k in enumerate(geo.ao):
        attr.data[vi].color = (k, k, k, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("AO")
    me.materials.append(material)
    # fixed triangulation (the exporter would split quads differently run to run)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="FIXED", ngon_method="EAR_CLIP")
    bm.to_mesh(me)
    bm.free()
    return obj
