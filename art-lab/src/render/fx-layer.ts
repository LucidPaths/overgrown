// Cosmetic particles: hit sparks, dust from rolls and running feet, splashes and ripples in water. Spawned from
// snapshot events on the host, never fed back to the sim. Square texels of flat colour, written into the G-buffer
// as FX (no outline, unlit), so they sit in the world with correct depth and the same pixel grid.
import { MAT } from "../geo/builder";
import { deleteMesh, drawMesh, mesh, program, type GL, type Mesh, type Program } from "../gl/glu";
import { HEADER } from "./glsl";
import type { Drawable, FrameInfo } from "./renderer";
import { LOC } from "./terrain-shaders";

const VS = `${HEADER}
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 aCol;
layout(location=3) in float aH;
uniform mat4 uViewProj;
uniform float uLean;
out vec4 vCol;
void main() {
  vCol = aCol;
  gl_Position = uViewProj * vec4(aPos, 1.0);
  gl_Position.y += uLean * aH;
  gl_Position.z -= 0.003;
}`;
const FS = `${HEADER}
in vec4 vCol;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oAux;
void main() {
  // alpha is a dither threshold: fading particles break up into pixels instead of going translucent
  const float B[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  ivec2 p = ivec2(gl_FragCoord.xy) & 3;
  if (vCol.a < (B[p.y * 4 + p.x] + 0.5) / 16.0) discard;
  oColor = vec4(vCol.rgb, 1.0);
  oAux = vec4(0.5, 0.5, ${MAT.Fx}.0 / 255.0, 1.0);
}`;

type RGB = [number, number, number];
interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  g: number; drag: number;
  age: number; life: number;
  size: number; grow: number;
  col: RGB; col2: RGB;
  ground: number;
  /** ring: an expanding flat ellipse on the ground/water instead of a square */
  ring?: boolean;
  /** blink rate (fireflies): alpha follows a slow on/off */
  blink?: number;
  /** lit by the scene (dust, droplets) rather than glowing (sparks, fireflies) */
  lit?: boolean;
}

