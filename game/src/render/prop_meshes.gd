class_name OgPropMeshes
extends RefCounted
## The G1 prop meshes, built in code once (ART-027, docs/art/BIBLE.md "Props"): grass clumps, pines,
## broadleaf trees, flowering bushes, rocks. Low poly on purpose: the painted light, the post stack's brush
## strokes and wind carry the detail, not the geometry. Each is one ArrayMesh in unit size (instances scale it),
## base at the origin, +Y up. Built from a fixed seed, so every run gets the same shapes.
##
## Vertex colour channels, read by the foliage shaders:
##   r = height fraction (0 at the base, 1 at the top): wind bend and tip colour
##   g = a per-part random (shade variation)
##   b = a flower or highlight mask (bushes)
##   a = 1 for foliage, 0 for trunks
## Canopy normals are bent toward a sphere around the canopy (the "cloud" shading painters use for trees).

const MESH_SEED := 0x0637A1

static var _cache := {}


## The mesh for `kind` (one of OgFoliage.KIND_*), built on first use. Main thread only.
static func mesh(kind: int) -> ArrayMesh:
	if not _cache.has(kind):
		var rng := OgRng.new(OgRng.derive_seed(MESH_SEED, [kind]))
		var arrays: Array
		match kind:
			OgFoliage.KIND_GRASS:
				arrays = _grass(rng)
			OgFoliage.KIND_PINE:
				arrays = _pine(rng)
			OgFoliage.KIND_TREE:
				arrays = _tree(rng)
			OgFoliage.KIND_BUSH:
				arrays = _bush(rng)
			OgFoliage.KIND_ROCK:
				arrays = _rock(rng)
			OgFoliage.KIND_REED:
				arrays = _reed(rng)
		var m := ArrayMesh.new()
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		_cache[kind] = m
	return _cache[kind]


class _Builder:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()

	func tri(a: Vector3, b: Vector3, c: Vector3, na: Vector3, nb: Vector3, nc: Vector3, ca: Color, cb: Color, cc: Color) -> void:
		# Godot's front face is clockwise; callers pass counter-clockwise (seen from outside), so swap.
		verts.append_array([a, c, b])
		normals.append_array([na, nc, nb])
		colors.append_array([ca, cc, cb])

	func arrays() -> Array:
		var a := []
		a.resize(Mesh.ARRAY_MAX)
		a[Mesh.ARRAY_VERTEX] = verts
		a[Mesh.ARRAY_NORMAL] = normals
		a[Mesh.ARRAY_COLOR] = colors
		return a


## 9 curved blades, 0.45..0.85 tall, leaning outward. Normals point up: grass is lit like the ground under it.
static func _grass(rng: OgRng) -> Array:
	var b := _Builder.new()
	for i in 9:
		var az := rng.next_float() * TAU
		var base := Vector3(cos(az), 0, sin(az)) * rng.next_float() * 0.22
		var h := 0.45 + rng.next_float() * 0.4
		var lean := 0.15 + rng.next_float() * 0.35
		var face_az := az + (rng.next_float() - 0.5) * 1.2
		var out := Vector3(cos(face_az), 0, sin(face_az))
		var side := Vector3(-out.z, 0, out.x)
		var w := 0.045 + rng.next_float() * 0.03
		var rnd := rng.next_float()
		var rows: Array[Vector3] = []
		var fr: Array[float] = []
		for s in 4:
			var t := s / 3.0
			rows.append(base + out * lean * h * t * t + Vector3(0, h * t * (1.0 - 0.15 * t * t), 0))
			fr.append(t)
		for s in 3:
			var w0 := w * (1.0 - fr[s])
			var w1 := w * (1.0 - fr[s + 1])
			var c0 := Color(fr[s], rnd, 0, 1)
			var c1 := Color(fr[s + 1], rnd, 0, 1)
			var a0 := rows[s] - side * w0
			var a1 := rows[s] + side * w0
			var b0 := rows[s + 1] - side * w1
			var b1 := rows[s + 1] + side * w1
			b.tri(a0, a1, b1, Vector3.UP, Vector3.UP, Vector3.UP, c0, c0, c1)
			if s < 2:
				b.tri(a0, b1, b0, Vector3.UP, Vector3.UP, Vector3.UP, c0, c1, c1)
	return b.arrays()


