shader_type spatial;
// Water (ART-027, docs/art/BIBLE.md "Water"). The sky is a character, and in a top-down game the water is
// where you see it: the surface reflects the same sky the sky shader draws (og_sky_base), cosmic eye
// included, rippled by wind-driven waves. Deep water is blue-black teal, shallows turquoise over the
// painted bed; foam dabs where the water thins against the shore; gold glints where the sun skims the
// ripples. Vertex colour r = depth fraction (OgTerrainMesher).
render_mode blend_mix, depth_draw_opaque, cull_back, specular_disabled;

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_sky.gdshaderinc"

uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform vec3 shallow : source_color = vec3(0.16, 0.48, 0.46);
uniform vec3 deep : source_color = vec3(0.02, 0.10, 0.14);
uniform vec3 foam_color : source_color = vec3(0.92, 0.86, 0.68);
uniform float reflect_strength = 0.9;

varying vec3 v_world;
varying float v_depth;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_depth = COLOR.r;
}

// Ripple height field: two layers of stretched noise travelling downwind.
float ripples(vec2 p, float t) {
	vec2 w = og_wind.xy;
	vec2 q = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
	float a = og_vnoise(q * vec2(0.9, 2.2) - vec2(t * 0.9, 0.0));
	float b = og_vnoise(q * vec2(2.1, 3.8) + vec2(-t * 1.6, t * 0.2) + 7.0);
	return a * 0.65 + b * 0.35;
}

void fragment() {
	vec2 p = v_world.xz;
	float t = TIME;
	float e = 0.12;
	float h0 = ripples(p, t);
	float hx = ripples(p + vec2(e, 0.0), t);
	float hz = ripples(p + vec2(0.0, e), t);
	vec3 n = normalize(vec3(-(hx - h0) / e * 0.18, 1.0, -(hz - h0) / e * 0.18));
	vec3 view_w = normalize(v_world - CAMERA_POSITION_WORLD);
	vec3 r = reflect(view_w, n);
	r.y = abs(r.y);
	vec3 sky = og_sky_base(r, t, 0, og_eye_dir, og_wind.xy);
	float cosv = clamp(dot(-view_w, n), 0.0, 1.0);
	// Painterly Fresnel: the water is mostly mirror, even looking down into it.
	float fres = 0.6 + 0.4 * pow(1.0 - cosv, 2.0);

	// Water thickness from the depth buffer: thin at the shore.
	float scene_depth = texture(depth_tex, SCREEN_UV).r;
	vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, scene_depth, 1.0);
	sv.xyz /= sv.w;
	float thick = clamp(length(sv.xyz) - length(VERTEX), 0.0, 10.0);

	float d = clamp(v_depth * 0.6 + thick * 0.25, 0.0, 1.0);
	vec3 body = mix(shallow, deep, smoothstep(0.0, 0.9, d));
	// Foam: broken dabs along the shore line, drifting.
	float fn = og_vnoise(p * 2.2 + og_wind.xy * t * 0.4) * 0.6 + og_vnoise(p * 5.0 - t * 0.3) * 0.4;
	float foam = (1.0 - smoothstep(0.05, 0.35 + fn * 0.25, thick)) * smoothstep(0.35, 0.6, fn + 0.25);
	// Gold glints where ripples catch the sun.
	float glint = pow(max(dot(r, og_sun_dir), 0.0), 60.0) * smoothstep(0.55, 0.8, h0);

	ALBEDO = mix(body * (1.0 - fres * 0.6), foam_color, foam * 0.85);
	EMISSION = sky * reflect_strength * fres * (1.0 - foam) + og_lin(vec3(1.0, 0.8, 0.45)) * glint * 3.0;
	ALPHA = clamp(mix(0.55, 0.95, smoothstep(0.0, 1.2, thick)) + foam * 0.5, 0.0, 1.0);
	ROUGHNESS = 1.0;
}

void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	DIFFUSE_LIGHT += LIGHT_COLOR / 3.14159 * (0.4 + 0.6 * ndl) * ATTENUATION;
}
