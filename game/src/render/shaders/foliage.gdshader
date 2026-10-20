shader_type spatial;
// Trees and bushes (ART-027, docs/art/BIBLE.md "Props"). Canopies are lit with the shared painted light on
// softened "cloud" normals, with a gold rim where the sun is behind them; trunks are dark. The whole crown
// sways downwind with travelling gusts and flutters at the top. Anything between the camera and the
// wanderer dithers away so the wanderer always reads.
render_mode cull_back, world_vertex_coords;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_light.gdshaderinc"

uniform vec3 leaf_dark : source_color = vec3(0.06, 0.16, 0.14);
uniform vec3 leaf_light : source_color = vec3(0.30, 0.42, 0.20);
uniform vec3 trunk_color : source_color = vec3(0.16, 0.10, 0.07);
uniform vec3 flower_color : source_color = vec3(0.95, 0.55, 0.2);
uniform float flower_amount = 0.0;
// Metres the top moves per unit of wind, per metre of height.
uniform float sway = 0.035;
uniform float rim = 1.0;
// How much the canopy silhouette breaks into leaf clumps (0 = solid shell).
uniform float leafy = 1.0;

varying vec3 v_world;
varying float v_h;
varying float v_shade;
varying float v_flower;
varying float v_trunk;
varying float v_rand;

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	float height = length(MODEL_MATRIX[1].xyz);
	float h = COLOR.r;
	v_h = h;
	v_shade = COLOR.g;
	v_flower = COLOR.b;
	v_trunk = 1.0 - COLOR.a;
	v_rand = INSTANCE_CUSTOM.a;
	float gust = og_gust(origin.xz, TIME);
	float phase = dot(origin.xz, vec2(0.21, 0.17)) + v_rand * 6.2831;
	vec3 w = og_wind_vec();
	float lean = sway * height * h * h * gust * (0.8 + 0.2 * sin(TIME * 0.9 + phase));
	float flutter = sin(TIME * 3.3 + phase + VERTEX.y * 0.9) * 0.04 * h * (1.0 - v_trunk);
	VERTEX += w * lean + vec3(flutter, flutter * 0.4, -flutter * 0.6) * og_wind.z;
	v_world = VERTEX;
}

void fragment() {
	float hide = max(og_occluder(VERTEX, VIEW_MATRIX, 2.4), og_canopy_cut(VERTEX, v_world.y, VIEW_MATRIX, 5.0) * (1.0 - v_trunk));
	if (hide > og_bayer4(FRAGCOORD.xy) * 0.999) {
		discard;
	}
	// Leafy silhouettes: canopy edges (normals turning away from the view) break up in world-anchored clumps,
	// so crowns read as masses of leaves, not low-poly shells (the post smooths the holes into dabs).
	if (v_trunk < 0.5) {
		float side = 1.0 - abs(dot(NORMAL, VIEW));
		float leaf = og_vnoise(v_world.xz * 2.3 + v_world.y * 1.7) * 0.65 + og_vnoise(v_world.xy * 5.1 + v_world.z * 3.3) * 0.35;
		if (side > mix(1.01, 0.55 + leaf * 0.45, leafy)) {
			discard;
		}
	}
	vec3 leaf = mix(leaf_dark, leaf_light, smoothstep(0.0, 1.0, v_h * 0.7 + v_shade * 0.5));
	leaf *= 0.85 + 0.3 * v_rand;
	vec3 col = mix(leaf, trunk_color, v_trunk);
	col = mix(col, flower_color * (0.8 + 0.4 * v_shade), v_flower * flower_amount);
	ALBEDO = col;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	DIFFUSE_LIGHT += og_paint_light(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_world, 0.5, 1.0, TIME);
	// Rim: canopy edges facing away from the camera toward the sun catch gold light (backlit trees).
	float edge = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float back = pow(max(dot(LIGHT, -VIEW), 0.0), 2.0);
	DIFFUSE_LIGHT += LIGHT_COLOR / 3.14159 * pow(edge, 3.0) * (0.25 + back) * rim * ATTENUATION * vec3(1.0, 0.72, 0.35) * (1.0 - v_trunk);
}
