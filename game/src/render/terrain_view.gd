class_name OgTerrainView
extends Node3D
## Draws the chunks an OgChunkStore streams in. Reads the store, never writes it.
## On chunk_loaded a WorkerThreadPool task builds the mesh arrays (OgTerrainMesher); _process turns at most
## MESH_ADDS_PER_FRAME finished builds per frame into MeshInstance3Ds. chunk_unloaded frees the chunk's
## nodes; a build still running for it is waited for in the background and dropped.

## Finished builds turned into nodes per frame (tunable).
const MESH_ADDS_PER_FRAME := 2


## One mesh build. The worker writes only `arrays`; the main thread reads it after the task completes.
class _Build:
	extends RefCounted
	var chunk: OgChunkStore.Chunk
	var task_id := -1
	var arrays: Dictionary
	var usec := 0

	func run() -> void:
		var start := Time.get_ticks_usec()
		arrays = OgTerrainMesher.build(chunk)
		usec = Time.get_ticks_usec() - start


## Timings for the AC4 report: worker build times and main-thread add times, in microseconds.
var build_usec: Array[int] = []
var add_usec: Array[int] = []

var _store: OgChunkStore
var _builds := {} # Vector2i -> _Build, for loaded chunks not yet added; insertion order = load order
var _dropped: Array[_Build] = [] # builds of unloaded chunks, waited for and discarded
var _nodes := {} # Vector2i -> MeshInstance3D (ground; the water mesh is its child)
var _ground_mat := ShaderMaterial.new()
var _water_mat := StandardMaterial3D.new()


func _init() -> void:
	# Chunks never move; children inherit this.
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	_ground_mat.shader = preload("res://src/render/shaders/terrain.gdshader")
	_water_mat.vertex_color_use_as_albedo = true
	_water_mat.vertex_color_is_srgb = true
	_water_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_water_mat.roughness = 0.08
	_water_mat.metallic_specular = 0.6


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


func setup(store: OgChunkStore) -> void:
	_store = store
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
		_add(key, b.arrays)
		add_usec.append(Time.get_ticks_usec() - start)
		added += 1


func _add(key: Vector2i, arrays: Dictionary) -> void:
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
	add_child(node)
	_nodes[key] = node


func _exit_tree() -> void:
	for b: _Build in _builds.values():
		WorkerThreadPool.wait_for_task_completion(b.task_id)
	for b in _dropped:
		WorkerThreadPool.wait_for_task_completion(b.task_id)
	_builds.clear()
	_dropped.clear()
