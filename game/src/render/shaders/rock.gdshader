shader_type spatial;
// Rocks (ART-027, docs/art/BIBLE.md "Props"): faceted planes, the ground colour at the foot, cool violet
// stone above, moss on the tops in green biomes, painted light.
render_mode cull_back, world_vertex_coords;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_light.gdshaderinc"

uniform vec3 stone_dark : source_color = vec3(0.20, 0.19, 0.25);
uniform vec3 stone_light : source_color = vec3(0.55, 0.50, 0.50);

varying vec3 v_world;
varying vec3 v_ground;
varying float v_shade;
varying float v_rand;

void vertex() {
	v_world = VERTEX;
	v_ground = og_lin(INSTANCE_CUSTOM.rgb);
	v_shade = COLOR.g;
	v_rand = INSTANCE_CUSTOM.a;
}

void fragment() {
	// Dithers away between the camera and the wanderer, as the bible asks of anything that can block the view.
	if (og_occluder(VERTEX, VIEW_MATRIX, 2.4) > og_bayer4(FRAGCOORD.xy) * 0.999) {
		discard;
	}
	vec3 col = mix(stone_dark, stone_light, v_shade * 0.6 + 0.2 * v_rand);
	float moss = smoothstep(0.55, 0.9, NORMAL.y) * smoothstep(0.3, 0.6, v_ground.g / max(v_ground.r + v_ground.b, 0.01));
	col = mix(col, v_ground * 0.9, moss * 0.8);
	ALBEDO = col;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	DIFFUSE_LIGHT += og_paint_light(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_world, 0.15, 1.0, TIME);
}
