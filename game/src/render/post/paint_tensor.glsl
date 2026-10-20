#[compute]
#version 450
// Pass 2 of the painterly stack (OgPaintPost): the structure tensor of the paint-resolution image (Sobel
// per channel, summed), the field the brush strokes follow. Out: (E, F, G, 1) = (gx.gx, gx.gy, gy.gy).

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(set = 0, binding = 0) uniform sampler2D src_tex;
layout(rgba16f, set = 0, binding = 1) uniform restrict writeonly image2D out_image;

vec3 at(ivec2 p, ivec2 size) {
	return texelFetch(src_tex, clamp(p, ivec2(0), size - 1), 0).rgb;
}

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 size = textureSize(src_tex, 0);
	if (p.x >= size.x || p.y >= size.y) {
		return;
	}
	vec3 tl = at(p + ivec2(-1, -1), size);
	vec3 t = at(p + ivec2(0, -1), size);
	vec3 tr = at(p + ivec2(1, -1), size);
	vec3 l = at(p + ivec2(-1, 0), size);
	vec3 r = at(p + ivec2(1, 0), size);
	vec3 bl = at(p + ivec2(-1, 1), size);
	vec3 b = at(p + ivec2(0, 1), size);
	vec3 br = at(p + ivec2(1, 1), size);
	vec3 gx = (tr + 2.0 * r + br - tl - 2.0 * l - bl) * 0.25;
	vec3 gy = (bl + 2.0 * b + br - tl - 2.0 * t - tr) * 0.25;
	imageStore(out_image, p, vec4(dot(gx, gx), dot(gx, gy), dot(gy, gy), 1.0));
}
