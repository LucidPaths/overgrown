// Character shading (the "clay" direction): skinned, cel-lit with chosen shade colours, an occlusion-shifted
// terminator, a sky rim, painted faces with expressions, and ink outlines from a full-resolution post pass.
import { BONES } from "../rig/skeleton";

export const HDR = `#version 300 es
precision highp float;
precision highp int;
`;

/** Expression ids (Pose.expr). */
export const EXPR = { neutral: 0, angry: 1, hurt: 2, dead: 3, happy: 4, yell: 5, sleepy: 6 } as const;

export const CHAR_VS = `${HDR}
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aBoneIf;
layout(location=3) in vec4 aBoneW;
layout(location=4) in vec4 aMatIf;
layout(location=5) in vec4 aMatW;
uniform highp sampler2D uBoneTex; // ${BONES} bones x 4 columns per row, one row per character
uniform int uRow;
mat4 bone(uint b) {
  int x = int(b) * 4;
  return mat4(texelFetch(uBoneTex, ivec2(x, uRow), 0), texelFetch(uBoneTex, ivec2(x + 1, uRow), 0), texelFetch(uBoneTex, ivec2(x + 2, uRow), 0), texelFetch(uBoneTex, ivec2(x + 3, uRow), 0));
}
uniform mat4 uViewProj;
uniform vec3 uFeet;
uniform vec2 uTilt;
uniform float uLean;
uniform vec4 uMap;   // texel -> device px: scale, ox, oy
uniform vec4 uSize;  // G-buffer w, h; target w, h
uniform float uDepthBias;
uniform float uPixel;   // 1: drawing into the world's low-res G-buffer (no device mapping)
out vec3 vRest; out vec3 vN; out vec3 vWp; flat out uvec4 vMatI; out vec4 vMatW; out float vHead; out float vDbg;
void main() {
  uvec4 aBoneI = uvec4(aBoneIf + 0.5); uvec4 aMatI = uvec4(aMatIf + 0.5);
  mat4 m = (bone(aBoneI.x) * aBoneW.x + bone(aBoneI.y) * aBoneW.y + bone(aBoneI.z) * aBoneW.z + bone(aBoneI.w) * aBoneW.w) / dot(aBoneW, vec4(1.0));
  vec4 wp = m * vec4(aPos, 1.0);
  vN = normalize(mat3(m) * aNrm);
  vWp = wp.xyz; vRest = aPos; vMatI = aMatI; vMatW = aMatW;
  vHead = dot(vec4(equal(aBoneI, uvec4(4u))), aBoneW);
  // drawn tilted back toward the camera (faces show), lit and depth-tested upright
  vec3 rel = wp.xyz - uFeet;
  vec3 tilted = uFeet + vec3(rel.x, rel.y * uTilt.x + rel.z * uTilt.y, -rel.y * uTilt.y + rel.z * uTilt.x);
  vec4 up = uViewProj * wp;
  vec4 c = uViewProj * vec4(tilted, 1.0);
  c.y += uLean * max(0.0, rel.y);
  // the world blit's mapping, so characters land on the same device pixels as the ground under them
  if (uPixel < 0.5) {
    vec2 tex = (c.xy * 0.5 + 0.5) * uSize.xy;
    vec2 dev = tex * uMap.x + uMap.yz;
    c.xy = dev / uSize.zw * 2.0 - 1.0;
  }
  vDbg = uDepthBias < -1.5 ? 1.0 : 0.0;
  c.z = up.z - max(uDepthBias, 0.0);
  gl_Position = c;
}`;

