shader_type spatial;
// Grass and reeds (ART-027, docs/art/BIBLE.md "Props"). Instances carry the ground colour under them
// (INSTANCE_CUSTOM.rgb, sRGB), so roots melt into the painted ground; tips catch the gold light and glow
// when the sun is behind them. Wind bends every blade (gusts travel downwind); blades shrink away with
// distance instead of popping. Normals point up: grass is lit exactly like the ground.
render_mode cull_disabled, world_vertex_coords;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_light.gdshaderinc"

// Full size until FADE_FROM metres from the camera, gone at FADE_TO.
uniform float fade_from = 30.0;
uniform float fade_to = 48.0;
// Metres a blade tip moves per unit of wind.
uniform float sway = 0.22;
uniform vec3 tip_tint : source_color = vec3(1.0, 0.86, 0.45);
uniform float flower_chance = 0.06;

varying vec3 v_world;
varying float v_h;
varying vec3 v_ground;
varying float v_rand;

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	float h = COLOR.r;
	v_h = h;
	v_rand = INSTANCE_CUSTOM.a;
	v_ground = og_lin(INSTANCE_CUSTOM.rgb);
	float dist = length(origin - CAMERA_POSITION_WORLD);
	float shrink = 1.0 - smoothstep(fade_from, fade_to, dist);
	VERTEX = origin + (VERTEX - origin) * vec3(1.0, shrink, 1.0);
	float gust = og_gust(origin.xz, TIME);
	float phase = dot(origin.xz, vec2(0.37, 0.23)) + COLOR.g * 6.2831;
	float flutter = sin(TIME * 2.3 + phase) * 0.35 + sin(TIME * 4.1 + phase * 1.7) * 0.15;
	vec3 w = og_wind_vec();
	VERTEX += (w * (0.75 + flutter) * gust + vec3(-w.z, 0.0, w.x) * flutter * 0.4) * sway * h * h * shrink;
	v_world = VERTEX;
	NORMAL = vec3(0.0, 1.0, 0.0);
}

void fragment() {
	vec3 root = v_ground * vec3(0.62, 0.80, 0.85);
	vec3 tip = v_ground * tip_tint * 1.35;
	vec3 col = mix(root, tip, smoothstep(0.1, 1.0, v_h));
	// A few clumps flower: orange or cream heads.
	if (v_rand > 1.0 - flower_chance && v_h > 0.75) {
		col = v_rand > 1.0 - flower_chance * 0.5 ? og_lin(vec3(0.95, 0.48, 0.16)) : og_lin(vec3(0.98, 0.88, 0.62));
	}
	ALBEDO = col;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	DIFFUSE_LIGHT += og_paint_light(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_world, 0.35, 1.0, TIME);
	// Backlit tips glow gold.
	float back = pow(max(dot(LIGHT, -VIEW), 0.0), 3.0) * v_h * v_h;
	DIFFUSE_LIGHT += LIGHT_COLOR / 3.14159 * back * 0.9 * ATTENUATION * vec3(1.0, 0.7, 0.3);
}