## Tall reeds for river banks: 6 stiff blades, 1 m.
static func _reed(rng: OgRng) -> Array:
	var b := _Builder.new()
	for i in 6:
		var az := rng.next_float() * TAU
		var base := Vector3(cos(az), 0, sin(az)) * rng.next_float() * 0.15
		var h := 0.8 + rng.next_float() * 0.5
		var out := Vector3(cos(az), 0, sin(az))
		var side := Vector3(-out.z, 0, out.x)
		var w := 0.03
		var rnd := rng.next_float()
		var top := base + out * 0.12 * h + Vector3(0, h, 0)
		b.tri(base - side * w, base + side * w, top, Vector3.UP, Vector3.UP, Vector3.UP, Color(0, rnd, 0), Color(0, rnd, 0), Color(1, rnd, 0))
	return b.arrays()


## A conifer, 1 m tall (instances scale it 6..16 m): a thin trunk under 6 jagged, drooping skirts.
static func _pine(rng: OgRng) -> Array:
	var b := _Builder.new()
	_cylinder(b, Vector3.ZERO, 1.0, 0.022, 0.008, 6, Color(0, 0.1, 0, 0), Color(1, 0.1, 0, 0))
	const TIERS := 6
	for t in TIERS:
		var f := t / float(TIERS - 1)
		var y_bottom := lerpf(0.16, 0.78, f)
		var radius := lerpf(0.22, 0.05, f) * (0.9 + rng.next_float() * 0.2)
		var height := lerpf(0.30, 0.24, f)
		var apex := Vector3(0, y_bottom + height, 0)
		const SEG := 11
		var ring: Array[Vector3] = []
		for s in SEG:
			var a := s / float(SEG) * TAU + rng.next_float() * 0.25
			var r := radius * (0.72 + rng.next_float() * 0.5)
			var droop := -rng.next_float() * 0.05
			ring.append(Vector3(cos(a) * r, y_bottom + droop, sin(a) * r))
		var shade := rng.next_float()
		for s in SEG:
			var p0 := ring[s]
			var p1 := ring[(s + 1) % SEG]
			var n0 := _cone_normal(p0, apex)
			var n1 := _cone_normal(p1, apex)
			var na := (n0 + n1).normalized().lerp(Vector3.UP, 0.5).normalized()
			b.tri(p0, p1, apex, n0, n1, na, Color(p0.y, shade, 0, 1), Color(p1.y, shade, 0, 1), Color(apex.y, shade, 0, 1))
			# The skirt's underside, so it reads solid from a low angle.
			var under := Vector3(0, y_bottom + 0.06, 0)
			b.tri(p1, p0, under, Vector3.DOWN, Vector3.DOWN, Vector3.DOWN, Color(p1.y, shade * 0.3, 0, 1), Color(p0.y, shade * 0.3, 0, 1), Color(under.y, 0, 0, 1))
	return b.arrays()


static func _cone_normal(p: Vector3, apex: Vector3) -> Vector3:
	var radial := Vector3(p.x, 0, p.z).normalized()
	var slope := (apex - p).normalized()
	var tangent := radial.cross(Vector3.UP)
	var n := slope.cross(tangent).normalized()
	if n.dot(radial) < 0.0:
		n = -n
	return n.lerp(radial, 0.3).normalized()


## A broadleaf tree, 1 m tall (instances scale it 4..9 m): a trunk and a cloud of 7 lumpy blobs.
static func _tree(rng: OgRng) -> Array:
	var b := _Builder.new()
	_cylinder(b, Vector3.ZERO, 0.55, 0.05, 0.03, 6, Color(0, 0.1, 0, 0), Color(0.55, 0.1, 0, 0))
	var centre := Vector3(0, 0.68, 0)
	for i in 7:
		var off := Vector3(rng.next_float() - 0.5, (rng.next_float() - 0.4) * 0.6, rng.next_float() - 0.5) * 0.42
		if i == 0:
			off = Vector3(0, 0.08, 0)
		var r := 0.17 + rng.next_float() * 0.1
		_blob(b, rng, centre + off, r, centre, 0.55, 1, rng.next_float(), 0.0)
	return b.arrays()


## A flowering bush, 1 m tall (instances scale it 0.8..2 m): 4 blobs near the ground, flower specks in b.
static func _bush(rng: OgRng) -> Array:
	var b := _Builder.new()
	var centre := Vector3(0, 0.45, 0)
	for i in 4:
		var off := Vector3(rng.next_float() - 0.5, 0, rng.next_float() - 0.5) * 0.5
		off.y = rng.next_float() * 0.2
		var r := 0.28 + rng.next_float() * 0.14
		_blob(b, rng, centre + off, r, centre, 0.6, 1, rng.next_float(), 1.0)
	return b.arrays()


