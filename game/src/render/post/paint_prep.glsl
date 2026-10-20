#[compute]
#version 450
// Pass 1 of the painterly stack (OgPaintPost): scene colour (HDR, full resolution) + depth -> the sky
// repainted (og_sky_base, the same function the sky shader uses), depth fog toward that sky, valley mist,
// tonemap, downsample to the paint resolution. Because the fog colour is the sky itself along the view
// direction (mirrored below the horizon), distant ground dissolves into the sky and the streaming edge
// never shows a silhouette. Output alpha = view distance / 256 m (sky: 1).

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(rgba16f, set = 0, binding = 0) uniform restrict readonly image2D color_image;
layout(set = 0, binding = 1) uniform sampler2D depth_tex;
layout(rgba16f, set = 0, binding = 2) uniform restrict writeonly image2D out_image;
layout(set = 0, binding = 3, std140) uniform Frame {
	mat4 inv_proj;
	mat4 cam_to_world;
	vec4 fog; // begin m, end m, time s, mist strength
	vec4 eye_dir; // xyz toward the cosmic eye
	vec4 focus; // focus u, v, radius (fraction of height), strength
	vec4 sizes; // full w, h, paint w, h
	vec4 wind; // xy unit wind direction (world xz), z strength
	vec4 beam_a; // landmark light pillar: origin (world), radius m (0 = none)
	vec4 beam_b; // unit direction, length m
} frame;

#include "res://src/render/shaders/og_noise.gdshaderinc"
#include "res://src/render/shaders/og_sky.gdshaderinc"

float vnoise3(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(og_hash13(i), og_hash13(i + vec3(1, 0, 0)), f.x), mix(og_hash13(i + vec3(0, 1, 0)), og_hash13(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(og_hash13(i + vec3(0, 0, 1)), og_hash13(i + vec3(1, 0, 1)), f.x), mix(og_hash13(i + vec3(0, 1, 1)), og_hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Exponential filmic curve per channel: deep darks, a long gold shoulder.
vec3 tonemap(vec3 c) {
	return vec3(1.0) - exp(-c * 1.6);
}

// View-space point under full-res pixel px.
vec3 view_at(ivec2 px, float depth) {
	vec2 uv = (vec2(px) + 0.5) / frame.sizes.xy;
	vec4 view = frame.inv_proj * vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, max(depth, 1e-7), 1.0);
	return view.xyz / view.w;
}

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 size = ivec2(frame.sizes.zw);
	if (p.x >= size.x || p.y >= size.y) {
		return;
	}
	ivec2 full = ivec2(frame.sizes.xy);
	vec2 scale = frame.sizes.xy / frame.sizes.zw;
	vec2 base = (vec2(p) + 0.5) * scale;
	mat3 cam_basis = mat3(frame.cam_to_world);
	vec3 cam = frame.cam_to_world[3].xyz;
	float t = frame.fog.z;

	// Up to 4 full-res taps over the paint pixel's footprint.
	int taps = scale.x <= 1.01 ? 1 : 4;
	vec2 offs[4] = vec2[](vec2(-0.25, -0.25), vec2(0.25, -0.25), vec2(-0.25, 0.25), vec2(0.25, 0.25));
	vec3 cols[4];
	float fogs[4];
	float dists[4];
	bool need_sky = false;
	for (int k = 0; k < taps; k++) {
		ivec2 px = clamp(ivec2(taps == 1 ? base : base + offs[k] * scale), ivec2(0), full - 1);
		cols[k] = imageLoad(color_image, px).rgb;
		float depth = texelFetch(depth_tex, px, 0).r;
		if (depth <= 0.0) {
			fogs[k] = 1.0;
			dists[k] = 256.0;
			need_sky = true;
			continue;
		}
		vec3 view = view_at(px, depth);
		float dist = length(view);
		vec3 world = cam + cam_basis * view;
		// Depth fog: clear to fog.x, opaque at fog.y (the camera rig moves these with the pose), mottled by
		// world-anchored noise so it reads as painted haze rather than a gradient.
		float n = vnoise3(world * 0.07 + vec3(t * 0.05, 0.0, 0.0));
		float f = clamp((dist - frame.fog.x) / max(frame.fog.y - frame.fog.x, 1.0), 0.0, 1.0);
		// Gentle at first, opaque by fog.y (the streaming edge must vanish).
		f = f * f * (3.0 - 2.0 * f);
		f = clamp(f * f * (1.6 - 0.6 * f) + (n - 0.5) * f * (1.0 - f), 0.0, 1.0);
		// Valley mist: low ground gets a pale veil that thickens with distance.
		float mist = (1.0 - smoothstep(-1.0, 4.0, world.y)) * smoothstep(8.0, 40.0, dist) * frame.fog.w * (0.6 + 0.4 * n);
		fogs[k] = max(f, mist * 0.5);
		dists[k] = dist;
		need_sky = need_sky || fogs[k] > 0.0;
	}
	vec3 sky = vec3(0.0);
	if (need_sky) {
		vec3 dir = normalize(cam_basis * view_at(ivec2(base), 1e-4));
		sky = og_sky_base(dir, t, 1, frame.eye_dir.xyz, frame.wind.xy);
	}
	// The landmark's pillar of light, drawn here as a volume (so it glows through the haze instead of being
	// fogged with the ground behind it): the closest approach of the view ray to the beam's axis.
	vec3 beam = vec3(0.0);
	if (frame.beam_a.w > 0.0) {
		vec3 dir = normalize(cam_basis * view_at(ivec2(base), 1e-4));
		vec3 o = frame.beam_a.xyz;
		vec3 bd = frame.beam_b.xyz;
		vec3 w0 = cam - o;
		float b = dot(dir, bd);
		float denom = 1.0 - b * b;
		if (denom > 1e-5) {
			float sc = (b * dot(bd, w0) - dot(dir, w0)) / denom; // along the view ray
			float tc = (dot(bd, w0) - b * dot(dir, w0)) / denom; // along the beam
			tc = clamp(tc, 0.0, frame.beam_b.w);
			sc = max(sc, 0.0);
			vec3 pc = o + bd * tc;
			float d = length(cam + dir * sc - pc);
			float scene_d = taps == 1 ? dists[0] : min(min(dists[0], dists[1]), min(dists[2], dists[3]));
			float vis = smoothstep(-2.0, 2.0, scene_d - sc);
			float r = frame.beam_a.w;
			float flow = og_fbm(vec2(tc * 0.06 - t * 0.8, atan(d, r) * 2.0), 3);
			float core = exp(-(d * d) / (r * r)) * (0.6 + 0.8 * flow);
			float halo = exp(-d / (r * 5.0)) * 0.35;
			float along = smoothstep(0.0, 4.0, tc) * (1.0 - smoothstep(frame.beam_b.w * 0.3, frame.beam_b.w, tc));
			beam = og_lin(vec3(1.0, 0.76, 0.38)) * (core * 2.4 + halo) * along * vis;
		}
	}
	vec4 acc = vec4(0.0);
	for (int k = 0; k < taps; k++) {
		// Sky pixels: the sky shader drew black there, so the colour is only what transparent passes added.
		vec3 c = dists[k] >= 256.0 ? sky + cols[k] : mix(cols[k], sky, fogs[k]);
		acc += vec4(tonemap(c + beam), clamp(dists[k] / 256.0, 0.0, 1.0));
	}
	imageStore(out_image, p, acc / float(taps));
}
