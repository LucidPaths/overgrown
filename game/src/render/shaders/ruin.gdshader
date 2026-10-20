shader_type spatial;
// Landmark ruins (ART-027, docs/art/BIBLE.md "Landmark"): pale warm stone, weathered and mossy, with bands
// of rune glyphs that glow teal and gold (mood board 12). Painted light like everything else.
render_mode cull_back;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_light.gdshaderinc"

uniform vec3 stone : source_color = vec3(0.60, 0.50, 0.38);
uniform vec3 stone_dark : source_color = vec3(0.24, 0.22, 0.24);
uniform vec3 moss : source_color = vec3(0.22, 0.32, 0.14);
uniform vec3 glyph_a : source_color = vec3(0.35, 0.95, 0.85);
uniform vec3 glyph_b : source_color = vec3(1.0, 0.75, 0.32);

varying vec3 v_world;
varying vec3 v_local;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_local = VERTEX;
}

void fragment() {
	// Dithers away between the camera and the wanderer, as the bible asks of anything that can block the view.
	if (og_occluder(VERTEX, VIEW_MATRIX, 2.4) > og_bayer4(FRAGCOORD.xy) * 0.999) {
		discard;
	}
	vec3 w = v_world;
	float n = og_fbm(w.xz * 0.8 + w.y * 0.7, 3);
	vec3 col = mix(stone_dark, stone, smoothstep(0.25, 0.75, n));
	col = mix(col, moss, smoothstep(0.55, 0.9, og_fbm(w.xz * 0.4 + vec2(w.y * 0.3, 3.0), 2)) * 0.8);
	// Glyph bands: cells around the object, each with a few strokes.
	float a = atan(v_local.z, v_local.x) / 6.2831853 + 0.5;
	vec2 g = vec2(a * 12.0, v_local.y * 1.6);
	vec2 cell = floor(g);
	vec2 f = fract(g);
	float band = step(0.5, og_hash12(vec2(cell.y, 3.0)));
	float h1 = og_hash12(cell);
	float h2 = og_hash12(cell + 17.0);
	float stroke = 0.0;
	stroke = max(stroke, (1.0 - smoothstep(0.04, 0.09, abs(f.x - (0.3 + h1 * 0.4)))) * step(0.15, f.y) * step(f.y, 0.85));
	stroke = max(stroke, (1.0 - smoothstep(0.04, 0.09, abs(f.y - (0.25 + h2 * 0.5)))) * step(0.2, f.x) * step(f.x, 0.8) * step(0.4, h2));
	stroke *= band * step(0.25, h1);
	float pulse = 0.75 + 0.25 * sin(TIME * 1.3 + cell.y * 0.7 + cell.x);
	ALBEDO = col;
	EMISSION = mix(glyph_a, glyph_b, step(0.6, h1)) * stroke * 2.2 * pulse;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	DIFFUSE_LIGHT += og_paint_light(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_world, 0.3, 1.0, TIME);
}
