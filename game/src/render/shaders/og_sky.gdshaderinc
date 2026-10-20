// overgrown G1 sky: the cosmic eye, nebulae, stars and wind-driven painted clouds (docs/art/BIBLE.md, "Sky").
// Included by the sky shader and by the water (which reflects it). Needs og_common.gdshaderinc first.
// Colours are authored in sRGB and returned in linear HDR (the eye's core goes above 1 so it glows).

// The eye: angular radius of the iris (tan of the angle); the nebula ring reaches about 2.6x this.
const float OG_EYE_R = 0.27;

// The horizon band colour for a horizontal direction: warm gold toward the eye, deep teal away from it.
// The post fog uses the same formula (post/paint_composite.glsl, horizon_color) so fogged ground meets the
// sky without a seam.
vec3 og_horizon(vec3 d) {
	vec2 h = normalize(d.xz + vec2(1e-5, 0.0));
	vec2 e = normalize(og_eye_dir.xz + vec2(1e-5, 0.0));
	float toward = dot(h, e) * 0.5 + 0.5;
	vec3 cool = og_lin(vec3(0.16, 0.36, 0.38));
	vec3 warm = og_lin(vec3(0.96, 0.66, 0.30));
	return mix(cool, warm, pow(toward, 2.6));
}

// The eye: colour (linear HDR) and coverage (0..1) for view direction d.
vec4 og_eye(vec3 d, float t, int detail) {
	vec3 ed = og_eye_dir;
	float c = dot(d, ed);
	if (c <= 0.05) {
		return vec4(0.0);
	}
	vec3 R = normalize(cross(vec3(0.0, 1.0, 0.0), ed));
	vec3 U = cross(ed, R);
	vec2 q = vec2(dot(d, R), dot(d, U)) / c;
	float r = length(q) / OG_EYE_R;
	if (r > 3.4) {
		return vec4(0.0);
	}
	float a = atan(q.y, q.x);
	float u = a / 6.2831853 + 0.5; // 0..1 around

	// Iris fibres: dense radial streaks, slowly turning.
	float fib_u = fract(u + t * 0.0015);
	float fib = og_pfbm(vec2(fib_u * 96.0, r * 2.2 - t * 0.02), 96.0, detail > 0 ? 3 : 2);
	float fib2 = og_pnoise(vec2(fib_u * 240.0, r * 5.0), 240.0);
	float streak = fib * 0.75 + fib2 * 0.4;

	vec3 col = vec3(0.0);
	float cover = 0.0;

	// Pupil: a deep navy well with a white-blue star at its centre.
	float pupil = 1.0 - smoothstep(0.24, 0.34 + streak * 0.08, r);
	vec3 pupil_col = og_lin(vec3(0.02, 0.05, 0.11));

	// Iris: cyan-blue fibres brightening outward, then a gold rim.
	float iris_m = smoothstep(0.22, 0.34, r) * (1.0 - smoothstep(0.9, 1.15 + streak * 0.25, r));
	vec3 iris_in = og_lin(vec3(0.10, 0.42, 0.62));
	vec3 iris_mid = og_lin(vec3(0.20, 0.68, 0.78));
	vec3 iris_rim = og_lin(vec3(0.98, 0.78, 0.36));
	float k = smoothstep(0.3, 1.0, r);
	vec3 iris_col = mix(iris_in, iris_mid, smoothstep(0.3, 0.7, r));
	iris_col = mix(iris_col, iris_rim, smoothstep(0.72, 1.02, r + (streak - 0.5) * 0.3));
	iris_col *= 0.55 + 1.1 * streak * streak + 0.4 * k;

	// The burnt-orange nebula ring around the iris, spiralling, with dark gaps.
	float spiral_u = u + r * 0.08 - t * 0.0008;
	vec2 rp = vec2(fract(spiral_u) * 18.0, r * 1.7);
	float warp = og_pfbm(rp * vec2(1.0, 1.0) + vec2(0.0, t * 0.01), 18.0, 2);
	float neb = og_pfbm(vec2(fract(spiral_u + warp * 0.05) * 36.0, r * 3.1 + warp * 1.6), 36.0, detail > 0 ? 4 : 2);
	float ring_env = smoothstep(0.85, 1.15, r) * (1.0 - smoothstep(1.9, 2.9 + neb, r));
	float ring_m = ring_env * smoothstep(0.38, 0.62, neb);
	vec3 ring_dark = og_lin(vec3(0.55, 0.16, 0.07));
	vec3 ring_hot = og_lin(vec3(0.98, 0.50, 0.18));
	vec3 ring_gold = og_lin(vec3(1.0, 0.80, 0.42));
	vec3 ring_col = mix(ring_dark, ring_hot, smoothstep(0.45, 0.75, neb));
	ring_col = mix(ring_col, ring_gold, smoothstep(0.7, 0.9, neb) * (1.0 - smoothstep(1.0, 2.0, r)));
	ring_col *= 1.15;

	// Outer arms: thin gold-teal wisps fading out.
	float arm_n = og_pfbm(vec2(fract(u + r * 0.16 + t * 0.0005) * 10.0, r * 1.3), 10.0, 2);
	float arm_m = smoothstep(1.8, 2.3, r) * (1.0 - smoothstep(2.6, 3.3, r)) * smoothstep(0.5, 0.72, arm_n) * 0.6;
	vec3 arm_col = mix(og_lin(vec3(0.85, 0.55, 0.22)), og_lin(vec3(0.25, 0.55, 0.52)), arm_n);

	col = pupil_col;
	cover = pupil;
	col = mix(col, iris_col, iris_m);
	cover = max(cover, iris_m);
	col = mix(col, ring_col, ring_m);
	cover = max(cover, ring_m);
	col = mix(col, arm_col, arm_m * (1.0 - cover));
	cover = max(cover, arm_m);

	// The star in the pupil and its four-point flare (added light, not coverage).
	float r2 = r * OG_EYE_R;
	vec3 star = og_lin(vec3(0.85, 0.95, 1.0)) * (exp(-r2 * r2 * 9000.0) * 6.0
		+ exp(-abs(q.x) * 240.0) * exp(-abs(q.y) * 18.0) * 0.9
		+ exp(-abs(q.y) * 240.0) * exp(-abs(q.x) * 18.0) * 0.9);
	// A soft halo so the iris reads as light, not paint.
	vec3 halo = og_lin(vec3(0.30, 0.75, 0.85)) * exp(-r * 2.2) * 0.35;
	col += (star + halo) * (1.0 - smoothstep(1.0, 1.4, r));
	return vec4(col, cover);
}

