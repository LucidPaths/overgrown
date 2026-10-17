// Minimal column-major 4x4 matrix and vector helpers (WebGL convention).
export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function mat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mul(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return out;
}

export function ortho(l: number, r: number, b: number, t: number, n: number, f: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  m[15] = 1;
  return m;
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function norm(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** View matrix from an orthonormal camera basis (right, up, back = -forward) and eye position. */
export function viewFromBasis(right: Vec3, up: Vec3, back: Vec3, eye: Vec3): Mat4 {
  const m = new Float32Array(16);
  m[0] = right[0]; m[4] = right[1]; m[8] = right[2];
  m[1] = up[0]; m[5] = up[1]; m[9] = up[2];
  m[2] = back[0]; m[6] = back[1]; m[10] = back[2];
  m[12] = -dot(right, eye);
  m[13] = -dot(up, eye);
  m[14] = -dot(back, eye);
  m[15] = 1;
  return m;
}

export function lookBasis(forward: Vec3, worldUp: Vec3 = [0, 1, 0]): { right: Vec3; up: Vec3; back: Vec3 } {
  const f = norm(forward);
  const right = norm(cross(f, worldUp));
  const up = cross(right, f);
  return { right, up, back: [-f[0], -f[1], -f[2]] };
}

/** Rigid transform: rotation about Y (yaw), then X (pitch), then Z (roll), scale, translation. */
export function compose(tx: number, ty: number, tz: number, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = 1, sz = 1): Mat4 {
  const cy = Math.cos(yaw), syw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry * Rx * Rz
  const r00 = cy * cr + syw * sp * sr, r01 = -cy * sr + syw * sp * cr, r02 = syw * cp;
  const r10 = cp * sr, r11 = cp * cr, r12 = -sp;
  const r20 = -syw * cr + cy * sp * sr, r21 = syw * sr + cy * sp * cr, r22 = cy * cp;
  const m = new Float32Array(16);
  m[0] = r00 * sx; m[1] = r10 * sx; m[2] = r20 * sx;
  m[4] = r01 * sy; m[5] = r11 * sy; m[6] = r21 * sy;
  m[8] = r02 * sz; m[9] = r12 * sz; m[10] = r22 * sz;
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
  return m;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