/** Deterministic cosmetic hash (no Math.random anywhere in the lab). */
function h(a: number, b: number): number {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

export class FxLayer implements Drawable {
  private p: Program;
  private parts: P[] = [];
  private m?: Mesh;
  private n = 0;
  /** scene light for lit particles, set each frame */
  ambient: [number, number, number] = [1, 1, 1];
  private right: number[] = [1, 0, 0];
  private up: number[] = [0, 1, 0];

  constructor(private gl: GL) {
    this.p = program(gl, "fx", VS, FS);
  }

  private add(p: P): void {
    if (this.parts.length < 600) this.parts.push(p);
  }

  /** A blow lands: a burst of sparks away from the attacker, a flat shock ring, a few white chips. */
  hit(x: number, y: number, z: number, dx: number, dz: number, seed: number): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.atan2(dz, dx) + (h(seed, i) - 0.5) * 2.2;
      const sp = 60 + h(seed, i + 50) * 110;
      this.add({ x, y: y + 11, z, vx: Math.cos(a) * sp, vy: 30 + h(seed, i + 90) * 90, vz: Math.sin(a) * sp, g: 380, drag: 3, age: 0, life: 0.22 + h(seed, i + 7) * 0.2, size: i < 4 ? 2.2 : 1.3, grow: -2, col: [1, 0.97, 0.75], col2: [1, 0.55, 0.2], ground: y });
    }
    this.add({ x, y: y + 0.6, z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, age: 0, life: 0.22, size: 4, grow: 70, col: [1, 1, 0.9], col2: [1, 0.8, 0.4], ground: y, ring: true });
  }

  /** Dust kicked up by feet: a few soft puffs that rise and thin out. */
  dust(x: number, y: number, z: number, seed: number, n = 5, spread = 1, col: RGB = [0.82, 0.76, 0.64]): void {
    for (let i = 0; i < n; i++) {
      const a = h(seed, i) * Math.PI * 2;
      const sp = (10 + h(seed, i + 20) * 26) * spread;
      this.add({ x: x + Math.cos(a) * 3, y: y + 1, z: z + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: 8 + h(seed, i + 40) * 14, vz: Math.sin(a) * sp * 0.7, g: -4, drag: 4, age: 0, life: 0.35 + h(seed, i + 60) * 0.35, size: 2.5 + h(seed, i + 80) * 2, grow: 3, col, col2: col, ground: y, lit: true });
    }
  }

  /** Water: droplets and a ring on the surface. */
  splash(x: number, y: number, z: number, seed: number, big = false): void {
    for (let i = 0; i < (big ? 12 : 5); i++) {
      const a = h(seed, i) * Math.PI * 2;
      const sp = 20 + h(seed, i + 20) * (big ? 50 : 25);
      this.add({ x, y: y + 1, z, vx: Math.cos(a) * sp, vy: 50 + h(seed, i + 40) * (big ? 80 : 40), vz: Math.sin(a) * sp, g: 400, drag: 1, age: 0, life: 0.3 + h(seed, i + 60) * 0.2, size: 1.4, grow: 0, col: [0.92, 0.98, 1], col2: [0.6, 0.85, 0.95], ground: y, lit: true });
    }
    this.ripple(x, y, z, big ? 1.4 : 1);
  }

  ripple(x: number, y: number, z: number, k = 1): void {
    this.add({ x, y: y + 0.15, z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, age: 0, life: 0.7 * k, size: 3, grow: 20 * k, col: [0.85, 0.95, 1], col2: [0.6, 0.85, 0.95], ground: y, ring: true, lit: true });
  }

  /** A firefly: drifts and wanders, glows on and off. */
  firefly(x: number, y: number, z: number, seed: number): void {
    const a = h(seed, 1) * Math.PI * 2;
    this.add({ x, y: y + 4 + h(seed, 2) * 14, z, vx: Math.cos(a) * 6, vy: (h(seed, 3) - 0.5) * 4, vz: Math.sin(a) * 6, g: 0, drag: 0, age: 0, life: 3 + h(seed, 4) * 3, size: 1.1, grow: 0, col: [0.95, 1, 0.55], col2: [0.75, 0.95, 0.4], ground: y, blink: 1.5 + h(seed, 5) * 2 });
  }

  update(dt: number, f: { right: number[]; up: number[] }): void {
    this.right = f.right; this.up = f.up;
    const out: P[] = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.ground) { p.y = p.ground; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; }
      p.size = Math.max(0.6, p.size + p.grow * dt);
      if (p.blink) { p.vx += Math.sin(p.age * 1.7 + p.x) * 8 * dt; p.vz += Math.cos(p.age * 1.3 + p.z) * 8 * dt; }
      out.push(p);
    }
    this.parts = out;
  }

  main(gl: GL, f: FrameInfo): void {
    if (this.parts.length === 0) return;
    const pos: number[] = [], col: number[] = [], hh: number[] = [];
    const r = this.right, u = this.up;
    const quad = (cx: number, cy: number, cz: number, s: number, c: number[], a: number, ground: number) => {
      const ax = r[0]! * s, ay = r[1]! * s, az = r[2]! * s, bx = u[0]! * s, by = u[1]! * s, bz = u[2]! * s;
      const v = [[cx - ax - bx, cy - ay - by, cz - az - bz], [cx + ax - bx, cy + ay - by, cz + az - bz], [cx + ax + bx, cy + ay + by, cz + az + bz], [cx - ax + bx, cy - ay + by, cz - az + bz]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(v[k]![0]!, v[k]![1]!, v[k]![2]!);
        col.push(Math.round(c[0]! * 255), Math.round(c[1]! * 255), Math.round(c[2]! * 255), Math.round(a * 255));
        hh.push(Math.max(0, v[k]![1]! - ground));
      }
    };
    for (const p of this.parts) {
      const t = p.age / p.life;
      const am = p.lit ? this.ambient : [1, 1, 1];
      const c = [(p.col[0] + (p.col2[0] - p.col[0]) * t) * am[0]!, (p.col[1] + (p.col2[1] - p.col[1]) * t) * am[1]!, (p.col[2] + (p.col2[2] - p.col[2]) * t) * am[2]!];
      let a = 1 - t * t;
      if (p.blink) a = Math.max(0, Math.sin(p.age * p.blink * 2)) * Math.min(1, (p.life - p.age) * 2);
      if (p.ring) {
        // a flat ellipse of little squares on the ground plane
        const seg = 16;
        for (let i = 0; i < seg; i++) {
          const ang = (i / seg) * Math.PI * 2;
          quad(p.x + Math.cos(ang) * p.size, p.y, p.z + Math.sin(ang) * p.size * 0.9, 0.6, c, a * 0.9, p.ground);
        }
      } else quad(p.x, p.y, p.z, p.size * 0.5, c, a, p.ground);
    }
    if (this.m) deleteMesh(gl, this.m);
    this.m = mesh(gl, [
      { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(pos) },
      { loc: LOC.col, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(col) },
      { loc: LOC.aux, size: 1, type: gl.FLOAT, normalized: false, data: new Float32Array(hh) },
    ], pos.length / 3);
    this.n = pos.length / 3;
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.p.prog);
    gl.uniformMatrix4fv(this.p.u.uViewProj!, false, f.viewProj);
    gl.uniform1f(this.p.u.uLean!, f.lean);
    drawMesh(gl, this.m);
    gl.enable(gl.CULL_FACE);
  }

  get count(): number {
    return this.n;
  }
}
