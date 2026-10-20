shader_type sky;
// The overgrown sky (ART-027): see og_sky.gdshaderinc. With the painterly post stack on, the post repaints
// every sky pixel (post/paint_prep.glsl), so this shader only feeds the cheap radiance version; with the post
// off it draws the full sky itself.

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_sky.gdshaderinc"

uniform bool post_on = false;
// Post off only: Godot's depth fog colour, which the sky below the horizon must match (no streaming edge).
uniform vec3 below_color : source_color = vec3(0.4, 0.4, 0.35);

void sky() {
	if (AT_CUBEMAP_PASS || post_on) {
		COLOR = og_sky_base(EYEDIR, TIME, 0, og_eye_dir, og_wind.xy);
	} else {
		COLOR = og_sky(EYEDIR, TIME, 1, og_eye_dir, og_wind.xy);
		COLOR = mix(COLOR, below_color, smoothstep(0.0, -0.04, EYEDIR.y));
	}
}
