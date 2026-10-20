// overgrown G1 look: shared noise, palette and wind helpers (ART-027, docs/art/BIBLE.md).
// Visual only: nothing here feeds the rules. Every world shader includes this file.

// Wind: xy = unit direction in world (x, z), z = strength (0..2), w unused. Set by OgWorldLook.
global uniform vec4 og_wind;
// Unit direction toward the cosmic eye (the sky's centrepiece). Set by OgWorldLook.
global uniform vec3 og_eye_dir;
// Unit direction toward the key light (the low gold sun). Set by OgWorldLook.
global uniform vec3 og_sun_dir;
// The wanderer's feet point in world metres (foliage between it and the camera thins out).
global uniform vec3 og_focus;

// sRGB authoring -> linear. The palette in the bible is written in sRGB hex.
vec3 og_lin(vec3 c) {
	return c * c * (c * 0.305306 + 0.682171) + 0.012523 * c;
}

float og_hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

vec2 og_hash22(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx + p3.yz) * p3.zy);
}

float og_hash13(vec3 p3) {
	p3 = fract(p3 * 0.1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}

// Value noise in 0..1, smooth (quintic) interpolation.
float og_vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a = og_hash12(i);
	float b = og_hash12(i + vec2(1.0, 0.0));
	float c = og_hash12(i + vec2(0.0, 1.0));
	float d = og_hash12(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Value noise whose x lattice wraps every `period` cells (for polar coordinates without a seam).
float og_pnoise(vec2 p, float period) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float x0 = mod(i.x, period);
	float x1 = mod(i.x + 1.0, period);
	float a = og_hash12(vec2(x0, i.y));
	float b = og_hash12(vec2(x1, i.y));
	float c = og_hash12(vec2(x0, i.y + 1.0));
	float d = og_hash12(vec2(x1, i.y + 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float og_fbm(vec2 p, int octaves) {
	float s = 0.0;
	float a = 0.5;
	mat2 rot = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8));
	for (int i = 0; i < octaves; i++) {
		s += a * og_vnoise(p);
		p = rot * p * 2.03 + vec2(17.1, 3.7);
		a *= 0.5;
	}
	return s;
}

float og_pfbm(vec2 p, float period, int octaves) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < octaves; i++) {
		s += a * og_pnoise(p, period);
		p = p * 2.0 + vec2(0.0, 5.3);
		period *= 2.0;
		a *= 0.5;
	}
	return s;
}

// Wind as a 3D world vector (y = 0) and its strength.
vec3 og_wind_vec() {
	return vec3(og_wind.x, 0.0, og_wind.y) * og_wind.z;
}

// A gust field: slow travelling bands of stronger wind, 0.4..1.4, at world point xz.
float og_gust(vec2 xz, float t) {
	vec2 w = og_wind.xy;
	float along = dot(xz, w);
	float g = og_vnoise(vec2(along * 0.06 - t * 0.55, dot(xz, vec2(-w.y, w.x)) * 0.03));
	return 0.4 + g * 1.0;
}

// Drifting cloud shadows on the ground: 0 = shadowed, 1 = open sun. Big soft patches moving downwind.
float og_cloud_shadow(vec2 xz, float t) {
	vec2 p = xz * 0.011 - og_wind.xy * t * 0.03;
	float n = og_fbm(p, 3);
	return mix(0.38, 1.0, smoothstep(0.38, 0.6, n));
}
