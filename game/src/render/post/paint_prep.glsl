#[compute]
#version 450
// Pass 1 of the painterly stack (OgPaintPost): scene colour (HDR, full resolution) + depth -> painted fog,
// tonemap, downsample to the paint resolution. Output alpha = view distance / 256 m (sky: 1).

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(rgba16f, set = 0, binding = 0) uniform restrict readonly image2D color_image;
layout(set = 0, binding = 1) uniform sampler2D depth_tex;
layout(rgba16f, set = 0, binding = 2) uniform restrict writeonly image2D out_image;
layout(set = 0, binding = 3, std140) uniform Frame {
	mat4 inv_proj;
	mat4 cam_to_world;
	vec4 fog; // begin m, end m, time s, mist strength
	vec4 eye_dir; // xyz toward the cosmic eye
	vec4 focus; // xyz wanderer feet (world), w focus radius px
	vec4 sizes; // full w, h, paint w, h
} frame;

// Same as og_lin in og_common.gdshaderinc.
vec3 lin(vec3 c) {
	return c * c * (c * 0.305306 + 0.682171) + 0.012523 * c;
}

float hash13(vec3 p3) {
	p3 = fract(p3 * 0.1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}

float vnoise3(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Must match og_horizon in og_sky.gdshaderinc.
vec3 horizon_color(vec3 d) {
	vec2 h = normalize(d.xz + vec2(1e-5, 0.0));
	vec2 e = normalize(frame.eye_dir.xz + vec2(1e-5, 0.0));
	float toward = dot(h, e) * 0.5 + 0.5;
	return mix(lin(vec3(0.16, 0.36, 0.38)), lin(vec3(0.96, 0.66, 0.30)), pow(toward, 2.6));
}

// Exponential filmic curve per channel: deep darks, a long gold shoulder.
vec3 tonemap(vec3 c) {
	return vec3(1.0) - exp(-c * 1.35);
}

vec4 shade(ivec2 px) {
	ivec2 full = ivec2(frame.sizes.xy);
	px = clamp(px, ivec2(0), full - 1);
	vec3 c = imageLoad(color_image, px).rgb;
	float depth = texelFetch(depth_tex, px, 0).r;
	vec2 uv = (vec2(px) + 0.5) / frame.sizes.xy;
	vec4 ndc = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, depth, 1.0);
	vec4 view = frame.inv_proj * ndc;
	view.xyz /= view.w;
	float dist = length(view.xyz);
	if (depth <= 0.0) {
		return vec4(tonemap(c), 1.0);
	}
	vec3 world = (frame.cam_to_world * vec4(view.xyz, 1.0)).xyz;
	vec3 cam = frame.cam_to_world[3].xyz;
	vec3 dir = normalize(world - cam);
	// Depth fog: clear to fog.x, opaque at fog.y (the camera rig moves these with the pose), mottled by
	// world-anchored noise so it reads as painted haze rather than a gradient.
	float n = vnoise3(world * 0.07 + vec3(frame.fog.z * 0.05, 0.0, 0.0));
	float f = clamp((dist - frame.fog.x) / max(frame.fog.y - frame.fog.x, 1.0), 0.0, 1.0);
	f = f * f * (3.0 - 2.0 * f);
	f = clamp(f + (n - 0.5) * 0.25 * f * (1.0 - f) * 4.0, 0.0, 1.0);
	// Valley mist: low ground (below 2 m) gets a pale veil that thickens with distance.
	float mist = (1.0 - smoothstep(-1.0, 4.0, world.y)) * smoothstep(8.0, 40.0, dist) * frame.fog.w * (0.6 + 0.4 * n);
	vec3 fogc = horizon_color(dir);
	c = mix(c, fogc, max(f, mist * 0.55));
	return vec4(tonemap(c), clamp(dist / 256.0, 0.0, 1.0));
}

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 size = ivec2(frame.sizes.zw);
	if (p.x >= size.x || p.y >= size.y) {
		return;
	}
	vec2 scale = frame.sizes.xy / frame.sizes.zw;
	vec2 base = (vec2(p) + 0.5) * scale;
	if (scale.x <= 1.01) {
		imageStore(out_image, p, shade(ivec2(base)));
		return;
	}
	// Box-ish 2x2 downsample around the paint pixel's footprint.
	vec4 s = shade(ivec2(base + vec2(-0.25, -0.25) * scale));
	s += shade(ivec2(base + vec2(0.25, -0.25) * scale));
	s += shade(ivec2(base + vec2(-0.25, 0.25) * scale));
	s += shade(ivec2(base + vec2(0.25, 0.25) * scale));
	imageStore(out_image, p, s * 0.25);
}
