class_name OgLandmarkView
extends Node3D
## Draws the seeded landmarks (OgLandmark) as their chunks stream in: a floating island of strata rock with
## a grass cap, a ring of rune-carved ruins and a few trees on top, vines and a waterfall spilling off the rim
## into mist, debris orbiting it, a pillar of gold light running from the island toward the cosmic eye; on the
## ground beneath, the eye's geoglyph (drawn by the terrain shader from the og_landmark global, see
## og_landmark.gdshaderinc) inside a ring of rune-carved standing stones. Sized for the vista camera: from
## the geoglyph the whole island sits in the vista frame with the pillar leaving its top edge.
## The stones have no collision (like trees, G1): the rules never learn the landmark exists.
## Mood boards 04 (layered worlds), 05 (the pillar of light), 08 and 10 (floating, overgrown ruins), 12
## (glowing glyphs). Reads the store; never writes it.

const ISLAND_R := 11.0
const ISLAND_DEPTH := 9.0
## The geoglyph's radius on the ground and the standing stones around it (metres; tunable).
const GLYPH_R := 17.0
const STONES := 11
const PILLAR_LEN := 420.0
const BOB_M := 0.5
const BOB_RATE := 0.35
const DEBRIS := 9

static var _island_mesh: ArrayMesh
static var _ruin_mat: ShaderMaterial

var _store: OgChunkStore
var _seed := 0
var _sites := {} # Vector2i chunk -> Node3D
## Sites whose chunk is loaded but whose stone ring waits for the chunks under it (Vector2i -> Dictionary).
var _pending_stones := {}
var _time := 0.0
## With the post stack on, the post draws the pillar as a volume (OgPaintPost); the mesh pillar is for post off.
var mesh_pillar := true


func _init() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF


func setup(store: OgChunkStore, seed: int) -> void:
	_store = store
	_seed = seed
	store.chunk_loaded.connect(_on_chunk_loaded)
	store.chunk_unloaded.connect(_on_chunk_unloaded)


func _on_chunk_loaded(cx: int, cy: int) -> void:
	_place_pending_stones()
	var s := OgLandmark.site_in_chunk(_seed, cx, cy)
	if s.is_empty():
		return
	var p: Vector2 = s["pos"]
	var ground := _store.height_at(p.x, p.y)
	var node := _build(s["seed"], ground)
	node.position = Vector3(p.x, 0.0, p.y)
	node.name = "Landmark_%d_%d" % [cx, cy]
	add_child(node)
	var key := Vector2i(cx, cy)
	_sites[key] = node
	_pending_stones[key] = s
	_place_pending_stones()
	print("LANDMARK at (%.1f, %.1f) m, ground %.1f m" % [p.x, p.y, ground])


func _on_chunk_unloaded(cx: int, cy: int) -> void:
	var key := Vector2i(cx, cy)
	_pending_stones.erase(key)
	if _sites.has(key):
		_sites[key].queue_free()
		_sites.erase(key)


## Raises the stone ring of every pending site whose ground is all loaded (height_at on a chunk that is not
## loaded would generate it on the main thread).
func _place_pending_stones() -> void:
	for key: Vector2i in _pending_stones.keys():
		var s: Dictionary = _pending_stones[key]
		var p: Vector2 = s["pos"]
		var reach := GLYPH_R + 4.0
		var ready := true
		for cy in range(OgChunkStore.chunk_of(p.y - reach), OgChunkStore.chunk_of(p.y + reach) + 1):
			for cx in range(OgChunkStore.chunk_of(p.x - reach), OgChunkStore.chunk_of(p.x + reach) + 1):
				ready = ready and _store.is_loaded(cx, cy)
		if ready:
			_pending_stones.erase(key)
			_sites[key].add_child(_stones(s["seed"], p))


