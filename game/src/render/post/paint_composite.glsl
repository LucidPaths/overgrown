#[compute]
#version 450
// Pass 5 of the painterly stack (OgPaintPost), full resolution: upsample the painted image, lay brush
// strokes over it (line-integral convolution of world-anchored noise along the stroke field, so strokes stick
// to the world instead of swimming), keep the focal point (the wanderer) a little crisper, grade toward the
// mood-board palette (blue-black darks, teal shadows, gold and burnt-orange lights), add canvas grain and a
// vignette. Writes the final display-referred colour back into the scene colour buffer (tonemap: linear).

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(rgba16f, set = 0, binding = 0) uniform restrict image2D color_image;
layout(set = 0, binding = 1) uniform sampler2D depth_tex;
layout(set = 0, binding = 2) uniform sampler2D paint_tex;
layout(set = 0, binding = 3) uniform sampler2D tensor_tex;
layout(set = 0, binding = 4, std140) uniform Frame {
	mat4 inv_proj;
	mat4 cam_to_world;
	vec4 fog; // begin m, end m, time s, mist strength
	vec4 eye_dir;
	vec4 focus; // u, v, radius (fraction of height), strength
	vec4 sizes; // full w, h, paint w, h
} frame;
layout(push_constant, std430) uniform Params {
	float stroke; // brush-stroke texture strength
	float stroke_len; // LIC half-length in full-res px
	float grade; // grading strength 0..1
	float grain;
} params;

vec3 lin(vec3 c) {
	return c * c * (c * 0.305306 + 0.682171) + 0.012523 * c;
}

vec3 to_gamma(vec3 c) {
	return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

vec3 to_linear(vec3 c) {
	return pow(max(c, vec3(0.0)), vec3(2.2));
}

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
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

float vnoise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

vec3 horizon_color(vec3 d) {
	vec2 h = normalize(d.xz + vec2(1e-5, 0.0));
	vec2 e = normalize(frame.eye_dir.xz + vec2(1e-5, 0.0));
	float toward = dot(h, e) * 0.5 + 0.5;
	return mix(lin(vec3(0.16, 0.36, 0.38)), lin(vec3(0.96, 0.66, 0.30)), pow(toward, 2.6));
}

vec3 tonemap(vec3 c) {
	return vec3(1.0) - exp(-c * 1.35);
}

// World point under a full-res pixel (sky: far along the view ray). w = 1 for geometry, 0 for sky.
vec4 world_at(vec2 px) {
	ivec2 ip = clamp(ivec2(px), ivec2(0), ivec2(frame.sizes.xy) - 1);
	float depth = texelFetch(depth_tex, ip, 0).r;
	vec2 uv = (vec2(ip) + 0.5) / frame.sizes.xy;
	vec4 view = frame.inv_proj * vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, max(depth, 1e-7), 1.0);
	view.xyz /= view.w;
	if (depth <= 0.0) {
		vec3 d = normalize(mat3(frame.cam_to_world) * view.xyz);
		return vec4(d * 60.0, 0.0);
	}
	return vec4((frame.cam_to_world * vec4(view.xyz, 1.0)).xyz, 1.0);
}

// The brush-hair noise: fine streaks in world space (sky: in direction space).
float hair(vec4 w) {
	vec3 p = w.xyz * (w.w > 0.0 ? 7.0 : 1.0);
	return vnoise3(p) * 0.65 + vnoise3(p * 2.7 + 5.0) * 0.35;
}

// The sharp scene colour at a pixel, fogged and tonemapped like the paint (for the focal point).
vec3 sharp_at(ivec2 px, vec4 w, float dist) {
	vec3 c = imageLoad(color_image, px).rgb;
	if (w.w > 0.0) {
		vec3 cam = frame.cam_to_world[3].xyz;
		float f = clamp((dist - frame.fog.x) / max(frame.fog.y - frame.fog.x, 1.0), 0.0, 1.0);
		f = f * f * (3.0 - 2.0 * f);
		c = mix(c, horizon_color(normalize(w.xyz - cam)), f);
	}
	return tonemap(c);
}

