// Characters: rigid-bone meshes posed on the CPU (13 matrices per character), drawn into the same G-buffer as the
// world with the same light. Three extras keep a fight readable: a dithered silhouette where a character is hidden
// behind trees or cliffs, a white hit flash, and a slash ribbon traced by the real blade.
import { type Pose, newPose, attack, clearPose } from "../actors/anim";
import { BONE, BONES, PARENT, buildRig, type Rig, type Weapon } from "../actors/rig";
import { MAT } from "../geo/builder";
import { deleteMesh, drawMesh, mesh, program, type GL, type Mesh, type Program } from "../gl/glu";
import { HEADER, LIGHT_FN, LIGHT_UNIFORMS, NOISE } from "./glsl";
import type { Drawable, FrameInfo } from "./renderer";
import { LOC, SHADOW_FS } from "./terrain-shaders";

const SKIN_VS = `
uniform mat4 uBones[${BONES}];
mat4 boneOf(vec4 aux) { return uBones[int(aux.y * 255.0 + 0.5)]; }
`;

const ACTOR_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aAux;
${LIGHT_UNIFORMS}
${SKIN_VS}
uniform float uDepthBias;
uniform vec3 uFeet;
uniform vec2 uTilt; // cos, sin of the tilt toward the camera
out vec3 vWp; out vec3 vN; out vec4 vCol;
void main() {
  mat4 m = boneOf(aAux);
  vec4 wp = m * vec4(aPos, 1.0);
  vWp = wp.xyz; vN = mat3(m) * aNrm; vCol = aCol;
  // drawn tilted back toward the camera (faces show), lit and depth-tested upright (light and occlusion stay true)
  vec3 rel = wp.xyz - uFeet;
  vec3 tilted = uFeet + vec3(rel.x, rel.y * uTilt.x + rel.z * uTilt.y, -rel.y * uTilt.y + rel.z * uTilt.x);
  vec4 up = uViewProj * wp;
  gl_Position = uViewProj * vec4(tilted, 1.0);
  gl_Position.y += uLean * max(0.0, rel.y);
  gl_Position.z = up.z - uDepthBias;
}`;

const ACTOR_FS = `${HEADER}
${LIGHT_UNIFORMS}
${NOISE}
${LIGHT_FN}
in vec3 vWp; in vec3 vN; in vec4 vCol;
uniform float uFlash;
uniform vec3 uRim;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  vec3 n = normalize(vN);
  vec3 c = light(vCol.rgb, n, vWp, 0.8, 0.05);
  // a thin cool rim on the side away from the sun keeps characters off busy ground
  float rim = smoothstep(0.55, 0.75, 1.0 - abs(n.y)) * step(dot(n, uSunDir), -0.1);
  c += uRim * rim * 0.25;
  c = mix(c, vec3(1.0, 0.98, 0.94), uFlash);
  oColor = vec4(c, 1.0);
  oAux = vec4(n.xz * 0.5 + 0.5, vCol.a, 1.0);
}`;

// Hidden parts: a 50% dither of a flat team colour, so a character behind a tree is still there, still readable.
const SIL_FS = `${HEADER}
uniform vec3 uSil;
in vec3 vWp; in vec3 vN; in vec4 vCol;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (((p.x + p.y) & 1) == 0) discard;
  // two tones from a fixed key light, so the hidden figure keeps its form (head, arms) instead of a blob
  float k = step(0.2, dot(normalize(vN), normalize(vec3(-0.3, 0.8, 0.5))));
  oColor = vec4(uSil * (0.72 + 0.4 * k), 1.0);
  oAux = vec4(0.5, 0.5, ${MAT.Fx}.0 / 255.0, 1.0);
}`;

const ACTOR_SHADOW_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 aAux;
uniform mat4 uLightViewProj;
${SKIN_VS}
void main() { gl_Position = uLightViewProj * boneOf(aAux) * vec4(aPos, 1.0); }`;

