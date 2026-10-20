class_name OgPaintPost
extends CompositorEffect
## The painterly post stack (ART-027, docs/art/BIBLE.md "Post"). Runs after the transparent pass on the
## scene's HDR colour and depth, as compute passes (game/src/render/post/*.glsl):
##   1 prep       full res -> paint res: painted depth fog and valley mist, tonemap, downsample
##   2 tensor     structure tensor of the paint image
##   3 blur x2    Gaussian-smoothed tensor (the stroke field)
##   4 kuwahara   anisotropic Kuwahara: flat areas become dabs, edges become strokes
##   5 composite  full res: upsample, brush hairs along the stroke field, focal clarity, palette grade,
##                canvas grain, vignette; written back into the colour buffer
## The paint resolution is capped (PAINT_HEIGHT_*), so the cost of the heavy pass does not grow with the
## screen; the composite restores fine texture at full resolution.
## Quality: OgWorldLook.Post.LOW (isotropic, smaller paint buffer, no blur) or HIGH.

## Paint buffer height cap per quality (px). Below the cap the paint runs at the screen resolution.
const PAINT_HEIGHT_LOW := 400
const PAINT_HEIGHT_HIGH := 540
## Kuwahara radius in paint px (tunable).
const RADIUS_LOW := 3.0
const RADIUS_HIGH := 5.0
## Structure tensor smoothing (paint px).
const TENSOR_SIGMA := 2.0
## Brush hair strength and LIC half-length (full-res px at 720p; scaled with the height).
const STROKE := 0.45
const STROKE_LEN_PX := 6.0
const GRADE := 0.8
const GRAIN := 0.045
## Unsharp mask on the upsampled paint (0 = soft upscale).
const SHARPEN := 0.9
## Valley mist strength.
const MIST := 0.85
## Focal clarity: radius as a fraction of the screen height, and how much of the sharp render it keeps.
const FOCUS_RADIUS := 0.11
const FOCUS_STRENGTH := 0.45

const CONTEXT := &"og_paint"

## OgWorldLook.Post.LOW or HIGH.
var quality := 2
## Written by OgWorldLook every frame (main thread); read on the render thread.
var fog_begin := 30.0
var fog_end := 90.0
var time := 0.0
var eye_dir := Vector3(0, 0.3, -0.95)
## (x, z unit direction, strength, 0), as og_wind.
var wind := Vector4(1, 0, 1, 0)
## Focus point in screen uv (0..1), or negative to disable.
var focus_uv := Vector2(-10, -10)

var _rd: RenderingDevice
var _shaders := {} # name -> RID
var _pipelines := {} # name -> RID
var _linear: RID
var _nearest: RID
var _frame_ubo: RID
var _ok := false


func _init() -> void:
	effect_callback_type = EFFECT_CALLBACK_TYPE_POST_TRANSPARENT
	RenderingServer.call_on_render_thread(_init_rd)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and _rd != null:
		for rid: RID in _pipelines.values():
			if rid.is_valid():
				_rd.free_rid(rid)
		for rid: RID in _shaders.values():
			if rid.is_valid():
				_rd.free_rid(rid)
		for rid in [_linear, _nearest, _frame_ubo]:
			if rid.is_valid():
				_rd.free_rid(rid)


func _init_rd() -> void:
	_rd = RenderingServer.get_rendering_device()
	if _rd == null:
		push_warning("OgPaintPost: no RenderingDevice (compatibility renderer?); post stack disabled")
		return
	for n in ["prep", "tensor", "blur", "kuwahara", "composite"]:
		var file := load("res://src/render/post/paint_%s.glsl" % n) as RDShaderFile
		if file == null:
			push_error("OgPaintPost: cannot load paint_%s.glsl" % n)
			return
		var spirv := file.get_spirv()
		if spirv.compile_error_compute != "":
			push_error("OgPaintPost: paint_%s.glsl: %s" % [n, spirv.compile_error_compute])
			return
		var shader := _rd.shader_create_from_spirv(spirv, "og_paint_" + n)
		_shaders[n] = shader
		_pipelines[n] = _rd.compute_pipeline_create(shader)
	var s := RDSamplerState.new()
	s.min_filter = RenderingDevice.SAMPLER_FILTER_LINEAR
	s.mag_filter = RenderingDevice.SAMPLER_FILTER_LINEAR
	s.repeat_u = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	s.repeat_v = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	_linear = _rd.sampler_create(s)
	var n := RDSamplerState.new()
	n.repeat_u = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	n.repeat_v = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	_nearest = _rd.sampler_create(n)
	_frame_ubo = _rd.uniform_buffer_create(FRAME_BYTES)
	_ok = true


const FRAME_BYTES := 16 * 4 * 2 + 16 * 5


