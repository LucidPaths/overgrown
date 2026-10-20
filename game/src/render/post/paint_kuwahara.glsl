#[compute]
#version 450
// Pass 4 of the painterly stack (OgPaintPost): the anisotropic Kuwahara filter with polynomial sector
// weights (Kyprianidis, Kang and Doellner 2009; Kyprianidis 2011). Each pixel becomes the mean of the
// least-varied of 8 sectors of an ellipse stretched along the local edge direction: flat areas turn into
// brush dabs, edges stay crisp and get stroked along their length. Low quality runs it isotropic.

layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

layout(set = 0, binding = 0) uniform sampler2D src_tex;
layout(set = 0, binding = 1) uniform sampler2D tensor_tex;
layout(rgba16f, set = 0, binding = 2) uniform restrict writeonly image2D out_image;
layout(push_constant, std430) uniform Params {
	float radius; // px at paint resolution
	float alpha; // anisotropy tuning (1 = classic; 0 = isotropic)
	float sharpness; // q
	float hardness;
} params;

void main() {
	ivec2 p = ivec2(gl_GlobalInvocationID.xy);
	ivec2 size = textureSize(src_tex, 0);
	if (p.x >= size.x || p.y >= size.y) {
		return;
	}
	vec4 g = texelFetch(tensor_tex, p, 0);
	float lambda1 = 0.5 * (g.z + g.x + sqrt(max(0.0, (g.z - g.x) * (g.z - g.x) + 4.0 * g.y * g.y)));
	float lambda2 = 0.5 * (g.z + g.x - sqrt(max(0.0, (g.z - g.x) * (g.z - g.x) + 4.0 * g.y * g.y)));
	vec2 v = vec2(lambda1 - g.x, -g.y);
	vec2 t = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
	float phi = -atan(t.y, t.x);
	float A = (lambda1 + lambda2 > 0.0) ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;

	float radius = params.radius;
	float al = max(params.alpha, 1e-4);
	float a = params.alpha > 0.0 ? radius * clamp((al + A) / al, 0.1, 2.0) : radius;
	float b = params.alpha > 0.0 ? radius * clamp(al / (al + A), 0.1, 2.0) : radius;
	float cos_phi = cos(phi);
	float sin_phi = sin(phi);
	mat2 R = mat2(cos_phi, -sin_phi, sin_phi, cos_phi);
	mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
	mat2 SR = S * R;
	int max_x = int(sqrt(a * a * cos_phi * cos_phi + b * b * sin_phi * sin_phi));
	int max_y = int(sqrt(a * a * sin_phi * sin_phi + b * b * cos_phi * cos_phi));

	const float zeta = 2.0 / 2.0; // 2 / (kernel radius in the normalised frame)
	const float eta = 0.84;
	vec4 m[8];
	vec3 s[8];
	for (int k = 0; k < 8; k++) {
		m[k] = vec4(0.0);
		s[k] = vec3(0.0);
	}
	for (int j = -max_y; j <= max_y; j++) {
		for (int i = -max_x; i <= max_x; i++) {
			vec2 vv = SR * vec2(i, j);
			if (dot(vv, vv) > 0.25) {
				continue;
			}
			vec3 c = texelFetch(src_tex, clamp(p + ivec2(i, j), ivec2(0), size - 1), 0).rgb;
			float w[8];
			float sum = 0.0;
			float z;
			float vxx = zeta - eta * vv.x * vv.x;
			float vyy = zeta - eta * vv.y * vv.y;
			z = max(0.0, vv.y + vxx); w[0] = z * z; sum += w[0];
			z = max(0.0, -vv.x + vyy); w[2] = z * z; sum += w[2];
			z = max(0.0, -vv.y + vxx); w[4] = z * z; sum += w[4];
			z = max(0.0, vv.x + vyy); w[6] = z * z; sum += w[6];
			vec2 v2 = 0.70710678 * vec2(vv.x - vv.y, vv.x + vv.y);
			vxx = zeta - eta * v2.x * v2.x;
			vyy = zeta - eta * v2.y * v2.y;
			z = max(0.0, v2.y + vxx); w[1] = z * z; sum += w[1];
			z = max(0.0, -v2.x + vyy); w[3] = z * z; sum += w[3];
			z = max(0.0, -v2.y + vxx); w[5] = z * z; sum += w[5];
			z = max(0.0, v2.x + vyy); w[7] = z * z; sum += w[7];
			float gw = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
			for (int k = 0; k < 8; k++) {
				float wk = w[k] * gw;
				m[k] += vec4(c * wk, wk);
				s[k] += c * c * wk;
			}
		}
	}
	vec4 o = vec4(0.0);
	for (int k = 0; k < 8; k++) {
		if (m[k].w <= 0.0) {
			continue;
		}
		vec3 mean = m[k].rgb / m[k].w;
		vec3 var = abs(s[k] / m[k].w - mean * mean);
		float sigma2 = var.r + var.g + var.b;
		float w = 1.0 / (1.0 + pow(params.hardness * 1000.0 * sigma2, 0.5 * params.sharpness));
		o += vec4(mean * w, w);
	}
	vec3 result = o.w > 0.0 ? o.rgb / o.w : texelFetch(src_tex, p, 0).rgb;
	// Alpha carries the anisotropy (stroke strength) and the stroke angle for the composite.
	imageStore(out_image, p, vec4(result, A));
}
