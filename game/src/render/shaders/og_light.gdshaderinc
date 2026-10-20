// overgrown G1 painted lighting (docs/art/BIBLE.md, "Light"). One light model for every world surface,
// characters included later, so the whole frame shares one palette logic:
// - a soft two-tone ramp (lit / shadow) instead of a smooth Lambert falloff: paintings model form in a few
//   values, not a gradient;
// - a warm band at the terminator (the orange edge where gold light turns to teal shadow);
// - drifting cloud shadows on the ground (the wind, in the light itself);
// - shadows take the teal ambient (Environment ambient light), lights the gold sun.
// Needs og_common.gdshaderinc. Call og_paint_light from light() with the light() built-ins.

// Returns the diffuse light to add. `wrap` softens the terminator (0 hard, 1 very soft); `world` is the
// fragment's world position (for cloud shadows); `clouds` 0 disables them.
vec3 og_paint_light(vec3 normal, vec3 light, vec3 light_color, float attenuation, bool directional, vec3 world, float wrap, float clouds, float t) {
	float ndl = dot(normal, light);
	float w = (ndl + wrap) / (1.0 + wrap);
	float lit = smoothstep(0.0, 0.32, w);
	float shade = attenuation;
	if (directional && clouds > 0.0) {
		shade *= mix(1.0, og_cloud_shadow(world.xz, t), clouds);
	}
	float band = smoothstep(0.0, 0.16, w) * (1.0 - smoothstep(0.16, 0.42, w));
	vec3 warm_edge = vec3(0.55, 0.20, 0.03) * band;
	return light_color / 3.14159265 * (vec3(lit) + warm_edge) * shade;
}
