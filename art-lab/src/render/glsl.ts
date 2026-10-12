// Shared GLSL pieces. Every lit surface goes through `light()`, so the whole world shares one light model.

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

export const NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) { return vnoise(p) * 0.6667 + vnoise(p * 2.03 + 17.0) * 0.3333; }
`;

/** Uniform block every lit shader declares (plain uniforms; WebGL2 UBOs would be the next step). */
export const LIGHT_UNIFORMS = `
uniform mat4 uViewProj;
uniform mat4 uLightViewProj;
uniform highp sampler2D uShadow;
uniform vec3 uSunDir;      // toward the sun
uniform vec3 uSunCol;
uniform vec3 uSkyCol;      // ambient from above
uniform vec3 uBounceCol;   // ambient from below
uniform vec3 uShadeTint;   // hue the shadows lean toward
uniform float uTime;
uniform vec2 uCloud;       // cloud drift offset (world px)
uniform float uCloudAmt;
uniform vec2 uShadowTexel;
uniform float uLean;       // clip-space y per px of height above an object's base: upright things lean back to face the camera
`;

export const LIGHT_FN = `
float shadowAt(vec3 wp, float bias) {
  vec4 lp = uLightViewProj * vec4(wp, 1.0);
  vec3 c = lp.xyz / lp.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 1.0;
  float d = texture(uShadow, c.xy).r;
  return c.z - bias / 2400.0 > d ? 0.0 : 1.0;
}
float cloudAt(vec3 wp) {
  float n = fbm2((wp.xz + uCloud) / 260.0);
  return 1.0 - smoothstep(0.52, 0.68, n) * 0.6 * uCloudAmt;
}
// Toon light: two hard terminators (core shadow, half tone), a cast shadow, cloud shade, hemispheric ambient.
vec3 light(vec3 albedo, vec3 n, vec3 wp, float bias, float softness) {
  float ndl = dot(n, uSunDir);
  float d = smoothstep(0.0, softness, ndl) * 0.55 + smoothstep(0.38, 0.38 + softness, ndl) * 0.45;
  float s = shadowAt(wp, bias) * cloudAt(wp);
  float direct = min(d, s);
  vec3 amb = mix(uBounceCol, uSkyCol, n.y * 0.5 + 0.5);
  vec3 shade = albedo * amb * uShadeTint * 0.72;
  vec3 lit = albedo * (amb * 0.22 + uSunCol * 0.86);
  return mix(shade, lit, direct);
}
`;