// Slash ribbon: unlit, hot white core to a warm edge, eaten from the tail by an ordered dither.
const TRAIL_VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=3) in vec3 aUv;
uniform mat4 uViewProj;
uniform float uLean;
out vec2 vUv;
void main() {
  vUv = aUv.xy;
  gl_Position = uViewProj * vec4(aPos, 1.0);
  gl_Position.y += uLean * aUv.z;
  gl_Position.z -= 0.002;
}`;
const TRAIL_FS = `${HEADER}
in vec2 vUv;
uniform vec3 uCore;
uniform vec3 uEdge;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) & 3;
  float th = (BAYER[p.y * 4 + p.x] + 0.5) / 16.0;
  // vUv.x: 0 = oldest, 1 = the blade now; vUv.y: 0 = hilt side, 1 = tip
  float keep = vUv.x * (0.35 + vUv.y * 0.9);
  if (keep < th) discard;
  vec3 c = mix(uEdge, uCore, smoothstep(0.55, 0.95, vUv.x) * smoothstep(0.25, 0.8, vUv.y));
  oColor = vec4(c, 1.0);
  oAux = vec4(0.5, 0.5, ${MAT.Fx}.0 / 255.0, 1.0);
}`;

export interface ActorLook {
  species: number;
  dye: number;
  weapon: Weapon;
  trousers: number;
}

export interface ActorDraw {
  look: ActorLook;
  /** feet point in world px (x, ground height, z) */
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: Pose;
  /** silhouette colour when hidden (team/local-player colour) */
  sil: [number, number, number];
  /** attack progress for the slash trail (re-evaluates the clip backwards); <0 = none */
  attackU: number;
}

interface RigMesh {
  rig: Rig;
  mesh: Mesh;
}

const TRAIL_SAMPLES = 10;
/** Characters tilt back toward the camera by this much (on top of the world's lean): see ACTOR_VS. */
export const TILT = (18 * Math.PI) / 180;
const TILT_C = Math.cos(TILT), TILT_S = Math.sin(TILT);
function tilt(p: number[], fx: number, fy: number, fz: number): number[] {
  const ry = p[1]! - fy, rz = p[2]! - fz;
  return [p[0]!, fy + ry * TILT_C + rz * TILT_S, fz - ry * TILT_S + rz * TILT_C];
}

export class ActorLayer implements Drawable {
  private p: Program;
  private sp: Program;
  private silP: Program;
  private trailP: Program;
  private rigs = new Map<string, RigMesh>();
  readonly list: ActorDraw[] = [];
  private mats: Float32Array<ArrayBuffer>[] = [];
  private trailMesh?: Mesh;
  private tmp = newPose();

  constructor(private gl: GL) {
    this.p = program(gl, "actor", ACTOR_VS, ACTOR_FS);
    this.sp = program(gl, "actor-shadow", ACTOR_SHADOW_VS, SHADOW_FS);
    this.silP = program(gl, "actor-sil", ACTOR_VS, SIL_FS);
    this.trailP = program(gl, "trail", TRAIL_VS, TRAIL_FS);
  }

  rigFor(look: ActorLook): RigMesh {
    const key = `${look.species}:${look.dye}:${look.weapon}:${look.trousers}`;
    let r = this.rigs.get(key);
    if (r) return r;
    const rig = buildRig(look.species, look.dye, look.weapon, look.trousers);
    const g = rig.geo, gl = this.gl;
    const m = mesh(gl, [
      { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(g.pos) },
      { loc: LOC.nrm, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(g.nrm) },
      { loc: LOC.col, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(g.col) },
      { loc: LOC.aux, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(g.aux) },
    ], g.vertexCount);
    r = { rig, mesh: m };
    this.rigs.set(key, r);
    return r;
  }

  /** Bone world matrices for one character (column-major, BONES * 16 floats). */
  bones(rig: Rig, d: { x: number; y: number; z: number; yaw: number }, pose: Pose, out: Float32Array<ArrayBuffer> = new Float32Array(BONES * 16)): Float32Array<ArrayBuffer> {
    // root: T(feet) * Ry(yaw) * T(off) * T(0,pivot,0) * Rx(rootPitch) * Rz(rootRoll) * T(0,-pivot,0)
    let m = trs(d.x, d.y, d.z, 0, d.yaw + pose.yaw, 0);
    m = mul4(m, trs(pose.off[0], pose.off[1] + pose.pivotY, pose.off[2], pose.rootPitch, 0, pose.rootRoll));
    m = mul4(m, trs(0, -pose.pivotY, 0, 0, 0, 0));
    out.set(m, 0);
    for (let b = 1; b < BONES; b++) {
      const par = PARENT[b]!;
      const r = rig.rest[b]!;
      const local = trs(r[0], r[1], r[2], pose.rot[b * 3]!, pose.rot[b * 3 + 1]!, pose.rot[b * 3 + 2]!);
      out.set(mul4(out.subarray(par * 16, par * 16 + 16), local), b * 16);
    }
    return out;
  }

  private prepare(): void {
    while (this.mats.length < this.list.length) this.mats.push(new Float32Array(BONES * 16));
    this.list.forEach((d, i) => this.bones(this.rigFor(d.look).rig, d, d.pose, this.mats[i]));
  }

  shadow(gl: GL, f: FrameInfo): void {
    this.prepare();
    gl.useProgram(this.sp.prog);
    gl.uniformMatrix4fv(this.sp.u.uLightViewProj!, false, f.lightViewProj);
    gl.disable(gl.CULL_FACE);
    this.list.forEach((d, i) => {
      gl.uniformMatrix4fv(this.sp.u.uBones!, false, this.mats[i]!);
      drawMesh(gl, this.rigFor(d.look).mesh);
    });
    gl.enable(gl.CULL_FACE);
  }

  main(gl: GL, f: FrameInfo): void {
    if (this.list.length === 0) return;
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.p.prog);
    f.setLight(this.p);
    gl.uniform1f(this.p.u.uDepthBias!, 0);
    gl.uniform3f(this.p.u.uRim!, 0.75, 0.85, 1.0);
    // stencil 1 = an actor is the visible surface here; the silhouette pass skips those pixels (no self-x-ray)
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    this.list.forEach((d, i) => {
      gl.uniformMatrix4fv(this.p.u.uBones!, false, this.mats[i]!);
      gl.uniform1f(this.p.u.uFlash!, d.pose.flash);
      gl.uniform3f(this.p.u.uFeet!, d.x, d.y, d.z);
      gl.uniform2f(this.p.u.uTilt!, TILT_C, TILT_S);
      drawMesh(gl, this.rigFor(d.look).mesh);
    });
    gl.disable(gl.STENCIL_TEST);
    this.drawTrails(gl, f);
    gl.enable(gl.CULL_FACE);
  }

  /** After everything opaque: the hidden parts of each character, dithered. */
  overlay(gl: GL, f: FrameInfo): void {
    if (this.list.length === 0) return;
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.silP.prog);
    gl.uniformMatrix4fv(this.silP.u.uViewProj!, false, f.viewProj);
    gl.uniform1f(this.silP.u.uDepthBias!, 0.0065);
    gl.uniform1f(this.silP.u.uLean!, f.lean); // ~6 px toward the camera: feet in grass don't count as hidden
    gl.depthFunc(gl.GREATER);
    gl.depthMask(false);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.list.forEach((d, i) => {
      gl.uniformMatrix4fv(this.silP.u.uBones!, false, this.mats[i]!);
      gl.uniform3fv(this.silP.u.uSil!, d.sil);
      gl.uniform3f(this.silP.u.uFeet!, d.x, d.y, d.z);
      gl.uniform2f(this.silP.u.uTilt!, TILT_C, TILT_S);
      drawMesh(gl, this.rigFor(d.look).mesh);
    });
    gl.disable(gl.STENCIL_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  private drawTrails(gl: GL, f: FrameInfo): void {
    const pos: number[] = [], uv: number[] = [];
    const tmpM = new Float32Array(BONES * 16);
    for (const d of this.list) {
      if (d.attackU < 0 || d.pose.swing <= 0) continue;
      const rm = this.rigFor(d.look);
      if (rm.rig.weapon === "none" || rm.rig.weapon === "spear") continue;
      const u1 = d.attackU, u0 = Math.max(0.28, u1 - 0.2);
      const len = rm.rig.weaponLen;
      let prev: [number[], number[]] | null = null;
      for (let s = 0; s <= TRAIL_SAMPLES; s++) {
        const u = u0 + ((u1 - u0) * s) / TRAIL_SAMPLES;
        const p = this.tmp;
        clearPose(p);
        attack(p, rm.rig, u);
        this.bones(rm.rig, d, p, tmpM);
        const w = tmpM.subarray(BONE.weapon * 16, BONE.weapon * 16 + 16);
        const base = tilt(xf(w, 0, len * 0.3, 0.6), d.x, d.y, d.z), tip = tilt(xf(w, 0, len, 0.6), d.x, d.y, d.z);
        if (prev) {
          const a = s - 1, b = s;
          const x0 = a / TRAIL_SAMPLES, x1 = b / TRAIL_SAMPLES;
          pos.push(...prev[0], ...prev[1], ...tip, ...prev[0], ...tip, ...base);
          const h = (p: number[]) => Math.max(0, p[1]! - d.y);
          uv.push(x0, 0, h(prev[0]), x0, 1, h(prev[1]), x1, 1, h(tip), x0, 0, h(prev[0]), x1, 1, h(tip), x1, 0, h(base));
        }
        prev = [base, tip];
      }
    }
    if (pos.length === 0) return;
    if (this.trailMesh) deleteMesh(gl, this.trailMesh);
    this.trailMesh = mesh(gl, [
      { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(pos) },
      { loc: LOC.aux, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(uv) },
    ], pos.length / 3);
    gl.useProgram(this.trailP.prog);
    gl.uniformMatrix4fv(this.trailP.u.uViewProj!, false, f.viewProj);
    gl.uniform1f(this.trailP.u.uLean!, f.lean);
    gl.uniform3f(this.trailP.u.uCore!, 1.0, 1.0, 0.92);
    gl.uniform3f(this.trailP.u.uEdge!, 1.0, 0.78, 0.42);
    drawMesh(gl, this.trailMesh);
  }
}

function xf(m: Float32Array, x: number, y: number, z: number): number[] {
  return [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!];
}

/** Translation * Ry(yaw) * Rx(pitch) * Rz(roll), the same rotation order as compose(). */
function trs(tx: number, ty: number, tz: number, pitch: number, yaw: number, roll: number): Float32Array {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const m = new Float32Array(16);
  m[0] = cy * cr + sy * sp * sr; m[1] = cp * sr; m[2] = -sy * cr + cy * sp * sr;
  m[4] = -cy * sr + sy * sp * cr; m[5] = cp * cr; m[6] = sy * sr + cy * sp * cr;
  m[8] = sy * cp; m[9] = -sp; m[10] = cy * cp;
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
  return m;
}

function mul4(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return o;
}