// Palette grade (sRGB-ish gamma space in and out). A gradient map keyed by luminance, blended with the
// local colour, plus split toning and a gentle S-curve: one palette over the whole frame, like the paintings.
vec3 grade(vec3 g, float amount) {
	float l = dot(g, vec3(0.299, 0.587, 0.114));
	// The ramp: blue-black, deep teal, teal, olive gold, burnt gold, gold, cream.
	vec3 c0 = vec3(0.02, 0.035, 0.055);
	vec3 c1 = vec3(0.05, 0.16, 0.20);
	vec3 c2 = vec3(0.12, 0.34, 0.35);
	vec3 c3 = vec3(0.45, 0.47, 0.25);
	vec3 c4 = vec3(0.80, 0.55, 0.22);
	vec3 c5 = vec3(0.95, 0.76, 0.36);
	vec3 c6 = vec3(1.0, 0.94, 0.78);
	vec3 ramp = c0;
	ramp = mix(ramp, c1, smoothstep(0.0, 0.16, l));
	ramp = mix(ramp, c2, smoothstep(0.14, 0.34, l));
	ramp = mix(ramp, c3, smoothstep(0.32, 0.52, l));
	ramp = mix(ramp, c4, smoothstep(0.5, 0.68, l));
	ramp = mix(ramp, c5, smoothstep(0.66, 0.82, l));
	ramp = mix(ramp, c6, smoothstep(0.84, 1.0, l));
	// Keep local hue: tint the ramp by the colour's own chroma.
	vec3 chroma = g - vec3(l);
	vec3 mapped = ramp + chroma * 0.9;
	vec3 o = mix(g, mapped, amount);
	// Saturation lift in the mid tones.
	float lo = dot(o, vec3(0.299, 0.587, 0.114));
	o = mix(vec3(lo), o, 1.0 + 0.25 * amount * smoothstep(0.05, 0.4, lo) * (1.0 - smoothstep(0.7, 1.0, lo)));
	// S-curve: deeper darks, glowing lights.
	o = mix(o, o * o * (3.0 - 2.0 * o), 0.35 * amount);
	return clamp(o, 0.0, 1.0);
}

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 full = ivec2(frame.sizes.xy);
	if (p.x >= full.x || p.y >= full.y) {
		return;
	}
	vec2 uv = (vec2(p) + 0.5) / frame.sizes.xy;
	vec4 paint = texture(paint_tex, uv);
	vec3 col = paint.rgb;
	float aniso = paint.a;

	vec4 w0 = world_at(vec2(p) + 0.5);
	vec3 cam = frame.cam_to_world[3].xyz;
	float dist = w0.w > 0.0 ? length(w0.xyz - cam) : 1e4;

	// Stroke direction: the tensor's minor eigenvector (along edges), in full-res pixels.
	vec4 g = texture(tensor_tex, uv);
	float lambda1 = 0.5 * (g.z + g.x + sqrt(max(0.0, (g.z - g.x) * (g.z - g.x) + 4.0 * g.y * g.y)));
	vec2 v = vec2(lambda1 - g.x, -g.y);
	vec2 sdir = length(v) > 1e-6 ? normalize(v) : vec2(0.70710678, 0.70710678);
	// Brush hairs: average the hair noise along the stroke (LIC). Far geometry gets shorter strokes.
	if (params.stroke > 0.0) {
		float len = params.stroke_len;
		float acc = 0.0;
		float wsum = 0.0;
		const int TAPS = 5;
		for (int i = -TAPS; i <= TAPS; i++) {
			vec2 q = vec2(p) + 0.5 + sdir * (float(i) / float(TAPS)) * len;
			float wt = 1.0 - abs(float(i)) / float(TAPS + 1);
			acc += hair(world_at(q)) * wt;
			wsum += wt;
		}
		float lic = acc / wsum;
		// Impasto: strokes show most in the lights (thick paint) and along strong edges.
		float lum = dot(col, vec3(0.299, 0.587, 0.114));
		float k = params.stroke * (0.55 + 0.45 * smoothstep(0.1, 0.6, lum)) * (0.7 + 0.6 * aniso);
		col *= 1.0 + (lic - 0.5) * 1.6 * k;
	}

	// Focal clarity: the wanderer's neighbourhood keeps more of the sharp render (readability, and the
	// painter's habit of finishing the focal point).
	vec2 fd = (uv - frame.focus.xy) * vec2(frame.sizes.x / frame.sizes.y, 1.0);
	float focal = (1.0 - smoothstep(frame.focus.z * 0.5, frame.focus.z, length(fd))) * frame.focus.w;
	if (focal > 0.0) {
		col = mix(col, sharp_at(p, w0, dist), focal);
	}

	vec3 g2 = to_gamma(col);
	g2 = grade(g2, params.grade);

	// Canvas: a fine weave plus paper tooth, fixed to the screen like a real canvas.
	vec2 fp = vec2(p);
	float weave = (sin(fp.x * 1.5708) * sin(fp.y * 1.5708)) * 0.5 + 0.5;
	float tooth = vnoise2(fp * 0.35) * 0.6 + hash12(fp) * 0.4;
	float canvas = (weave * 0.35 + tooth * 0.65 - 0.5);
	g2 += canvas * params.grain * (0.6 + 0.4 * (1.0 - dot(g2, vec3(0.333))));

	// Vignette: dark, slightly blue corners.
	vec2 c = uv - 0.5;
	float vig = smoothstep(0.35, 0.95, length(c * vec2(1.25, 1.0)));
	g2 = mix(g2, g2 * vec3(0.35, 0.42, 0.55), vig * 0.55 * params.grade);

	imageStore(color_image, p, vec4(to_linear(clamp(g2, 0.0, 1.0)), 1.0));
}
