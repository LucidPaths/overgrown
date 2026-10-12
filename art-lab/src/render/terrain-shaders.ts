import { HEADER, LIGHT_FN, LIGHT_UNIFORMS, NOISE } from "./glsl";
import { GROUND } from "./ground-glsl";

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
${GROUND}
in vec3 vWp; in vec3 vN; in vec4 vTint; in vec4 vW;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
  if (fn.y < 0.0) fn = -fn;
  vec3 n = normalize(vN);
  float steep = smoothstep(0.72, 0.5, fn.y);
  n = normalize(mix(n, fn, steep));
  vec2 p = vWp.xz;
  vec2 cell = floor(p);
  float dth = bayer(cell);                       // world-anchored ordered dither: boundaries break into pixel steps
  float nb = (fbm2(p / 13.0) - 0.5) * 0.7 + (vnoise(p / 3.5) - 0.5) * 0.22;
  float elev = vTint.a;

  vec3 albedo = grassAt(p, cell, vTint.rgb, vW.w, dth);
  float mDirt = step(0.5, vW.y + nb + (dth - 0.5) * 0.25);
  float mSand = step(0.5, vW.x + nb * 0.8 + (dth - 0.5) * 0.2);
  float mRock = step(0.5, vW.z + nb * 0.6 + (dth - 0.5) * 0.25);
  albedo = mix(albedo, dirtAt(p, cell, dth), mDirt);
  albedo = mix(albedo, sandAt(p, cell, dth), mSand);
  albedo = mix(albedo, rockAt(p, cell, elev, dth), mRock * (1.0 - steep));
  float face = max(steep, 0.0);
  albedo = mix(albedo, rockFaceAt(vWp, cell), face * step(0.2, vW.z + steep));
  // non-rock steep banks show soil
  albedo = mix(albedo, dirtAt(p, cell, dth) * 0.82, face * (1.0 - step(0.2, vW.z + steep)));
  // snow on high ground: flat tops first, faces stay rock
  float snow = smoothstep(0.715, 0.76, elev + (fbm2(p / 24.0) - 0.5) * 0.05 + (dth - 0.5) * 0.012) * (1.0 - steep * 0.85);
  albedo = mix(albedo, snowAt(p, cell), snow);

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
${GROUND}
in vec3 vWp; in vec4 vInfo;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  float depth = vInfo.x;
  if (depth < -0.5) discard;
  float ocean = vInfo.w;
  vec2 flow = vInfo.yz * (1.0 - ocean);
  float t = uTime;
  vec2 p = vWp.xz;
  vec2 cell = floor(p);
  float dth = bayer(cell);
  // depth bands: four flat tones, the steps between them broken by the ordered dither
  float dq = depth + (fbm2(p / 30.0 + t * 0.03) - 0.5) * 2.0 + (dth - 0.5) * 0.9;
  vec3 c0 = vec3(0.47, 0.8, 0.78), c1 = vec3(0.27, 0.62, 0.72), c2 = vec3(0.16, 0.44, 0.64), c3 = vec3(0.11, 0.3, 0.52);
  vec3 col = dq < 2.5 ? c0 : dq < 7.0 ? c1 : dq < 16.0 ? c2 : c3;
  // the bed shows through the shallows: sand ripples, darker where it is deeper
  if (depth < 4.0) col = mix(col, col * vec3(1.08, 1.04, 0.9), step(0.6, sin(p.x * 0.3 + p.y * 0.5 + vnoise(p / 8.0) * 4.0)) * 0.6);
  // surface: few, long, horizontal highlights that drift (a calm sea), flow streaks on rivers
  vec2 q = p - flow * t * 16.0 + vec2(t * 3.0 * ocean, 0.0);
  float sw = vnoise(vec2(q.x / 22.0, q.y / 3.2) + vec2(0.0, t * 0.12));
  float crest = step(0.8, sw) * step(0.5, vnoise(q / 9.0 + t * 0.05)) * step(1.5, depth);
  col = mix(col, mix(col, vec3(0.86, 0.95, 0.98), 0.55), crest);
  float trough = step(sw, 0.16) * step(5.0, depth);
  col = mix(col, col * 0.88, trough);
  // sun glints: sparse single texels, twinkling
  float gl = hash12(cell + floor(t * 3.0) * 13.1);
  col = mix(col, vec3(1.0, 0.98, 0.9), step(0.9975, gl) * step(2.0, depth));
  // shore: a solid foam rim that breathes with the swell, then a broken second line further out
  float swell = 0.5 + 0.5 * sin(t * (ocean > 0.5 ? 1.1 : 2.0) + (p.x * 0.7 + p.y) * 0.03);
  float rim = 0.6 + swell * (ocean > 0.5 ? 1.1 : 0.5) + (vnoise(p / 3.0 + t * 0.4) - 0.5) * 0.7;
  float foam = step(depth, rim);
  float line2 = step(abs(depth - rim - 1.2 - swell * 1.2), 0.14) * step(0.5, vnoise(p / 5.0 - t * 0.2)) * step(depth, 5.0);
  col = mix(col, vec3(0.94, 0.98, 1.0), max(foam, line2 * 0.85));
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