export const CHAR_FS = `${HDR}
in vec3 vRest; in vec3 vN; in vec3 vWp; flat in uvec4 vMatI; in vec4 vMatW; in float vHead; in float vDbg;
uniform vec4 uLit[16];   // rgb lit albedo, a = kind (0 matte, 1 metal, 2 gloss, 3 glow)
uniform vec3 uShd[16];   // shade albedo
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uBounceCol; uniform vec3 uShadeTint;
uniform vec3 uView;      // toward the camera
uniform float uInShadow; // 0 sunlit .. 1 in a tree's shadow
uniform float uFlash;
uniform float uId;
uniform vec3 uHeadC;     // rest head centre
uniform vec4 uEye;       // x, y, half w, half h
uniform vec4 uEye2;      // tilt, slit, brow thickness, brow y
uniform vec4 uMouth;     // y, half w, -, -
uniform vec3 uIris;
uniform vec4 uFace;      // blink, expr, look x, look y
uniform vec4 uPL[8]; uniform vec3 uPLc[8];
uniform float uPixelMode;
uniform vec3 uKey;       // the characters' own key light direction (camera-relative, see char-layer)
uniform float uHatch;    // painterly mode: hatch the shade
layout(location=0) out vec4 oCol;
layout(location=1) out vec4 oAux;

const vec3 INK = vec3(0.10, 0.075, 0.12);

float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float aa(float d) { float w = fwidth(d) * 0.75 + 1e-4; return 1.0 - smoothstep(-w, w, d); }

// Face: eyes, brows, mouth painted in head space (projected along +z). Returns colour and coverage.
vec4 face(vec3 q, vec3 skin, out float paint) {
  paint = 0.0;
  vec4 o = vec4(0.0);
  if (q.z < 0.3) return o;
  int expr = int(uFace.y + 0.5);
  float blink = uFace.x;
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? 1.0 : -1.0;
    vec2 e = vec2((q.x - s * uEye.x) * s, q.y - uEye.y);      // mirrored: +x = outer corner
    float t = uEye2.x;
    e = vec2(e.x * cos(t) + e.y * sin(t), -e.x * sin(t) + e.y * cos(t));
    float d;
    vec3 col = INK;
    if (expr == ${EXPR.dead}) {
      // X X: the dark-humour register
      float r = uEye.w * 0.85;
      d = min(sdSeg(e, vec2(-r), vec2(r)), sdSeg(e, vec2(-r, r), vec2(r, -r))) - 0.24;
    } else if (expr == ${EXPR.hurt}) {
      // > < squeezed shut
      float r = uEye.w * 0.75;
      d = min(sdSeg(e, vec2(-r * 0.9, r), vec2(r * 0.7, 0.0)), sdSeg(e, vec2(r * 0.7, 0.0), vec2(-r * 0.9, -r))) - 0.22;
      d = s > 0.0 ? d : d;
    } else if (expr == ${EXPR.happy} || expr == ${EXPR.sleepy}) {
      // ^ ^ or -- closed arcs
      vec2 c = vec2(0.0, expr == ${EXPR.happy} ? -uEye.w * 0.55 : 0.0);
      float arc = abs(length((e - c) / vec2(1.0, expr == ${EXPR.happy} ? 1.0 : 0.25)) - uEye.z * 1.1) - 0.2;
      d = max(arc, -(e.y - c.y) + (expr == ${EXPR.happy} ? 0.05 : -1.0));
    } else {
      float open = clamp(1.0 - blink, 0.08, 1.0);
      vec2 r = vec2(uEye.z, uEye.w * open);
      d = (length(e / r) - 1.0) * min(r.x, r.y);
      // angry / yell: the upper lid cuts the eye on a slant (inner corner low)
      if (expr == ${EXPR.angry} || expr == ${EXPR.yell}) d = max(d, (e.y - (uEye.w * 0.35 + e.x * 0.55)) * 0.9);
      // iris and catchlight inside the dark eye
      vec2 look = uFace.zw * vec2(s, 1.0) * uEye.z * 0.35;
      float irisD = length((e - look) / r) - 0.62;
      if (uEye2.y > 0.5) irisD = max(irisD, -(abs(e.x - look.x) - uEye.z * 0.18) * 3.0) * 0.0 + irisD;
      if (irisD < 0.0 && dot(uIris, uIris) > 0.0) {
        col = mix(uIris, INK, smoothstep(-0.35, 0.0, irisD) * 0.6);
        float pup = uEye2.y > 0.5 ? abs(e.x - look.x) - uEye.z * 0.16 : length(e - look) - uEye.z * 0.34;
        col = mix(col, INK, aa(pup));
      }
      // catchlight: upper outer, fixed (the light is always over the viewer's shoulder)
      vec2 hl = vec2(-uEye.z * 0.28 * s, uEye.w * open * 0.38);
      float h = length(vec2(q.x - s * uEye.x, q.y - uEye.y) - hl - look * 0.5) - min(uEye.z, uEye.w) * 0.3;
      if (open > 0.5) col = mix(col, vec3(1.0, 0.98, 0.94), aa(h));
    }
    float a = aa(d);
    o.rgb = mix(o.rgb, col, a);
    o.a = max(o.a, a);
    // brows
    if (uEye2.z > 0.0 && expr != ${EXPR.dead}) {
      float tilt = expr == ${EXPR.angry} || expr == ${EXPR.yell} ? -0.5 : expr == ${EXPR.hurt} ? 0.45 : (expr == ${EXPR.happy} ? 0.1 : 0.0);
      vec2 b0 = vec2(-uEye.z * 1.1, uEye2.w + tilt * uEye.z * 0.9 * -1.0);
      vec2 b1 = vec2(uEye.z * 1.25, uEye2.w + 0.15);
      if (tilt < 0.0) { b0.y = uEye2.w - 0.55; }
      float bd = sdSeg(vec2((q.x - s * uEye.x) * s, q.y - uEye.y), b0, b1) - uEye2.z;
      float ba = aa(bd);
      o.rgb = mix(o.rgb, mix(INK, skin * 0.35, 0.25), ba);
      o.a = max(o.a, ba);
    }
  }
  // mouth
  if (uMouth.y > 0.0) {
    vec2 m = vec2(q.x, q.y - uMouth.x);
    float d;
    vec3 col = INK;
    if (expr == ${EXPR.yell} || expr == ${EXPR.hurt}) {
      vec2 r = vec2(uMouth.y * 0.75, uMouth.y * (expr == ${EXPR.yell} ? 0.75 : 0.45));
      d = (length(m / r) - 1.0) * min(r.x, r.y);
      col = mix(vec3(0.55, 0.16, 0.2), INK, smoothstep(-0.25, 0.0, m.y + r.y * 0.2));
    } else if (expr == ${EXPR.dead}) {
      d = abs(m.y + 0.1 * sin(m.x * 6.0)) - 0.13;
      d = max(d, abs(m.x) - uMouth.y);
    } else {
      // a small smile (a curve, not a line)
      float curve = expr == ${EXPR.angry} ? 0.35 : -0.3;
      d = abs(m.y - curve * (1.0 - (m.x * m.x) / (uMouth.y * uMouth.y))) - 0.13;
      d = max(d, abs(m.x) - uMouth.y);
    }
    float a = aa(d);
    o.rgb = mix(o.rgb, col, a);
    o.a = max(o.a, a);
  }
  paint = o.a;
  return o;
}

void main() {
  if (vDbg > 0.5) { oCol = vec4(1.0, 0.0, 1.0, 1.0); oAux = vec4(0.5, 0.5, uId, 1.0); return; }
  // material: the largest interpolated weight wins, per pixel
  vec3 w = vMatW.xyz;
  int mi = int(w.x >= w.y && w.x >= w.z ? vMatI.x : (w.y >= w.z ? vMatI.y : vMatI.z));
  vec4 L = uLit[mi];
  vec3 S = uShd[mi];
  float kind = L.a;
  vec3 n = normalize(vN);
  float ao = vMatW.w;
  // terminator: one crisp step, pushed toward the light where the form is occluded (armpits, under the chin)
  float ndl = dot(n, uKey);
  float th = mix(0.22, -0.05, smoothstep(0.25, 0.85, ao));
  float fw = fwidth(ndl) + 0.02;
  float lit = smoothstep(th - fw, th + fw, ndl) * (1.0 - uInShadow * 0.85);
  vec3 amb = mix(uBounceCol, uSkyCol, n.y * 0.5 + 0.5);
  vec3 shade = S * (amb * 1.0 + uSunCol * 0.16) * uShadeTint;
  // the lit side keeps a little form: brightest where it faces the key, a touch darker toward the terminator
  float form = mix(0.86, 1.04, smoothstep(th, 0.9, ndl));
  vec3 litc = L.rgb * (uSunCol * 0.8 + amb * 0.3) * form;
  vec3 c = mix(shade, litc, lit);
  // soft materials (skin, fur: kind 0 with warm shade) glow a little warmer right at the terminator
  float band = smoothstep(th - 0.28, th, ndl) * (1.0 - lit);
  c += (kind < 0.5 ? 1.0 : 0.0) * band * L.rgb * vec3(0.16, 0.05, 0.0);
  // occlusion darkens the deepest creases a little more, on both sides
  c *= mix(0.7, 1.0, smoothstep(0.0, 0.55, ao));
  // rim: a thin cool sky line on the edge turned away from the viewer, readable against any ground
  float nv = dot(n, uView);
  float rim = smoothstep(0.3, 0.1, nv) * smoothstep(-0.2, 0.4, n.y);
  c += uSkyCol * rim * 0.26 * (1.0 - lit * 0.5);
  vec3 hv = normalize(uKey + uView);
  float nh = dot(n, hv);
  if (kind > 0.5 && kind < 1.5) {
    // metal: a hard sky band and a sun glint
    c = mix(c, uSunCol * 1.1, step(0.93, nh) * lit);
    c += L.rgb * 0.25 * smoothstep(0.1, 0.4, n.y);
  } else if (kind > 1.5 && kind < 2.5) {
    c = mix(c, vec3(1.0), step(0.96, nh) * 0.8 * lit);
  } else if (kind > 2.5 && kind < 3.5) {
    c = L.rgb;
  } else if (kind > 3.5) {
    // sheen (hair, glossy fur, feathers): a broad lit shape, lighter and warmer, on the crown of every lock
    float sh = smoothstep(0.78, 0.8, nh) * lit;
    c = mix(c, min(vec3(1.0), L.rgb * 1.55 + vec3(0.08, 0.06, 0.03)), sh * 0.75);
  }
  // point lights (lanterns): soft pools on the figure
  for (int i = 0; i < 8; i++) {
    vec4 P = uPL[i];
    if (P.w <= 0.0) continue;
    vec3 dv = P.xyz - vWp;
    float k = 1.0 - length(dv) / P.w;
    if (k <= 0.0) continue;
    c += L.rgb * uPLc[i] * smoothstep(0.0, 0.5, k) * (0.4 + 0.6 * max(0.0, dot(n, normalize(dv))));
  }
  // face
  if (vHead > 0.5 && (mi == 0 || mi == 1)) {
    float paint;
    vec4 f = face(vRest - uHeadC, L.rgb, paint);
    vec3 fc = f.rgb * mix(0.75, 1.0, lit);
    if (f.rgb == vec3(1.0, 0.98, 0.94)) fc = f.rgb;
    c = mix(c, fc, f.a);
  }
  if (uHatch > 0.5) {
    // painterly: diagonal hatching in the shade, a drier terminator
    vec2 sp = gl_FragCoord.xy;
    float hatch = step(0.62, fract((sp.x + sp.y) / 5.0));
    float hatch2 = step(0.7, fract((sp.x - sp.y) / 4.0));
    float dark = 1.0 - lit;
    c = mix(c, c * 0.72, hatch * dark * 0.9 + hatch2 * dark * smoothstep(0.5, 0.0, ao) * 0.8);
  }
  c = mix(c, vec3(1.0, 0.98, 0.94), uFlash);
  oCol = vec4(c, 1.0);
  oAux = uPixelMode > 0.5 ? vec4(n.xz * 0.5 + 0.5, 3.0 / 255.0, 1.0) : vec4(n.xy * 0.5 + 0.5, uId, 1.0);
}`;