func _render_callback(_type: int, render_data: RenderData) -> void:
	if not _ok:
		return
	var buffers := render_data.get_render_scene_buffers() as RenderSceneBuffersRD
	var scene := render_data.get_render_scene_data() as RenderSceneDataRD
	if buffers == null or scene == null:
		return
	var full := buffers.get_internal_size()
	if full.x <= 0 or full.y <= 0:
		return
	var cap := PAINT_HEIGHT_HIGH if quality == 2 else PAINT_HEIGHT_LOW
	var paint := full
	if full.y > cap:
		paint = Vector2i(maxi(1, roundi(full.x * float(cap) / full.y)), cap)
	_ensure_textures(buffers, paint)
	var tex_src := buffers.get_texture(CONTEXT, &"src")
	var tex_tensor := buffers.get_texture(CONTEXT, &"tensor")
	var tex_tmp := buffers.get_texture(CONTEXT, &"tmp")
	var tex_paint := buffers.get_texture(CONTEXT, &"paint")

	var proj := scene.get_cam_projection()
	var inv_proj := proj.inverse()
	var cam := scene.get_cam_transform()
	var data := PackedFloat32Array()
	_push_projection(data, inv_proj)
	_push_transform(data, cam)
	var focus_r := FOCUS_RADIUS if focus_uv.x > -1.0 else 0.0
	data.append_array([fog_begin, fog_end, time, MIST,
		eye_dir.x, eye_dir.y, eye_dir.z, 0.0,
		focus_uv.x, focus_uv.y, focus_r, FOCUS_STRENGTH,
		full.x, full.y, paint.x, paint.y,
		wind.x, wind.y, wind.z, 0.0])
	var bytes := data.to_byte_array()
	_rd.buffer_update(_frame_ubo, 0, bytes.size(), bytes)

	var height_scale := full.y / 720.0
	for view in buffers.get_view_count():
		var color := buffers.get_color_layer(view)
		var depth := buffers.get_depth_layer(view)
		# 1 prep
		_dispatch("prep", paint, [
			_image(0, color), _sampled(1, depth, _nearest), _image(2, tex_src), _ubo(3)], PackedFloat32Array())
		# 2 tensor, 3 blur
		_dispatch("tensor", paint, [_sampled(0, tex_src, _nearest), _image(1, tex_tensor)], PackedFloat32Array())
		if quality == 2:
			_dispatch("blur", paint, [_sampled(0, tex_tensor, _nearest), _image(1, tex_tmp)], PackedFloat32Array([1, 0, TENSOR_SIGMA, 0]))
			_dispatch("blur", paint, [_sampled(0, tex_tmp, _nearest), _image(1, tex_tensor)], PackedFloat32Array([0, 1, TENSOR_SIGMA, 0]))
		# 4 kuwahara
		var radius := RADIUS_HIGH if quality == 2 else RADIUS_LOW
		var alpha := 1.0 if quality == 2 else 0.0
		_dispatch("kuwahara", paint, [_sampled(0, tex_src, _nearest), _sampled(1, tex_tensor, _nearest), _image(2, tex_paint)],
			PackedFloat32Array([radius, alpha, 8.0, 8.0]))
		# 5 composite
		var stroke := STROKE if quality == 2 else STROKE * 0.6
		_dispatch("composite", full, [_image(0, color), _sampled(1, depth, _nearest), _sampled(2, tex_paint, _linear),
			_sampled(3, tex_tensor, _linear), _ubo(4)], PackedFloat32Array([stroke, STROKE_LEN_PX * height_scale, GRADE, GRAIN, SHARPEN, 0, 0, 0]))


func _ensure_textures(buffers: RenderSceneBuffersRD, paint: Vector2i) -> void:
	if buffers.has_texture(CONTEXT, &"src"):
		var f := buffers.get_texture_format(CONTEXT, &"src")
		if f.width == paint.x and f.height == paint.y:
			return
		buffers.clear_context(CONTEXT)
	var usage := RenderingDevice.TEXTURE_USAGE_SAMPLING_BIT | RenderingDevice.TEXTURE_USAGE_STORAGE_BIT
	for n: StringName in [&"src", &"tensor", &"tmp", &"paint"]:
		buffers.create_texture(CONTEXT, n, RenderingDevice.DATA_FORMAT_R16G16B16A16_SFLOAT, usage,
			RenderingDevice.TEXTURE_SAMPLES_1, paint, 1, 1, true, false)


func _dispatch(pass_name: String, size: Vector2i, uniforms: Array[RDUniform], push: PackedFloat32Array) -> void:
	var shader: RID = _shaders[pass_name]
	var set := UniformSetCacheRD.get_cache(shader, 0, uniforms)
	var list := _rd.compute_list_begin()
	_rd.compute_list_bind_compute_pipeline(list, _pipelines[pass_name])
	_rd.compute_list_bind_uniform_set(list, set, 0)
	if not push.is_empty():
		var b := push.to_byte_array()
		_rd.compute_list_set_push_constant(list, b, b.size())
	_rd.compute_list_dispatch(list, ceili(size.x / 8.0), ceili(size.y / 8.0), 1)
	_rd.compute_list_end()


func _image(binding: int, rid: RID) -> RDUniform:
	var u := RDUniform.new()
	u.uniform_type = RenderingDevice.UNIFORM_TYPE_IMAGE
	u.binding = binding
	u.add_id(rid)
	return u


func _sampled(binding: int, rid: RID, sampler: RID) -> RDUniform:
	var u := RDUniform.new()
	u.uniform_type = RenderingDevice.UNIFORM_TYPE_SAMPLER_WITH_TEXTURE
	u.binding = binding
	u.add_id(sampler)
	u.add_id(rid)
	return u


func _ubo(binding: int) -> RDUniform:
	var u := RDUniform.new()
	u.uniform_type = RenderingDevice.UNIFORM_TYPE_UNIFORM_BUFFER
	u.binding = binding
	u.add_id(_frame_ubo)
	return u


static func _push_projection(out: PackedFloat32Array, p: Projection) -> void:
	for c in [p.x, p.y, p.z, p.w]:
		out.append_array([c.x, c.y, c.z, c.w])


static func _push_transform(out: PackedFloat32Array, t: Transform3D) -> void:
	out.append_array([t.basis.x.x, t.basis.x.y, t.basis.x.z, 0.0])
	out.append_array([t.basis.y.x, t.basis.y.y, t.basis.y.z, 0.0])
	out.append_array([t.basis.z.x, t.basis.z.y, t.basis.z.z, 0.0])
	out.append_array([t.origin.x, t.origin.y, t.origin.z, 1.0])