## The landmark nearest to `from` (world): {origin, dir, length, radius} of its pillar and {glyph: Vector3(x,
## z, radius)} of its geoglyph, or {} when no landmark is loaded.
func nearest(from: Vector3) -> Dictionary:
	var best := {}
	var best_d := INF
	for node: Node3D in _sites.values():
		var beam: Node3D = node.get_node("Beam")
		var d := Vector2(node.global_position.x - from.x, node.global_position.z - from.z).length()
		if d < best_d:
			best_d = d
			best = {"origin": beam.global_position, "dir": beam.global_basis.y.normalized(), "length": PILLAR_LEN, "radius": 1.6,
				"glyph": Vector3(node.global_position.x, node.global_position.z, GLYPH_R)}
	return best


func _process(delta: float) -> void:
	_time += delta
	for node: Node3D in _sites.values():
		var island: Node3D = node.get_node("Island")
		var base_y: float = island.get_meta("base_y")
		island.position.y = base_y + sin(_time * BOB_RATE + base_y) * BOB_M
		island.rotation.y = island.get_meta("yaw") + sin(_time * 0.05) * 0.03
		var debris: Node3D = node.get_node("Debris")
		debris.rotation.y = _time * 0.04


func _build(site_seed: int, ground: float) -> Node3D:
	var rng := OgRng.new(site_seed)
	var root := Node3D.new()
	var island := Node3D.new()
	island.name = "Island"
	var base_y := ground + OgLandmark.FLOAT_M + ISLAND_DEPTH
	island.position.y = base_y
	island.set_meta("base_y", base_y)
	var yaw := rng.next_float() * TAU
	island.rotation.y = yaw
	island.set_meta("yaw", yaw)
	root.add_child(island)

	# The rock body: strata walls and a grass cap (the terrain shader's surface kinds).
	var body := MeshInstance3D.new()
	body.mesh = _island()
	body.material_override = _terrain_material()
	island.add_child(body)

	# Grass on the cap.
	var grass := PackedFloat32Array()
	for i in 260:
		var a := rng.next_float() * TAU
		var r := sqrt(rng.next_float()) * ISLAND_R * 0.85
		var s := 0.7 + rng.next_float() * 0.6
		var yy := _cap_height(r)
		var co := cos(a * 7.0)
		var sn := sin(a * 7.0)
		grass.append_array([co * s, 0, sn * s, cos(a) * r, 0, s, 0, yy, -sn * s, 0, co * s, sin(a) * r,
			0.40, 0.50, 0.22, rng.next_float()])
	island.add_child(_multi(OgFoliage.KIND_GRASS, grass))

	# Trees on the cap, kept off the ruin ring.
	var trees := PackedFloat32Array()
	var pines := PackedFloat32Array()
	for i in 6:
		var a := rng.next_float() * TAU
		var r := ISLAND_R * (0.62 + rng.next_float() * 0.25)
		var h := 3.0 + rng.next_float() * 2.5
		var co := cos(a)
		var sn := sin(a)
		var arr := [co * h, 0, sn * h, cos(a) * r, 0, h, 0, _cap_height(r), -sn * h, 0, co * h, sin(a) * r, 0.4, 0.5, 0.2, rng.next_float()]
		if i % 2 == 0:
			pines.append_array(arr)
		else:
			trees.append_array(arr)
	island.add_child(_multi(OgFoliage.KIND_PINE, pines))
	island.add_child(_multi(OgFoliage.KIND_TREE, trees))

	# The ruin ring: rune-carved pillars, some broken, lintels across the tallest pairs, and a shrine.
	var ruin_mat := _ruin()
	const PILLARS := 8
	var heights: Array[float] = []
	for i in PILLARS:
		heights.append(3.0 + rng.next_float() * 2.0 if rng.next_float() < 0.7 else 1.0 + rng.next_float() * 1.2)
	for i in PILLARS:
		var a := i / float(PILLARS) * TAU
		var r := ISLAND_R * 0.45
		var col := CylinderMesh.new()
		col.top_radius = 0.34
		col.bottom_radius = 0.42
		col.height = heights[i]
		col.radial_segments = 8
		col.rings = 1
		var m := MeshInstance3D.new()
		m.mesh = col
		m.material_override = ruin_mat
		m.position = Vector3(cos(a) * r, _cap_height(r) + heights[i] * 0.5 - 0.2, sin(a) * r)
		m.rotation = Vector3((rng.next_float() - 0.5) * 0.08, rng.next_float(), (rng.next_float() - 0.5) * 0.08)
		island.add_child(m)
		var j := (i + 1) % PILLARS
		if heights[i] > 4.0 and heights[j] > 4.0:
			var b := (Vector3(cos(a), 0, sin(a)) + Vector3(cos(j / float(PILLARS) * TAU), 0, sin(j / float(PILLARS) * TAU))) * 0.5 * r
			var lintel := BoxMesh.new()
			lintel.size = Vector3(0.6, 0.55, r * 0.85)
			var l := MeshInstance3D.new()
			l.mesh = lintel
			l.material_override = ruin_mat
			l.position = Vector3(b.x, _cap_height(r) + minf(heights[i], heights[j]) - 0.1, b.z)
			l.rotation.y = -atan2(b.z, b.x)
			island.add_child(l)
	var shrine := CylinderMesh.new()
	shrine.top_radius = 0.0
	shrine.bottom_radius = 1.2
	shrine.height = 2.6
	shrine.radial_segments = 4
	var sh := MeshInstance3D.new()
	sh.mesh = shrine
	sh.material_override = ruin_mat
	sh.position = Vector3(0, _cap_height(0.0) + 1.5, 0)
	island.add_child(sh)

	# Vines hanging under the rim and a waterfall off one side.
	island.add_child(_vines(rng))
	var fall := MeshInstance3D.new()
	var fall_mesh := QuadMesh.new()
	fall_mesh.size = Vector2(2.2, 17.0)
	fall.mesh = fall_mesh
	var fall_mat := ShaderMaterial.new()
	fall_mat.shader = preload("res://src/render/shaders/waterfall.gdshader")
	fall.material_override = fall_mat
	fall.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var fa := rng.next_float() * TAU
	fall.position = Vector3(cos(fa) * (ISLAND_R + 0.4), 0.3 - 8.5, sin(fa) * (ISLAND_R + 0.4))
	fall.rotation.y = -fa + PI * 0.5
	island.add_child(fall)

	# Debris orbiting the island.
	var debris := Node3D.new()
	debris.name = "Debris"
	debris.position.y = base_y - 4.0
	for i in DEBRIS:
		var d := MeshInstance3D.new()
		d.mesh = OgPropMeshes.mesh(OgFoliage.KIND_ROCK)
		d.material_override = OgPropMeshes.material(OgFoliage.KIND_ROCK)
		var a := i / float(DEBRIS) * TAU + rng.next_float() * 0.5
		var r := ISLAND_R * (1.4 + rng.next_float() * 0.9)
		d.position = Vector3(cos(a) * r, (rng.next_float() - 0.5) * 10.0, sin(a) * r)
		d.scale = Vector3.ONE * (0.8 + rng.next_float() * 2.2)
		d.rotation = Vector3(rng.next_float() * 3.0, rng.next_float() * 3.0, rng.next_float() * 3.0)
		debris.add_child(d)
	root.add_child(debris)

	# The pillar of light toward the eye.
	var pillar := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 1.5
	pm.bottom_radius = 1.5
	pm.height = PILLAR_LEN
	pm.radial_segments = 16
	pm.rings = 1
	pm.cap_top = false
	pm.cap_bottom = false
	pillar.mesh = pm
	var pmat := ShaderMaterial.new()
	pmat.shader = preload("res://src/render/shaders/light_pillar.gdshader")
	pillar.material_override = pmat
	pillar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pillar.extra_cull_margin = 50.0
	var eye := OgWorldLook.dir_from(OgWorldLook.EYE_AZIMUTH_DEG, OgWorldLook.EYE_ELEVATION_DEG)
	var beam := Node3D.new()
	beam.position = Vector3(0, base_y + _cap_height(0.0) + 1.0, 0)
	beam.basis = Basis(Quaternion(Vector3.UP, eye))
	pillar.position = Vector3(0, PILLAR_LEN * 0.5, 0)
	beam.add_child(pillar)
	beam.name = "Beam"
	pillar.visible = mesh_pillar
	root.add_child(beam)

	# Gold light from the geoglyph and the pillar's foot: the landmark lights its own island, stones and the
	# wanderer (mood board 05: the pillar lights the scene around it). No shadows: two clustered lights.
	var glyph_light := OmniLight3D.new()
	glyph_light.light_color = Color(1.0, 0.68, 0.32)
	glyph_light.light_energy = 4.0
	glyph_light.omni_range = GLYPH_R + 6.0
	glyph_light.omni_attenuation = 1.4
	glyph_light.position = Vector3(0, ground + 3.0, 0)
	root.add_child(glyph_light)
	var top_light := OmniLight3D.new()
	top_light.light_color = Color(1.0, 0.74, 0.40)
	top_light.light_energy = 3.0
	top_light.omni_range = ISLAND_R * 1.8
	top_light.omni_attenuation = 1.2
	top_light.position = Vector3(0, -1.0, 0)
	beam.add_child(top_light)

	return root


