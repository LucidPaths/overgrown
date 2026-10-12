import { HEADER, LIGHT_FN, LIGHT_UNIFORMS, NOISE } from "./glsl";

/** Wind: a gentle sway plus rolling gusts that travel across the land (the same field moves grass and trees). */
export const WIND = `
uniform vec4 uPushers[12]; // xz = actor feet, w = radius (0 = unused)
vec3 wind(vec3 wp, float w, float t) {
  float gust = vnoise((wp.xz + vec2(-t * 38.0, -t * 12.0)) / 90.0);
  gust = smoothstep(0.35, 0.85, gust);
  float sway = sin(t * 2.1 + (wp.x + wp.z) * 0.07) * 0.6 + sin(t * 3.7 + wp.x * 0.13) * 0.25;
  vec3 off = vec3(0.9, 0.0, 0.3) * (sway + gust * 2.6) * w;
  // characters push foliage aside
  for (int i = 0; i < 12; i++) {
    vec4 p = uPushers[i];
    if (p.w <= 0.0) continue;
    vec2 d = wp.xz - p.xy;
    float l = length(d);
    float k = (1.0 - smoothstep(p.w * 0.4, p.w, l)) * w;
    off.xz += d / max(l, 0.001) * k * 5.0;
    off.y -= k * 2.0;
  }
  return off;
}
`;

export const PROP_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aAux;
${LIGHT_UNIFORMS}
${NOISE}
${WIND}
out vec3 vWp; out vec3 vN; out vec4 vCol; out float vH;
void main() {
  vec3 wp = aPos;
  vH = aAux.z * 255.0;
  wp += wind(aPos, aAux.x, uTime);
  vWp = wp; vN = aNrm; vCol = aCol;
  gl_Position = uViewProj * vec4(wp, 1.0);
  gl_Position.y += uLean * aAux.z * 255.0;
}`;

export const PROP_SHADOW_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 aAux;
uniform mat4 uLightViewProj;
uniform float uTime;
${NOISE}
${WIND}
void main() {
  vec3 wp = aPos + wind(aPos, aAux.x, uTime);
  gl_Position = uLightViewProj * vec4(wp, 1.0);
}`;

export const PROP_FS = `${HEADER}
${LIGHT_UNIFORMS}
${NOISE}
${LIGHT_FN}
in vec3 vWp; in vec3 vN; in vec4 vCol; in float vH;
uniform vec4 uCut; // the local player's chest: G-buffer texel xy, window depth, radius in texels (0 = off)
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  // cutaway: the parts of tall props between the camera and the player thin out to a dither around them
  if (uCut.w > 0.0 && vH > 7.0 && gl_FragCoord.z < uCut.z) {
    vec2 d = (gl_FragCoord.xy - uCut.xy) * vec2(1.0, 0.85);
    float r = length(d) / uCut.w;
    ivec2 q = ivec2(gl_FragCoord.xy);
    if (r < 0.7 && ((q.x + q.y) & 1) == 0) discard;
    if (r < 1.0 && (q.x & 1) == 0 && (q.y & 1) == 0) discard;
  }
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  int mat = int(vCol.a * 255.0 + 0.5);
  vec3 albedo = vCol.rgb;
  float soft = mat == 5 ? 0.12 : 0.05;
  vec3 c = light(albedo, n, vWp, mat == 5 ? 2.5 : 1.0, soft);
  oColor = vec4(c, 1.0);
  oAux = vec4(n.xz * 0.5 + 0.5, vCol.a, 1.0);
}`;
