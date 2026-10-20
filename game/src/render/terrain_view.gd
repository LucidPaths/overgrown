class_name OgTerrainView
extends Node3D
## Draws the chunks an OgChunkStore streams in. Reads the store, never writes it.
## On chunk_loaded a WorkerThreadPool task builds the mesh arrays (OgTerrainMesher); _process turns at most
## MESH_ADDS_PER_FRAME finished builds per frame into MeshInstance3Ds. chunk_unloaded frees the chunk's
## nodes; a build still running for it is waited for in the background and dropped.

## Finished builds turned into nodes per frame (tunable).
const MESH_ADDS_PER_FRAME := 2


## Grass and reeds are drawn only for chunks within this distance of the camera (metres; their shader also
## shrinks them away before it).
const GRASS_RANGE_M := 72.0
## Visual layer for props (decals such as the landmark's rune circle paint layer 1, the ground, only).
const PROP_LAYER := 2


## One mesh build. The worker writes only `arrays` and `props`; the main thread reads them after the task
## completes.
class _Build:
	extends RefCounted
	var seed := 0
	var chunk: OgChunkStore.Chunk
	var task_id := -1
	var arrays: Dictionary
	var props: Array
	var usec := 0

	func run() -> void:
		var start := Time.get_ticks_usec()
		arrays = OgTerrainMesher.build(chunk)
		props = OgFoliage.place(seed, chunk)
		usec = Time.get_ticks_usec() - start


## Timings for the AC4 report: worker build times and main-thread add times, in microseconds.
var build_usec: Array[int] = []
var add_usec: Array[int] = []

var _store: OgChunkStore
var _seed := 0
var _builds := {} # Vector2i -> _Build, for loaded chunks not yet added; insertion order = load order
var _dropped: Array[_Build] = [] # builds of unloaded chunks, waited for and discarded
var _nodes := {} # Vector2i -> MeshInstance3D (ground; the water mesh is its child)
var _ground_mat := ShaderMaterial.new()
var _water_mat := ShaderMaterial.new()


func _init() -> void:
	# Chunks never move; children inherit this.
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	_ground_mat.shader = preload("res://src/render/shaders/terrain.gdshader")
	_water_mat.shader = preload("res://src/render/shaders/water.gdshader")


## The first mesh with each material costs 40-90 ms on the main thread (shader and pipeline compile, measured
## under xvfb); pay it once here, before chunks stream in, with a one-triangle mesh in each mesh format.
func _ready() -> void:
	for spec: Array in [[_ground_mat, false], [_water_mat, true]]:
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3.ZERO, Vector3.RIGHT, Vector3.BACK])
		arrays[Mesh.ARRAY_NORMAL] = PackedVector3Array([Vector3.UP, Vector3.UP, Vector3.UP])
		arrays[Mesh.ARRAY_COLOR] = PackedColorArray([Color.WHITE, Color.WHITE, Color.WHITE])
		if spec[1]:
			arrays[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2])
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var warm := MeshInstance3D.new()
		warm.mesh = mesh
		warm.material_override = spec[0]
		add_child(warm)
		get_tree().process_frame.connect(warm.queue_free, CONNECT_ONE_SHOT)


func setup(store: OgChunkStore, seed: int) -> void:
	_store = store
	_seed = seed
	store.chunk_loaded.connect(_on_chunk_loaded)
	store.chunk_unloaded.connect(_on_chunk_unloaded)


## True once chunk (cx, cy) has its nodes in the tree.
func is_meshed(cx: int, cy: int) -> bool:
	return _nodes.has(Vector2i(cx, cy))


func meshed_count() -> int:
	return _nodes.size()


func _on_chunk_loaded(cx: int, cy: int) -> void:
	var key := Vector2i(cx, cy)
	var b := _Build.new()
	b.chunk = _store.chunk(cx, cy)
	b.seed = _seed
	b.task_id = WorkerThreadPool.add_task(b.run, false, "mesh %d,%d" % [cx, cy])
	_builds[key] = b


func _on_chunk_unloaded(cx: int, cy: int) -> void:
	var key := Vector2i(cx, cy)
	if _builds.has(key):
		_dropped.append(_builds[key])
		_builds.erase(key)
	if _nodes.has(key):
		_nodes[key].queue_free()
		_nodes.erase(key)


func _process(_delta: float) -> void:
	var keep: Array[_Build] = []
	for b in _dropped:
		if WorkerThreadPool.is_task_completed(b.task_id):
			WorkerThreadPool.wait_for_task_completion(b.task_id)
		else:
			keep.append(b)
	_dropped = keep
	var added := 0
	for key: Vector2i in _builds.keys():
		if added >= MESH_ADDS_PER_FRAME:
			break
		var b: _Build = _builds[key]
		if not WorkerThreadPool.is_task_completed(b.task_id):
			continue
		WorkerThreadPool.wait_for_task_completion(b.task_id)
		_builds.erase(key)
		build_usec.append(b.usec)
		var start := Time.get_ticks_usec()
		_add(key, b.arrays, b.props)
		add_usec.append(Time.get_ticks_usec() - start)
		added += 1


func _add(key: Vector2i, arrays: Dictionary, props: Array) -> void:
	var ground := ArrayMesh.new()
	ground.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays["ground"])
	var node := MeshInstance3D.new()
	node.name = "Chunk_%d_%d" % [key.x, key.y]
	node.mesh = ground
	node.material_override = _ground_mat
	node.position = Vector3(key.x * OgChunkStore.CHUNK_M, 0.0, key.y * OgChunkStore.CHUNK_M)
	if not arrays["water"].is_empty():
		var water := ArrayMesh.new()
		water.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays["water"])
		var w := MeshInstance3D.new()
		w.name = "Water"
		w.mesh = water
		w.material_override = _water_mat
		w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node.add_child(w)
	for kind in OgFoliage.KIND_COUNT:
		var buf: PackedFloat32Array = props[kind]
		if buf.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.mesh = OgPropMeshes.mesh(kind)
		mm.instance_count = buf.size() / OgFoliage.FLOATS
		mm.buffer = buf
		var mmi := MultiMeshInstance3D.new()
		mmi.name = OgFoliage.KIND_NAMES[kind]
		mmi.multimesh = mm
		mmi.material_override = OgPropMeshes.material(kind)
		mmi.layers = PROP_LAYER
		if kind == OgFoliage.KIND_GRASS or kind == OgFoliage.KIND_REED:
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mmi.visibility_range_end = GRASS_RANGE_M
		node.add_child(mmi)
	add_child(node)
	_nodes[key] = node


func _exit_tree() -> void:
	for b: _Build in _builds.values():
		WorkerThreadPool.wait_for_task_completion(b.task_id)
	for b in _dropped:
		WorkerThreadPool.wait_for_task_completion(b.task_id)
	_builds.clear()
	_dropped.clear()
