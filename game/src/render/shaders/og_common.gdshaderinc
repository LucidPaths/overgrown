// overgrown G1 look: shared globals, wind and dither helpers (ART-027, docs/art/BIBLE.md).
// Visual only: nothing here feeds the rules. Every world shader includes this file.

#include "res://src/render/shaders/og_noise.gdshaderinc"


// Wind: xy = unit direction in world (x, z), z = strength (0..2), w unused. Set by OgWorldLook.
global uniform vec4 og_wind;
// Unit direction toward the cosmic eye (the sky's centrepiece). Set by OgWorldLook.
global uniform vec3 og_eye_dir;
// Unit direction toward the key light (the low gold sun). Set by OgWorldLook.
global uniform vec3 og_sun_dir;
// The wanderer's feet point in world metres (foliage between it and the camera thins out).
global uniform vec3 og_focus;

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
	return mix(0.32, 1.0, smoothstep(0.44, 0.62, n));
}

// 4x4 ordered dither threshold in 0..1 for a screen pixel.
float og_bayer4(vec2 frag) {
	ivec2 p = ivec2(mod(frag, 4.0));
	int i = p.x + p.y * 4;
	int m[16] = int[](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
	return (float(m[i]) + 0.5) / 16.0;
}

// How much a surface at world point w hides the wanderer from the camera: 1 when it sits on the line from the
// camera to the wanderer's chest, closer than the wanderer; 0 elsewhere. Foliage dithers itself away by it.
float og_occluder(vec3 w, vec3 cam) {
	vec3 f = og_focus + vec3(0.0, 0.9, 0.0);
	vec3 ab = f - cam;
	float t = dot(w - cam, ab) / max(dot(ab, ab), 1e-4);
	float d = length(w - (cam + ab * clamp(t, 0.0, 1.0)));
	float r0 = 2.0 + 0.12 * length(ab);
	float near_cam = 1.0 - smoothstep(3.0, 6.0, length(w - cam));
	return max((1.0 - smoothstep(r0, r0 * 2.0, d)) * (1.0 - smoothstep(0.88, 0.98, t)), near_cam);
}
