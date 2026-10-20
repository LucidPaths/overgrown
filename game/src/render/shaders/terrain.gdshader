shader_type spatial;
// The painted ground (ART-027, docs/art/BIBLE.md "Terrain"). Vertex colour rgb is the tile colour from
// OgTerrainMesher (sRGB), alpha the surface kind (OgTerrainMesher.KIND_*): 1 grass, 0.75 dirt, 0.5 sand,
// 0.25 stone, 0 rock wall. The shader adds what a painter would: big warm/cool colour patches, brush dabs
// that follow a slow flow field, strata on rock walls, and the shared painted light.
render_mode cull_back;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_light.gdshaderinc"

// The landmark island uses this shader too; it dithers away where it would hide the wanderer.
uniform bool fade_occluders = false;

varying vec3 v_world;
varying vec3 v_wnormal;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_wnormal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

// Elongated brush dabs: value noise squashed along a fixed angle per layer, the domain bent by a slow warp
// so the strokes wave like a painter's hand (no rotation field: that swirls into rings far from the origin).
float dabs(vec2 p, float angle, float scale, float stretch) {
	vec2 warp = vec2(og_vnoise(p * 0.08), og_vnoise(p * 0.08 + 31.0)) * 2.5;
	p += warp;
	vec2 dir = vec2(cos(angle), sin(angle));
	vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
	return og_vnoise(q * vec2(scale / stretch, scale));
}

void fragment() {
	if (fade_occluders && og_occluder(v_world, CAMERA_POSITION_WORLD) > og_bayer4(FRAGCOORD.xy) * 0.999) {
		discard;
	}
	vec3 base = og_lin(COLOR.rgb);
	float kind = COLOR.a;
	vec2 p = v_world.xz;
	float grass = smoothstep(0.85, 1.0, kind);
	float dirt = smoothstep(0.6, 0.75, kind) * (1.0 - grass);
	float wall = 1.0 - smoothstep(0.05, 0.2, kind);

	// Large patches: warm gold vs cool teal drift (10-40 m), like light and shade a painter lays in first.
	float patch = og_fbm(p * 0.03, 3);
	vec3 warm = base * vec3(1.18, 1.05, 0.72);
	vec3 cool = base * vec3(0.70, 0.95, 1.05);
	vec3 col = mix(cool, warm, smoothstep(0.3, 0.7, patch));

	// Brush dabs at two scales.
	float d1 = dabs(p, 0.6, 1.6, 3.5);
	float d2 = dabs(p + 11.0, -0.5, 3.4, 2.5);
	float strokes = d1 * 0.6 + d2 * 0.4;
	col *= 0.78 + 0.44 * strokes;

	// Grass: gold-lit tips and teal roots, scattered warm flower specks.
	if (grass > 0.0) {
		vec3 tips = og_lin(vec3(0.78, 0.70, 0.30));
		vec3 roots = og_lin(vec3(0.10, 0.26, 0.22));
		vec3 g = mix(roots, col, smoothstep(0.15, 0.55, strokes));
		g = mix(g, tips, smoothstep(0.72, 0.95, d2) * 0.6);
		float speck = step(0.93, og_hash12(floor(p * 3.0))) * smoothstep(0.55, 0.75, og_fbm(p * 0.08 + 40.0, 2));
		g = mix(g, og_lin(vec3(0.95, 0.55, 0.22)), speck * 0.75);
		col = mix(col, g, grass);
	}
	// Dirt paths: darker crevices.
	col *= 1.0 - dirt * 0.25 * smoothstep(0.55, 0.2, d2);

	// Rock walls: horizontal strata (the canyon walls of mood-board 13), warm ochre and violet bands.
	if (wall > 0.0) {
		float y = v_world.y + og_vnoise(p * 0.25) * 1.2;
		float strata = og_vnoise(vec2(y * 2.2, (p.x + p.y) * 0.15));
		float fine = og_vnoise(vec2(y * 9.0, (p.x - p.y) * 0.8));
		vec3 band_a = og_lin(vec3(0.42, 0.30, 0.24));
		vec3 band_b = og_lin(vec3(0.22, 0.20, 0.27));
		vec3 r = mix(band_b, band_a, smoothstep(0.3, 0.7, strata));
		r *= 0.75 + 0.5 * fine;
		col = mix(col, r, wall);
	}
	ALBEDO = col;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	DIFFUSE_LIGHT += og_paint_light(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_world, 0.35, 1.0, TIME);
}