func _multi(kind: int, buf: PackedFloat32Array) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = OgPropMeshes.mesh(kind)
	mm.instance_count = buf.size() / OgFoliage.FLOATS
	mm.buffer = buf
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = OgPropMeshes.material(kind)
	mmi.layers = OgTerrainView.PROP_LAYER
	if kind == OgFoliage.KIND_GRASS:
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mmi


static func _cap_height(r: float) -> float:
	return 1.4 * (1.0 - (r / ISLAND_R) * (r / ISLAND_R))


static func _terrain_material() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://src/render/shaders/terrain.gdshader")
	m.set_shader_parameter("fade_occluders", true)
	m.set_shader_parameter("geoglyph", false)
	return m


## The island: a domed grass cap over a jagged, tapering rock body (a teardrop of strata), flat-shaded.
## Vertex colour as the terrain mesher writes it (alpha = surface kind).
static func _island() -> ArrayMesh:
	if _island_mesh != null:
		return _island_mesh
	var rng := OgRng.new(0x15A1D)
	const SEG := 28
	var levels: Array[float] = [0.0, 0.5, 1.8, 3.8, 6.2, 8.6, ISLAND_DEPTH]
	var widths: Array[float] = [1.0, 1.02, 0.9, 0.7, 0.45, 0.22, 0.0]
	var rings := []
	for k in levels.size():
		var ring := PackedVector3Array()
		for s in SEG:
			var a := s / float(SEG) * TAU
			var jitter := 0.82 + rng.next_float() * 0.32 if k > 0 else 0.94 + rng.next_float() * 0.1
			var r := ISLAND_R * widths[k] * jitter
			var y := -levels[k] + (rng.next_float() - 0.5) * (0.8 if k > 0 else 0.25)
			ring.append(Vector3(cos(a) * r, y, sin(a) * r))
		rings.append(ring)
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var grass := Color(0.52, 0.50, 0.22, OgTerrainMesher.KIND_GRASS)
	var rock := OgTerrainMesher.ROCK
	# Cap: fan rings from the centre to the rim (two rings).
	var centre := Vector3(0, _cap_height(0.0), 0)
	var mid := PackedVector3Array()
	for s in SEG:
		var a := s / float(SEG) * TAU
		var r := ISLAND_R * 0.55
		mid.append(Vector3(cos(a) * r, _cap_height(r), sin(a) * r))
	var rim: PackedVector3Array = rings[0]
	for s in SEG:
		var t := (s + 1) % SEG
		_tri(verts, normals, colors, centre, mid[s], mid[t], grass)
		_tri(verts, normals, colors, mid[s], rim[s], rim[t], grass)
		_tri(verts, normals, colors, mid[s], rim[t], mid[t], grass)
	# Body: quads between rings, tip at the bottom.
	for k in levels.size() - 1:
		var up: PackedVector3Array = rings[k]
		var dn: PackedVector3Array = rings[k + 1]
		var c := rock if k > 0 else Color(0.36, 0.33, 0.22, OgTerrainMesher.KIND_DIRT)
		for s in SEG:
			var t := (s + 1) % SEG
			_tri(verts, normals, colors, up[s], dn[s], dn[t], c)
			_tri(verts, normals, colors, up[s], dn[t], up[t], c)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	_island_mesh = ArrayMesh.new()
	_island_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _island_mesh