// Stars: a fine field plus a few large four-point stars.
vec3 og_stars(vec3 d, float t) {
	vec3 col = vec3(0.0);
	vec3 p = d * 150.0;
	vec3 cell = floor(p);
	float h = og_hash13(cell);
	if (h > 0.93) {
		vec3 jitter = vec3(og_hash13(cell + 7.1), og_hash13(cell + 13.7), og_hash13(cell + 29.3));
		float dist = length(fract(p) - jitter);
		float b = (h - 0.93) / 0.07;
		vec3 tint = mix(og_lin(vec3(1.0, 0.82, 0.55)), og_lin(vec3(0.7, 0.9, 1.0)), og_hash13(cell + 3.3));
		col += tint * smoothstep(0.16, 0.0, dist) * (0.4 + 2.2 * b * b) * (0.8 + 0.2 * sin(t * 2.0 + h * 50.0));
	}
	vec3 p2 = d * 24.0;
	vec3 c2 = floor(p2);
	float h2 = og_hash13(c2 + 101.0);
	if (h2 > 0.965) {
		vec3 j2 = vec3(0.3) + 0.4 * vec3(og_hash13(c2 + 1.1), og_hash13(c2 + 2.2), og_hash13(c2 + 3.3));
		vec3 f = fract(p2) - j2;
		float core = exp(-dot(f, f) * 900.0) * 4.0;
		float flare = exp(-abs(f.x) * 90.0) * exp(-length(f.yz) * 10.0) + exp(-abs(f.y) * 90.0) * exp(-length(f.xz) * 10.0);
		col += og_lin(vec3(1.0, 0.92, 0.75)) * (core + flare * 0.7) * (0.75 + 0.25 * sin(t * 1.3 + h2 * 40.0));
	}
	return col;
}

