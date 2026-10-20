#[compute]
#version 450
// Pass 3 of the painterly stack (OgPaintPost): separable Gaussian blur of the structure tensor (run twice,
// horizontal then vertical), so strokes follow smooth, coherent directions.

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(set = 0, binding = 0) uniform sampler2D src_tex;
layout(rgba16f, set = 0, binding = 1) uniform restrict writeonly image2D out_image;
layout(push_constant, std430) uniform Params {
	vec2 dir; // (1, 0) or (0, 1)
	float sigma;
	float pad;
} params;

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 size = textureSize(src_tex, 0);
	if (p.x >= size.x || p.y >= size.y) {
		return;
	}
	int radius = int(ceil(params.sigma * 2.5));
	vec4 sum = vec4(0.0);
	float wsum = 0.0;
	ivec2 d = ivec2(params.dir);
	for (int i = -radius; i <= radius; i++) {
		float w = exp(-float(i * i) / (2.0 * params.sigma * params.sigma));
		sum += texelFetch(src_tex, clamp(p + d * i, ivec2(0), size - 1), 0) * w;
		wsum += w;
	}
	imageStore(out_image, p, sum / wsum);
}