## One flat-shaded triangle, wound so its normal faces away from the island's axis (or up on the cap).
static func _tri(verts: PackedVector3Array, normals: PackedVector3Array, colors: PackedColorArray, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	var n := (b - a).cross(c - a).normalized()
	var centroid := (a + b + c) / 3.0
	var outward := Vector3(centroid.x, 0.0, centroid.z)
	if col.a > 0.9:
		outward = Vector3.UP
	if n.dot(outward) < 0.0:
		n = -n
		var tmp := b
		b = c
		c = tmp
	# Godot's front faces are clockwise seen from outside.
	verts.append_array([a, c, b])
	normals.append_array([n, n, n])
	colors.append_array([col, col, col])


## Hanging vines: thin dark strips under the rim, swaying with the foliage shader.
func _vines(rng: OgRng) -> MeshInstance3D:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	for i in 40:
		var a := rng.next_float() * TAU
		var r := ISLAND_R * (0.9 + rng.next_float() * 0.12)
		var top := Vector3(cos(a) * r, -0.3, sin(a) * r)
		var length := 2.0 + rng.next_float() * 7.0
		var out := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-out.z, 0, out.x) * 0.12
		var bottom := top + Vector3(0, -length, 0) - out * 0.6
		var shade := rng.next_float()
		# Front and back faces (vines are seen from every side); r = 0 at the rim, 1 at the hanging tip so the
		# foliage shader sways the tip.
		var top_c := Color(0.0, shade, 0, 1)
		var tip_c := Color(1.0, shade, 0, 1)
		verts.append_array([top - side, top + side, bottom])
		normals.append_array([out, out, out])
		colors.append_array([top_c, top_c, tip_c])
		verts.append_array([top - side, bottom, top + side])
		normals.append_array([-out, -out, -out])
		colors.append_array([top_c, tip_c, top_c])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = OgPropMeshes.material(OgFoliage.KIND_PINE)
	return m


