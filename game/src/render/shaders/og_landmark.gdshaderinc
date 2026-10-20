// overgrown G1 landmark geoglyph (ART-027, docs/art/BIBLE.md "Landmark"): the eye drawn on the ground. A
// circle of worn gold lines carved into the land under each floating island, laid out like the cosmic eye
// above it (pupil, iris fibres, a band of rune cells, a ticked rim), so the eye in the sky looks down at its
// own reflection. Pure function in the Godot-shader / GLSL common subset; needs og_noise.gdshaderinc first.

// Ink (0..1) of the geoglyph at `rel` (metres from its centre) for a circle of radius `R` (metres); `aa` is
// the antialiasing width in metres (fwidth of the distance); `t` seconds. Returns (ink, glow pulse).
vec2 og_geoglyph(vec2 rel, float R, float t, float aa) {
	float r = length(rel);
	if (R <= 0.0 || r > R * 1.02) {
		return vec2(0.0);
	}
	float a = atan(rel.y, rel.x) / 6.2831853 + 0.5;
	float w = 0.16 + 0.004 * R;
	float ink = 0.0;
	// Rings (fractions of R).
	ink = max(ink, 1.0 - smoothstep(w, w + aa, abs(r - R * 0.985)));
	ink = max(ink, 1.0 - smoothstep(w * 0.6, w * 0.6 + aa, abs(r - R * 0.92)));
	ink = max(ink, 1.0 - smoothstep(w, w + aa, abs(r - R * 0.6)));
	ink = max(ink, 1.0 - smoothstep(w * 0.6, w * 0.6 + aa, abs(r - R * 0.565)));
	ink = max(ink, 1.0 - smoothstep(w, w + aa, abs(r - R * 0.2)));
	// Ticks on the rim band.
	if (r > R * 0.925 && r < R * 0.98) {
		float s = abs(fract(a * 144.0) - 0.5) * 6.2831853 * r / 144.0;
		ink = max(ink, 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, s));
	}
	// Rune cells between the rim and the iris: 36 cells of two or three strokes each.
	if (r > R * 0.63 && r < R * 0.89) {
		float cu = a * 36.0;
		float cell = floor(cu);
		float fu = fract(cu);
		float fv = (r - R * 0.63) / (R * 0.26);
		float h0 = og_hash12(vec2(cell, 1.0));
		float h1 = og_hash12(vec2(cell, 2.0));
		float h2 = og_hash12(vec2(cell, 3.0));
		float mu = 6.2831853 * r / 36.0; // metres per unit of fu
		float mv = R * 0.26;
		float s = 1e3;
		if (fv > 0.12 && fv < 0.88) {
			s = min(s, abs(fu - (0.3 + h0 * 0.4)) * mu);
		}
		if (fu > 0.2 && fu < 0.8) {
			s = min(s, abs(fv - (0.25 + h1 * 0.5)) * mv);
		}
		if (h2 > 0.45 && fu > 0.15 && fu < 0.85) {
			s = min(s, abs((fv - 0.5) * mv - (fu - 0.5) * mu * (h2 - 0.45) * 3.0) * 0.7);
		}
		ink = max(ink, 1.0 - smoothstep(w * 0.8, w * 0.8 + aa, s));
	}
	// Iris fibres: radial spokes of seeded length from the pupil ring outward.
	if (r > R * 0.2 && r < R * 0.56) {
		float su = a * 120.0;
		float spoke = floor(su);
		float len = 0.35 + 0.65 * og_hash12(vec2(spoke, 9.0));
		float s = abs(fract(su) - 0.5) * 6.2831853 * r / 120.0;
		float reach = R * 0.2 + len * R * 0.36;
		ink = max(ink, (1.0 - smoothstep(w * 0.45, w * 0.45 + aa, s)) * (1.0 - smoothstep(reach - 0.5, reach, r)));
	}
	// The pupil: a solid disc.
	ink = max(ink, 1.0 - smoothstep(R * 0.07, R * 0.07 + aa, r));
	// Worn and overgrown: grass breaks the lines in patches.
	float wear = og_vnoise(rel * 0.9 + 17.0) * 0.6 + og_vnoise(rel * 3.1) * 0.4;
	ink *= smoothstep(0.22, 0.42, wear);
	// Light travels inward along the glyph, like the pillar draining into it.
	float pulse = 0.55 + 0.45 * sin(r * 0.45 + t * 1.4);
	return vec2(ink, pulse);
}