export const CHAR_SHADOW_VS = `${HDR}
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 aBoneIf;
layout(location=3) in vec4 aBoneW;
uniform highp sampler2D uBoneTex;
uniform int uRow;
mat4 bone(uint b) {
  int x = int(b) * 4;
  return mat4(texelFetch(uBoneTex, ivec2(x, uRow), 0), texelFetch(uBoneTex, ivec2(x + 1, uRow), 0), texelFetch(uBoneTex, ivec2(x + 2, uRow), 0), texelFetch(uBoneTex, ivec2(x + 3, uRow), 0));
}
uniform mat4 uLightViewProj;
void main() {
  uvec4 aBoneI = uvec4(aBoneIf + 0.5);
  mat4 m = (bone(aBoneI.x) * aBoneW.x + bone(aBoneI.y) * aBoneW.y + bone(aBoneI.z) * aBoneW.z + bone(aBoneI.w) * aBoneW.w) / dot(aBoneW, vec4(1.0));
  gl_Position = uLightViewProj * m * vec4(aPos, 1.0);
}`;

export const FULL_VS = `${HDR}
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Fills the full-res depth with the world's (low-res) depth, texel for texel as the blit placed it. */
export const DEPTH_FILL_FS = `${HDR}
uniform highp sampler2D uDepth;
uniform vec4 uMap;
uniform vec2 uSrc;
out vec4 o;
void main() {
  vec2 t = floor((gl_FragCoord.xy - uMap.yz) / uMap.x);
  t = clamp(t, vec2(0.0), uSrc - 1.0);
  gl_FragDepth = texelFetch(uDepth, ivec2(t), 0).r;
  o = vec4(0.0);
}`;

/**
 * Ink: a line where a character meets the world (drawn outside the silhouette, so it antialiases the edge) and
 * where one part passes in front of another (a depth step). The line colour is the nearer surface's colour,
 * darkened and cooled (the world's outline rule), so a red tunic gets a deep wine line, not a black one.
 */
export const INK_FS = `${HDR}
uniform sampler2D uCol;
uniform sampler2D uAux;
uniform highp sampler2D uDepth;
uniform float uW;        // line radius, device px
uniform float uRange;    // depth range of the projection, world px
uniform float uStep;     // depth step that makes an inner line, world px
uniform vec3 uInk;       // line colour multiplier
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 aux = texelFetch(uAux, p, 0);
  float cov = aux.a;
  float d = texelFetch(uDepth, p, 0).r * uRange;
  vec3 base = texelFetch(uCol, p, 0).rgb;
  float edge = 0.0;
  vec3 lc = vec3(0.0);
  int R = int(ceil(uW));
  for (int dy = -3; dy <= 3; dy++) {
    for (int dx = -3; dx <= 3; dx++) {
      if (abs(dx) > R || abs(dy) > R) continue;
      float r = length(vec2(dx, dy));
      float cover = clamp(uW + 0.5 - r, 0.0, 1.0);
      if (cover <= edge) continue;
      ivec2 q = p + ivec2(dx, dy);
      vec4 a2 = texelFetch(uAux, q, 0);
      if (a2.a < 0.5) continue;
      float d2 = texelFetch(uDepth, q, 0).r * uRange;
      bool isEdge = cov < 0.5 ? d2 < d + 0.5 : (d - d2 > uStep || abs(a2.b - aux.b) > 0.001 && d - d2 > 0.0);
      if (isEdge) { edge = cover; lc = texelFetch(uCol, q, 0).rgb; }
    }
  }
  vec3 ink = lc * uInk;
  if (cov > 0.5) o = vec4(mix(base, ink, edge), 1.0);
  else o = vec4(ink * edge, edge);
}`;
