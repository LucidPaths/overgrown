shader_type spatial;
// The landmark's waterfall (ART-027; mood board 09): streaks of pale water spilling off the island rim and
// dissolving into mist long before the ground. Unshaded so it glows faintly against the dark rock.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;

#include "res://src/render/shaders/og_noise.gdshaderinc"

uniform vec3 water : source_color = vec3(0.78, 0.90, 0.86);
uniform vec3 mist : source_color = vec3(0.95, 0.85, 0.62);

void fragment() {
	vec2 uv = UV;
	float streak = og_vnoise(vec2(uv.x * 9.0, uv.y * 3.0 - TIME * 2.4)) * 0.6 + og_vnoise(vec2(uv.x * 23.0, uv.y * 7.0 - TIME * 3.1)) * 0.4;
	float edge = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
	float fade = 1.0 - smoothstep(0.35, 1.0, uv.y);
	float a = edge * fade * smoothstep(0.3, 0.7, streak + 0.15);
	ALBEDO = og_lin(mix(water, mist, smoothstep(0.2, 0.9, uv.y))) * (0.8 + 0.6 * streak);
	ALPHA = clamp(a * 0.85, 0.0, 1.0);
}
