import { HEADER, LIGHT_FN, LIGHT_UNIFORMS, NOISE } from "./glsl";

/** Attribute locations shared by every mesh kind. */
export const LOC = { pos: 0, nrm: 1, col: 2, aux: 3, inst0: 4, inst1: 5, inst2: 6, bone: 7 } as const;

export const TERRAIN_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aTint;
layout(location=3) in vec4 aW;
${LIGHT_UNIFORMS}
out vec3 vWp; out vec3 vN; out vec4 vTint; out vec4 vW;
void main() {
  vWp = aPos; vN = aNrm; vTint = aTint; vW = aW;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const TERRAIN_FS = `${HEADER}
${LIGHT_UNIFORMS}
${NOISE}
${LIGHT_FN}
in vec3 vWp; in vec3 vN; in vec4 vTint; in vec4 vW;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
  if (fn.y < 0.0) fn = -fn;
  vec3 n = normalize(vN);
  float steep = smoothstep(0.75, 0.55, fn.y);
  n = normalize(mix(n, fn, steep));
  vec2 p = vWp.xz;
  float nb = (fbm2(p / 13.0) - 0.5) * 0.7 + (vnoise(p / 3.5) - 0.5) * 0.22;

  // grass: base tint, a two-tone clump pattern, warm sunny flecks
  vec3 grass = vTint.rgb;
  float clump = vnoise(p / 11.0) * 0.65 + vnoise(p / 4.0 + 9.0) * 0.35;
  grass *= mix(0.93, 1.05, step(0.56, clump));
  vec3 forestFloor = mix(grass * vec3(0.78, 0.86, 0.9), vec3(0.36, 0.3, 0.2), 0.18);
  float leaf = step(0.9, vnoise(p / 2.5 + 31.0)) * vW.w;
  grass = mix(grass, forestFloor, smoothstep(0.3, 0.8, vW.w + nb * 0.4));
  grass = mix(grass, vec3(0.62, 0.42, 0.22), leaf * 0.35);

  vec3 sand = mix(vec3(0.91, 0.82, 0.6), vec3(0.96, 0.89, 0.7), step(0.6, vnoise(p / 2.5)));
  vec3 dirt = mix(vec3(0.62, 0.45, 0.3), vec3(0.7, 0.53, 0.36), step(0.55, vnoise(p / 3.0 + 3.0)));
  dirt = mix(dirt, vec3(0.5, 0.36, 0.25), step(0.85, vnoise(p / 1.5)) * 0.6);
  float strata = hash12(vec2(floor(vWp.y / 3.0), 7.0));
  vec3 rockTop = mix(vec3(0.62, 0.61, 0.6), vec3(0.7, 0.68, 0.64), step(0.5, vnoise(p / 4.0)));
  vec3 rockFace = mix(vec3(0.5, 0.47, 0.47), vec3(0.62, 0.57, 0.52), strata);
  rockFace = mix(rockFace, rockFace * 0.82, step(0.7, vnoise(vec2(p.x / 2.0, vWp.y / 6.0))));

  vec3 albedo = grass;
  float mDirt = step(0.5, vW.y / 255.0 * 0.0 + vW.y + nb);
  float mSand = step(0.5, vW.x + nb * 0.8);
  float mRock = step(0.5, vW.z + nb * 0.6);
  albedo = mix(albedo, dirt, mDirt);
  albedo = mix(albedo, sand, mSand);
  albedo = mix(albedo, rockTop, mRock * (1.0 - steep));
  albedo = mix(albedo, rockFace, max(steep, 0.0) * step(0.2, vW.z + steep));
  // non-rock steep banks show soil
  albedo = mix(albedo, dirt * 0.85, steep * (1.0 - step(0.2, vW.z + steep)));

  vec3 c = light(albedo, n, vWp, 0.6, 0.06);
  oColor = vec4(c, 1.0);
  oAux = vec4(n.xz * 0.5 + 0.5, 0.0 / 255.0, 1.0);
}`;

export const WATER_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 aInfo;
${LIGHT_UNIFORMS}
out vec3 vWp; out vec4 vInfo;
void main() {
  vWp = aPos; vInfo = aInfo;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const WATER_FS = `${HEADER}
${LIGHT_UNIFORMS}
${NOISE}
${LIGHT_FN}
in vec3 vWp; in vec4 vInfo;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  float depth = vInfo.x;
  if (depth < -0.5) discard;
  vec2 flow = vInfo.yz * (1.0 - vInfo.w);
  vec2 p = vWp.xz - flow * uTime * 14.0;
  float t = uTime;
  vec3 shallow = vec3(0.42, 0.78, 0.78);
  vec3 mid = vec3(0.2, 0.55, 0.7);
  vec3 deep = vec3(0.12, 0.3, 0.55);
  vec3 col = mix(shallow, mid, smoothstep(1.0, 7.0, depth));
  col = mix(col, deep, smoothstep(8.0, 30.0, depth));
  // caustic net on the shallows
  float ca = abs(vnoise(p / 7.0 + t * 0.15) - vnoise(p / 7.0 - t * 0.13 + 4.0));
  col += vec3(0.09, 0.11, 0.08) * smoothstep(0.06, 0.0, ca) * (1.0 - smoothstep(2.0, 8.0, depth));
  // wind ripples: short bright dashes
  float rip = vnoise(vec2(p.x / 6.0, p.y / 2.0) + vec2(t * 0.3, 0.0));
  col = mix(col, col * 1.18 + 0.05, step(0.78, rip));
  // sun glints
  float gl = vnoise(p / 1.7 + vec2(t * 0.9, -t * 0.6));
  col = mix(col, vec3(1.0, 0.98, 0.9), step(0.93, gl) * 0.9);
  // shore foam, pulsing with a slow swell
  float swell = 0.5 + 0.5 * sin(t * 1.3 + (vWp.x + vWp.z) * 0.02);
  float foamEdge = 0.5 + swell * 0.7 + (vnoise(p / 3.0 + t * 0.4) - 0.5) * 0.6;
  float foam = step(depth, foamEdge);
  float foam2 = step(abs(depth - foamEdge - 1.2 - swell), 0.25) * step(0.4, vnoise(p / 4.0 - t * 0.2));
  col = mix(col, vec3(0.95, 0.98, 1.0), max(foam, foam2 * 0.7));
  vec3 c = light(col, vec3(0.0, 1.0, 0.0), vWp, 0.6, 0.06);
  oColor = vec4(c, 1.0);
  oAux = vec4(0.5, 0.5, 4.0 / 255.0, 1.0);
}`;

export const SHADOW_VS = `${HEADER}
layout(location=0) in vec3 aPos;
uniform mat4 uLightViewProj;
uniform mat4 uModel;
void main() { gl_Position = uLightViewProj * uModel * vec4(aPos, 1.0); }`;

export const SHADOW_FS = `${HEADER}
out vec4 o;
void main() { o = vec4(1.0); }`;

export const FULLSCREEN_VS = `${HEADER}
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Outlines from depth and normals (t3ssel8r-style): a dark line on the near side of depth edges, a light
// line on convex creases. Material ids pick which surfaces get which line.
export const POST_FS = `${HEADER}
in vec2 vUv;
uniform sampler2D uColor;
uniform sampler2D uAux;
uniform highp sampler2D uDepth;
uniform vec2 uTexel;
uniform float uDepthRange;
uniform vec3 uGrade; // x: saturation, y: contrast, z: vignette
uniform vec3 uFogCol;
out vec4 o;
float D(vec2 uv) { return texture(uDepth, uv).r * uDepthRange; }
void main() {
  vec3 c = texture(uColor, vUv).rgb;
  vec4 aux = texture(uAux, vUv);
  int mat = int(aux.b * 255.0 + 0.5);
  float d = D(vUv);
  vec2 offs[4] = vec2[4](vec2(uTexel.x, 0.0), vec2(-uTexel.x, 0.0), vec2(0.0, uTexel.y), vec2(0.0, -uTexel.y));
  float dd = 0.0;
  float nd = 0.0;
  vec3 n = vec3(aux.r * 2.0 - 1.0, 0.0, aux.g * 2.0 - 1.0);
  for (int i = 0; i < 4; i++) {
    float dn = D(vUv + offs[i]);
    dd += max(0.0, dn - d);
    vec4 an = texture(uAux, vUv + offs[i]);
    int mn = int(an.b * 255.0 + 0.5);
    if (mn == mat && abs(dn - d) < 3.0) {
      vec2 nn = an.rg * 2.0 - 1.0;
      nd += max(0.0, dot(n.xz - nn, vec2(1.0, -1.0)));
    }
  }
  float thresh = mat == 0 ? 7.0 : (mat == 3 ? 2.5 : 4.0);
  if (mat != 1 && mat != 4 && mat != 6 && dd > thresh) {
    vec3 line = c * vec3(0.42, 0.38, 0.52);
    c = mix(c, line, mat == 0 ? 0.7 : 1.0);
  } else if ((mat == 2 || mat == 3) && nd > 0.35) {
    c = mix(c, c * 1.25 + 0.04, 0.8);
  }
  // grade: saturation, contrast
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uGrade.x);
  c = (c - 0.5) * uGrade.y + 0.5;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * uGrade.z;
  o = vec4(c, 1.0);
}`;

export const BLIT_FS = `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;   // texels
uniform vec2 uDstSize;   // device px
uniform vec2 uOffset;    // device px, sub-texel camera remainder
uniform float uScale;    // device px per texel
out vec4 o;
void main() {
  vec2 px = gl_FragCoord.xy + uOffset;
  vec2 border = (uDstSize - uSrcSize * uScale) * 0.5;
  vec2 t = (px - border) / uScale;
  o = texture(uSrc, (floor(t) + 0.5) / uSrcSize);
}`;
