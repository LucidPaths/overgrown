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
// The nearest landmark's geoglyph: (centre x, centre z, radius m, 0); radius 0 = none. Set by OgWorldLook.
global uniform vec4 og_landmark;

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

// How much a surface hides the wanderer from the camera, measured on screen: 1 when the fragment (view-space
// position `frag`) lies within `radius` metres of the wanderer's chest as seen from the camera and in front of
// it, fading to 0 at 1.6x; also 1 within a few metres of the camera. Works for every camera pose (play,
// vista, orbit) because it compares the two points in view space. Foliage and the landmark island dither
// themselves away by it.
float og_occluder(vec3 frag, mat4 view, float radius) {
	vec3 f = (view * vec4(og_focus + vec3(0.0, 0.9, 0.0), 1.0)).xyz;
	float near_cam = 1.0 - smoothstep(3.0, 5.5, length(frag));
	if (f.z > -0.1 || frag.z > -0.05) {
		return near_cam;
	}
	float closer = smoothstep(0.4, 1.4, frag.z - f.z);
	float d = length(frag.xy / -frag.z - f.xy / -f.z) * -f.z;
	return max((1.0 - smoothstep(radius, radius * 1.6, d)) * closer, near_cam);
}