static func _ruin() -> ShaderMaterial:
	if _ruin_mat == null:
		_ruin_mat = ShaderMaterial.new()
		_ruin_mat.shader = preload("res://src/render/shaders/ruin.gdshader")
	return _ruin_mat


## The ring of standing stones around the geoglyph: tapered, rune-carved monoliths, a few broken or leaning,
## planted on the ground (heights from the store; every chunk under the ring is loaded). Skips water tiles.
## `p` is the site (world x, z); the returned node sits at the site's origin.
func _stones(site_seed: int, p: Vector2) -> Node3D:
	var rng := OgRng.new(OgRng.derive_seed(site_seed, [7]))
	var ring := Node3D.new()
	ring.name = "Stones"
	var mat := _ruin()
	var turn := rng.next_float() * TAU
	for i in STONES:
		var a := turn + i / float(STONES) * TAU + (rng.next_float() - 0.5) * 0.18
		var r := GLYPH_R + 1.6 + rng.next_float() * 1.2
		var x := p.x + cos(a) * r
		var z := p.y + sin(a) * r
		var tile := _store.tile_at(floori(x / OgWorld.TILE_M), floori(z / OgWorld.TILE_M))
		if not OgWalkability.TILE_RULES[tile]["walkable"]:
			continue
		var broken := rng.next_float() < 0.3
		var h := 1.2 + rng.next_float() * 1.4 if broken else 3.4 + rng.next_float() * 3.2
		var m := CylinderMesh.new()
		m.radial_segments = 4
		m.rings = 1
		m.bottom_radius = 0.75 + rng.next_float() * 0.2
		m.top_radius = m.bottom_radius * (0.75 if broken else 0.45 + rng.next_float() * 0.2)
		m.height = h
		var stone := MeshInstance3D.new()
		stone.mesh = m
		stone.material_override = mat
		var lean := (rng.next_float() - 0.5) * (0.5 if rng.next_float() < 0.3 else 0.08)
		stone.rotation = Vector3(lean, -a + PI * 0.25, (rng.next_float() - 0.5) * 0.08)
		stone.position = Vector3(cos(a) * r, _store.height_at(x, z) + h * 0.5 - 0.4, sin(a) * r)
		ring.add_child(stone)
	return ring
