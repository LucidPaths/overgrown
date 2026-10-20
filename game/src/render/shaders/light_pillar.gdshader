shader_type spatial;
// The landmark's pillar of light (ART-027; mood board 05): a beam of turbulent gold running from the floating
// island toward the cosmic eye. Additive and unshaded; brightest along its axis, flowing upward.
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

#include "res://src/render/shaders/og_noise.gdshaderinc"

uniform vec3 color : source_color = vec3(1.0, 0.76, 0.38);
uniform float length_m = 420.0;
uniform float energy = 2.2;

varying vec3 v_local;

void vertex() {
	v_local = VERTEX;
}

void fragment() {
	float y = v_local.y + length_m * 0.5;
	float axis = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float a = atan(v_local.z, v_local.x) / 6.2831853 + 0.5;
	float flow = og_pfbm(vec2(a * 6.0, y * 0.05 - TIME * 0.9), 6.0, 3);
	float threads = og_pnoise(vec2(a * 24.0, y * 0.02 - TIME * 1.6), 24.0);
	float core = pow(axis, 3.0);
	float k = core * (0.55 + flow * 0.9) + pow(axis, 8.0) * threads * 0.8;
	float base_fade = smoothstep(0.0, 6.0, y);
	float top_fade = 1.0 - smoothstep(length_m * 0.35, length_m, y);
	ALBEDO = og_lin(color) * k * energy * base_fade * top_fade;
}
