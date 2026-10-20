#[compute]
#version 450
// Pass 1b of the painterly stack (OgPaintPost): metering. One 16x16 workgroup reads the paint-resolution
// image on a 32x32 grid (centre-weighted), takes the geometric mean of its display luminance (gamma) and eases
// the stored value toward it. The composite turns it into an exposure gain so a shaded forest and an open
// meadow both land in the mood board's value range (median about 0.15-0.25, docs/art/BIBLE.md "Palette").
// A painter keys every canvas; this is that, at a cost of 1024 texture taps per frame.

layout(local_size_x = 16, local_size_y = 16, local_size_z = 1) in;

layout(set = 0, binding = 0) uniform sampler2D src_tex;
layout(set = 0, binding = 1, std430) restrict buffer State {
	float adapted; // eased geometric-mean luminance (0 = not yet metered)
	float pad0;
	float pad1;
	float pad2;
} state;
layout(push_constant, std430) uniform Params {
	float dt; // seconds since the last frame
	float rate; // adaptation rate (1/s)
	float pad0;
	float pad1;
} params;

shared float s_sum[256];
shared float s_w[256];

void main() {
	uint i = gl_LocalInvocationIndex;
	vec2 id = vec2(gl_LocalInvocationID.xy);
	float sum = 0.0;
	float wsum = 0.0;
	for (int k = 0; k < 4; k++) {
		vec2 uv = (id * 2.0 + vec2(k & 1, k >> 1) + 0.5) / 32.0;
		vec3 c = textureLod(src_tex, uv, 0.0).rgb;
		float l = dot(pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)), vec3(0.299, 0.587, 0.114));
		vec2 d = (uv - 0.5) * vec2(1.6, 1.0);
		float w = 1.0 - 0.6 * smoothstep(0.1, 0.7, length(d));
		sum += log(max(l, 0.01)) * w;
		wsum += w;
	}
	s_sum[i] = sum;
	s_w[i] = wsum;
	barrier();
	for (uint s = 128u; s > 0u; s >>= 1u) {
		if (i < s) {
			s_sum[i] += s_sum[i + s];
			s_w[i] += s_w[i + s];
		}
		barrier();
	}
	if (i == 0u) {
		float mean = exp(s_sum[0] / max(s_w[0], 1e-4));
		float prev = state.adapted;
		float k = 1.0 - exp(-params.dt * params.rate);
		state.adapted = prev <= 0.0 ? mean : mix(prev, mean, k);
	}
}