## A rock, about 1 m across: a lumpy, flattened, faceted icosphere (flat normals: painted planes).
static func _rock(rng: OgRng) -> Array:
	var b := _Builder.new()
	var ico := _icosphere(1)
	var pts: PackedVector3Array = ico[0]
	var idx: PackedInt32Array = ico[1]
	var bumps := PackedFloat32Array()
	for p in pts:
		bumps.append(0.75 + rng.next_float() * 0.4)
	for k in range(0, idx.size(), 3):
		var tri: Array[Vector3] = []
		for j in 3:
			var p: Vector3 = pts[idx[k + j]] * bumps[idx[k + j]] * 0.5
			p.y = p.y * 0.62 + 0.18
			tri.append(p)
		var n := (tri[1] - tri[0]).cross(tri[2] - tri[0]).normalized()
		if n.dot(tri[0] + tri[1] + tri[2]) < 0.0:
			n = -n
		var shade := rng.next_float()
		b.tri(tri[0], tri[1], tri[2], n, n, n, Color(tri[0].y, shade, 0, 1), Color(tri[1].y, shade, 0, 1), Color(tri[2].y, shade, 0, 1))
	return b.arrays()


## A lumpy icosphere blob at `at`, radius r; normals blend toward the sphere around `centre` by `cloud`.
static func _blob(b: _Builder, rng: OgRng, at: Vector3, r: float, centre: Vector3, cloud: float, subdiv: int, shade: float, flowers: float) -> void:
	var ico := _icosphere(subdiv)
	var pts: PackedVector3Array = ico[0]
	var idx: PackedInt32Array = ico[1]
	var pos := PackedVector3Array()
	var cols := PackedColorArray()
	for p in pts:
		var bump := 0.85 + rng.next_float() * 0.3
		var q := at + p * r * bump
		pos.append(q)
		var flower := 1.0 if flowers > 0.0 and p.y > -0.1 and rng.next_float() < 0.35 else 0.0
		cols.append(Color(clampf(q.y, 0.0, 1.0), shade, flower, 1))
	for k in range(0, idx.size(), 3):
		var t: Array[Vector3] = [pos[idx[k]], pos[idx[k + 1]], pos[idx[k + 2]]]
		var ns: Array[Vector3] = []
		for j in 3:
			var own := (pts[idx[k + j]]).normalized()
			var sph := (t[j] - centre).normalized()
			ns.append(own.lerp(sph, cloud).normalized())
		b.tri(t[0], t[1], t[2], ns[0], ns[1], ns[2], cols[idx[k]], cols[idx[k + 1]], cols[idx[k + 2]])


## An open cylinder from `base` up `h`, radii r0 (bottom) and r1 (top).
static func _cylinder(b: _Builder, base: Vector3, h: float, r0: float, r1: float, seg: int, c0: Color, c1: Color) -> void:
	for s in seg:
		var a0 := s / float(seg) * TAU
		var a1 := (s + 1) / float(seg) * TAU
		var d0 := Vector3(cos(a0), 0, sin(a0))
		var d1 := Vector3(cos(a1), 0, sin(a1))
		var p00 := base + d0 * r0
		var p10 := base + d1 * r0
		var p01 := base + d0 * r1 + Vector3(0, h, 0)
		var p11 := base + d1 * r1 + Vector3(0, h, 0)
		b.tri(p00, p01, p10, d0, d0, d1, c0, c1, c0)
		b.tri(p10, p01, p11, d1, d0, d1, c0, c1, c1)


## Unit icosphere: [points, triangle indices (counter-clockwise from outside)].
static func _icosphere(subdiv: int) -> Array:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var pts := PackedVector3Array()
	for v in [Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0), Vector3(0, -1, t), Vector3(0, 1, t),
			Vector3(0, -1, -t), Vector3(0, 1, -t), Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1)]:
		pts.append(v.normalized())
	var idx := PackedInt32Array([0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
		3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1])
	for s in subdiv:
		var mid := {}
		var out := PackedInt32Array()
		for k in range(0, idx.size(), 3):
			var a := idx[k]
			var b := idx[k + 1]
			var c := idx[k + 2]
			var ab := _mid(pts, mid, a, b)
			var bc := _mid(pts, mid, b, c)
			var ca := _mid(pts, mid, c, a)
			out.append_array([a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca])
		idx = out
	return [pts, idx]


static func _mid(pts: PackedVector3Array, mid: Dictionary, a: int, b: int) -> int:
	var key := Vector2i(mini(a, b), maxi(a, b))
	if mid.has(key):
		return mid[key]
	pts.append(((pts[a] + pts[b]) * 0.5).normalized())
	mid[key] = pts.size() - 1
	return pts.size() - 1
