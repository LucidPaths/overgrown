// The wanderer's painted look (ART-028). The hand-painted atlas carries the colour and the brushwork; the light
// is stepped into soft bands like a painter's value groups, shadows stay in the environment's cool ambient, and a
// warm rim catches the silhouette edges that face the light so the dark poncho reads against any ground.
// The starry void of the face and the cape's turquoise gem glow faintly.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
// Value steps: where the lit side starts and how soft the band edges are (in wrapped N·L).
uniform float band_lo = 0.22;
uniform float band_hi = 0.62;
uniform float band_soft = 0.1;
uniform float lit_floor = 0.18;
uniform vec3 rim_color : source_color = vec3(1.0, 0.72, 0.36);
uniform float rim_strength = 0.7;
uniform float rim_width = 0.15;
uniform float face_glow = 2.5;

// Linings and the robe under the cape carry baked occlusion <= 0.6: no rim there (it lit the inner lining).
varying float v_rim_mask;

void vertex() {
	v_rim_mask = smoothstep(0.62, 0.8, COLOR.r);
}

void fragment() {
	vec3 c = texture(albedo_tex, UV).rgb;
	ALBEDO = c * COLOR.rgb;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	// Face region of the atlas (x 256..512, y 800..1024 of 1024): its specks are stars.
	float face = step(0.25, UV.x) * step(UV.x, 0.5) * step(0.78125, UV.y);
	float star = max(max(c.r, c.g), c.b);
	EMISSION = face * c * smoothstep(0.12, 0.45, star) * face_glow;
	// The gem: saturated turquoise.
	float gem = smoothstep(0.25, 0.4, c.g - c.r) * smoothstep(0.3, 0.5, c.b);
	EMISSION += gem * c * 0.8;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float w = (ndl + 0.3) / 1.3;
	float lit = lit_floor + (1.0 - lit_floor) * (0.55 * smoothstep(band_lo - band_soft, band_lo + band_soft, w)
			+ 0.45 * smoothstep(band_hi - band_soft, band_hi + band_soft, w));
	lit *= mix(0.35, 1.0, ATTENUATION);
	DIFFUSE_LIGHT += LIGHT_COLOR * lit / PI;
	// Rim: the grazing edges, stronger where they face the light. Not multiplied by albedo, so it shows on the
	// dark cloth.
	float ndv = dot(NORMAL, VIEW);
	// Only true silhouette edges: an inner lining seen through an opening faces away (ndv < 0) and gets none.
	float rim = (1.0 - smoothstep(0.02, rim_width, ndv)) * smoothstep(-0.05, 0.05, ndv) * clamp(ndl * 0.8 + 0.35, 0.0, 1.0);
	SPECULAR_LIGHT += rim_color * LIGHT_COLOR * rim * v_rim_mask * rim_strength * mix(0.3, 1.0, ATTENUATION) / PI;
}