// The sky colour (linear HDR) for unit view direction d. detail 0 is the cheap version (water reflection,
// radiance), 1 the full one.
vec3 og_sky(vec3 d, float t, int detail) {
	float y = d.y;
	vec3 hor = og_horizon(d);
	vec3 low = og_lin(vec3(0.07, 0.25, 0.30));
	vec3 high = og_lin(vec3(0.025, 0.07, 0.11));
	vec3 zen = og_lin(vec3(0.01, 0.025, 0.05));
	float ya = max(y, 0.0);
	vec3 col = mix(hor, low, smoothstep(0.0, 0.22, ya));
	col = mix(col, high, smoothstep(0.15, 0.55, ya));
	col = mix(col, zen, smoothstep(0.5, 1.0, ya));
	// The eye's light washes the sky around it.
	float toward_eye = max(dot(d, og_eye_dir), 0.0);
	col += og_lin(vec3(0.95, 0.62, 0.28)) * pow(toward_eye, 10.0) * 0.35 * (1.0 - smoothstep(0.0, 0.5, ya) * 0.4);

	// Big nebula veils: burnt orange and teal, broken, with dark lanes.
	vec2 np = d.xz / (ya + 0.35);
	float nw = og_fbm(np * 0.9 + vec2(t * 0.004, 0.0), 2);
	float nn = og_fbm(np * 1.6 + nw * 1.8, detail > 0 ? 4 : 3);
	float veil = smoothstep(0.5, 0.78, nn) * smoothstep(0.03, 0.25, ya);
	vec3 veil_col = mix(og_lin(vec3(0.62, 0.24, 0.09)), og_lin(vec3(0.16, 0.48, 0.46)), smoothstep(0.35, 0.65, nw));
	col = mix(col, veil_col, veil * 0.55);

	if (y > -0.02) {
		col += og_stars(d, t) * smoothstep(0.0, 0.2, ya) * (1.0 - veil * 0.6);
	}

	vec4 eye = og_eye(d, t, detail);
	col = mix(col, eye.rgb, eye.a);
	col += eye.rgb * (1.0 - eye.a) * 0.6;

	// Painted cloud banks near the horizon, drifting downwind; lit gold on the eye side.
	vec2 cp = d.xz / (ya + 0.06) * 0.35 + og_wind.xy * t * 0.006;
	float cw = og_fbm(cp * 0.7, 2);
	float cn = og_fbm(cp + cw * 1.3, detail > 0 ? 5 : 3);
	float band = 1.0 - smoothstep(0.08, 0.32, ya);
	float cloud = smoothstep(0.52, 0.66, cn) * band * smoothstep(-0.02, 0.02, y);
	float lit = smoothstep(0.55, 0.85, cn + toward_eye * 0.25);
	vec3 cloud_col = mix(og_lin(vec3(0.10, 0.22, 0.24)), og_lin(vec3(0.98, 0.70, 0.34)), lit * (0.35 + 0.65 * pow(toward_eye, 2.0)));
	col = mix(col, cloud_col, cloud * 0.92);

	// Below the horizon the sky is the horizon colour (it only shows past the streaming edge, under fog).
	col = mix(hor, col, smoothstep(-0.03, 0.0, y));
	return col;
}
