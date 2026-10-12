// Ground materials, one function each, all in world px (p = world xz, cell = floor(p) = one texel at 1x).
// Pixel-art rules: few tones per material (3-4), hard edges, ordered dither only at boundaries, marks 1-2 px wide.
export const GROUND = `
float bayer(vec2 c) {
  ivec2 q = ivec2(mod(c, 4.0));
  int i = q.y * 4 + q.x;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(b[i]) + 0.5) / 16.0;
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// x: distance to the nearest site, y: gap to the second (border = small), z: cell id
vec3 voronoi(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + hash22(n + g) * 0.85 + 0.075 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash12(n + g); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}

vec3 grassAt(vec2 p, vec2 cell, vec3 base, float forest, float dth) {
  // three tones: shade, base, light; clumps decide, the dither feathers their edges
  float clump = vnoise(p / 10.0) * 0.6 + vnoise(p / 4.3 + 9.0) * 0.4;
  float macro = fbm2(p / 70.0) - 0.5;
  vec3 g = base * (1.0 + macro * 0.12);
  vec3 shadeT = g * vec3(0.86, 0.9, 0.95);
  vec3 lightT = g * vec3(1.07, 1.06, 0.94) + vec3(0.02, 0.02, 0.0);
  vec3 c = clump + (dth - 0.5) * 0.08 < 0.42 ? shadeT : (clump + (dth - 0.5) * 0.08 > 0.6 ? lightT : g);
  // blades: sparse 1x2 strokes, dark on light clumps and light on dark ones
  vec2 bc = floor(vec2(p.x / 3.0, p.y / 4.0));
  float h = hash12(bc + 41.0);
  vec2 lp = vec2(p.x - bc.x * 3.0, p.y - bc.y * 4.0);
  vec2 at = floor(hash22(bc) * vec2(3.0, 2.0));
  bool blade = h < 0.22 && floor(lp.x) == at.x && (floor(lp.y) == at.y || floor(lp.y) == at.y + 1.0);
  if (blade) c = clump > 0.5 ? g * vec3(0.8, 0.86, 0.9) : lightT * 1.04;
  // the forest floor: darker and cooler, with leaf litter specks
  vec3 floorC = mix(c * vec3(0.72, 0.8, 0.84), vec3(0.32, 0.27, 0.18), 0.16);
  float litter = step(0.86, hash12(cell * 0.5 + 3.0)) * step(0.45, vnoise(p / 6.0));
  floorC = mix(floorC, vec3(0.6, 0.42, 0.22), litter * 0.45);
  return mix(c, floorC, smoothstep(0.35, 0.75, forest + (dth - 0.5) * 0.15));
}

vec3 dirtAt(vec2 p, vec2 cell, float dth) {
  vec3 a = vec3(0.47, 0.38, 0.3), b = vec3(0.55, 0.45, 0.35), l = vec3(0.62, 0.52, 0.41);
  float t = vnoise(p / 5.0) * 0.7 + vnoise(p / 2.0) * 0.3;
  vec3 c = t + (dth - 0.5) * 0.12 < 0.42 ? a : (t > 0.66 ? l : b);
  // pebbles: a light pixel with a dark one under it
  vec2 pc = floor(p / 5.0);
  vec2 pp = pc * 5.0 + floor(hash22(pc + 7.0) * 4.0);
  float peb = step(hash12(pc + 2.0), 0.3);
  if (peb > 0.5 && cell == pp) c = vec3(0.72, 0.68, 0.62);
  if (peb > 0.5 && cell == pp + vec2(0.0, 1.0)) c = a * 0.8;
  return c;
}

vec3 sandAt(vec2 p, vec2 cell, float dth) {
  vec3 a = vec3(0.86, 0.77, 0.58), b = vec3(0.93, 0.85, 0.65), l = vec3(0.97, 0.92, 0.76);
  // wind ripples: long soft bands, broken by noise
  float r = sin(p.x * 0.16 + p.y * 0.42 + vnoise(p / 14.0) * 6.0);
  float patchy = step(0.45, vnoise(p / 20.0 + 7.0));
  vec3 c = r > 0.9 && patchy > 0.5 ? a : (vnoise(p / 7.0) + (dth - 0.5) * 0.1 > 0.62 ? l : b);
  if (hash12(cell + 11.0) > 0.985) c = a * 0.9;
  return c;
}

vec3 rockAt(vec2 p, vec2 cell, float elev, float dth) {
  // big weathered slabs: a calm field of three greys, a few long seams, gravel in the hollows
  float m = fbm2(p / 46.0) * 0.7 + vnoise(p / 13.0) * 0.3;
  vec3 dark = vec3(0.5, 0.49, 0.5), mid = vec3(0.6, 0.58, 0.56), lit = vec3(0.68, 0.66, 0.62);
  vec3 c = m + (dth - 0.5) * 0.06 < 0.43 ? dark : (m + (dth - 0.5) * 0.06 > 0.6 ? lit : mid);
  vec3 v = voronoi(p / 26.0);
  float seam = step(v.y, 0.035) * step(0.5, vnoise(p / 17.0 + 3.0));
  c = mix(c, vec3(0.36, 0.35, 0.39), seam);
  if (v.y < 0.075 && v.y >= 0.035 && seam < 0.5 && step(0.5, vnoise(p / 17.0 + 3.0)) > 0.5) c *= 1.07; // the lit lip
  // gravel: speckles where the slab field is low
  float grav = step(m, 0.4) * step(0.6, hash12(cell + 23.0));
  c = mix(c, hash12(cell + 29.0) > 0.5 ? dark * 0.85 : lit, grav * 0.7);
  // alpine grass in damp hollows, thinning out with height
  float moss = step(0.66, vnoise(p / 19.0 + 5.0) + (dth - 0.5) * 0.1) * (1.0 - smoothstep(0.66, 0.72, elev));
  c = mix(c, vec3(0.52, 0.6, 0.36) * (0.92 + hash12(cell) * 0.12), moss);
  return c;
}

vec3 rockFaceAt(vec3 wp, vec2 cell) {
  // cool grey faces: faint strata, sparse dark fissures, a lighter band near the top of each ledge
  float u = wp.x + wp.z;
  float y = wp.y + vnoise(vec2(u, 0.0) / 11.0) * 4.0;
  float band = floor(y / 7.0);
  float t = hash12(vec2(band, 3.0));
  vec3 c = mix(vec3(0.47, 0.47, 0.5), vec3(0.55, 0.54, 0.55), t);
  if (fract(y / 7.0) < 0.14) c *= 0.88;
  float fis = step(0.8, vnoise(vec2(u / 3.0, wp.y / 9.0)));
  c = mix(c, vec3(0.33, 0.32, 0.37), fis * 0.8);
  return c;
}

vec3 snowAt(vec2 p, vec2 cell) {
  float t = vnoise(p / 6.0);
  vec3 c = t > 0.62 ? vec3(0.97, 0.98, 1.0) : vec3(0.9, 0.92, 0.98);
  if (hash12(cell + 5.0) > 0.992) c = vec3(1.0);
  return c;
}
`;
