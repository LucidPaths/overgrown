// The frame: shadow map -> low-res G-buffer (colour, normal+material, depth) -> outline/grade pass -> nearest
// upscale with a sub-texel camera offset. Everything is drawn in world px with an orthographic 3/4 camera.
import { deleteTarget, program, target, type GL, type Program, type Target } from "../gl/glu";
import { lookBasis, mul, norm, ortho, viewFromBasis, type Mat4, type Vec3 } from "../gl/math";
import { BLIT_FS, FULLSCREEN_VS, POST_FS } from "./terrain-shaders";

export interface Lighting {
  sunDir: Vec3;
  sunCol: Vec3;
  skyCol: Vec3;
  bounceCol: Vec3;
  shadeTint: Vec3;
  cloudAmt: number;
  grade: Vec3;
  clear: Vec3;
}

export const DAY: Lighting = {
  sunDir: norm([-0.45, 0.8, 0.5]),
  sunCol: [1.0, 0.93, 0.78],
  skyCol: [0.62, 0.72, 0.95],
  bounceCol: [0.55, 0.5, 0.45],
  shadeTint: [0.82, 0.8, 1.05],
  cloudAmt: 0.55,
  grade: [1.12, 1.06, 0.35],
  clear: [0.12, 0.3, 0.55],
};

export interface FrameInfo {
  viewProj: Mat4;
  lightViewProj: Mat4;
  time: number;
  /** Camera basis, for billboards. */
  right: Vec3;
  up: Vec3;
  back: Vec3;
  lighting: Lighting;
  /** clip-space y per px of height (see LEAN) */
  lean: number;
  /** world xz rectangle the camera can see (generous: tall things and their lean included) */
  view: { x0: number; x1: number; z0: number; z1: number };
  /** true if chunk (cx, cy) touches the view, grown by `pad` px (shadow casters need more) */
  sees(cx: number, cy: number, pad?: number): boolean;
  /** Called by drawables: sets the shared light uniforms on a program that is in use. */
  setLight(p: Program): void;
}

export interface Drawable {
  shadow?(gl: GL, f: FrameInfo): void;
  main(gl: GL, f: FrameInfo): void;
  /** After every main(): see-through effects that test against the finished depth. */
  overlay?(gl: GL, f: FrameInfo): void;
}

export const PITCH_DEG = 52;
/**
 * Upright things (characters, trees, props) are drawn stretched upward by LEAN px per px of height above their base,
 * with their depth left upright. The ground stays a 52 deg map; characters read like a ~36 deg front view, so faces
 * show. (The trick A Link Between Worlds uses: lean the world back toward the camera.)
 */
export const LEAN = 0.3;

export class Renderer {
  readonly gl: GL;
  scale = 2;
  iw = 0;
  ih = 0;
  private g?: Target;
  private post?: Target;
  private shadowT?: Target;
  readonly shadowSize = 1024; // ~0.75-1 world px per shadow texel at the game zoom
  private postP: Program;
  private blitP: Program;
  readonly drawables: Drawable[] = [];
  lighting: Lighting = DAY;
  cloudOffset: [number, number] = [0, 0];
  /** Camera focus in world px (x, ground height, z). */
  focus: Vec3 = [0, 0, 0];
  private subTexel: [number, number] = [0, 0];
  readonly basis = lookBasis([0, -Math.sin((PITCH_DEG * Math.PI) / 180), -Math.cos((PITCH_DEG * Math.PI) / 180)]);
  stats = { drawCalls: 0 };
  lean = LEAN;
  /** point lights for this frame: xyz + radius, rgb (see LIGHT_FN) */
  readonly lights = new Float32Array(32);
  readonly lightCols = new Float32Array(24);
  /** >1 renders the same framing at more texels per world px (used by the smooth/voxel explorations). */
  zoom = 1;
  /** Runs after the blit, with the canvas bound: full-resolution layers (the character lab) draw here. */
  afterBlit?: (f: FrameInfo) => void;
  /** The sun's shadow map (depth texture). */
  get shadowMap(): WebGLTexture | undefined {
    return this.shadowT?.depth;
  }
  /** The low-res G-buffer (colour, aux, depth), for passes that composite over it. */
  get gbuffer(): Target | undefined {
    return this.g;
  }
  /** How a G-buffer texel maps to canvas device px: device = texel * scale + offset (the blit's mapping). */
  blitMap(): { scale: number; ox: number; oy: number } {
    const ox = (this.canvas.width - this.iw * this.scale) * 0.5 - Math.round(this.subTexel[0] * this.scale);
    const oy = (this.canvas.height - this.ih * this.scale) * 0.5 - Math.round(this.subTexel[1] * this.scale);
    return { scale: this.scale, ox, oy };
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available in this browser");
    this.gl = gl;
    this.postP = program(gl, "post", FULLSCREEN_VS, POST_FS);
    this.blitP = program(gl, "blit", FULLSCREEN_VS, BLIT_FS);
    this.shadowT = target(gl, this.shadowSize, this.shadowSize, 0, true);
  }

  /** Picks the integer texel scale for the canvas and (re)allocates the low-res targets. */
  resize(devW: number, devH: number, forcedScale = 0): void {
    const gl = this.gl;
    this.canvas.width = devW;
    this.canvas.height = devH;
    // the long axis always shows ~440 texels: a hack-and-slash framing (~27 tiles across), on desktop and phone alike
    const scale = forcedScale > 0 ? forcedScale : Math.max(1, Math.round(Math.max(devW, devH) / 440));
    const iw = Math.ceil(devW / scale) + 2, ih = Math.ceil(devH / scale) + 2;
    if (scale === this.scale && iw === this.iw && ih === this.ih && this.g) return;
    this.scale = scale; this.iw = iw; this.ih = ih;
    if (this.g) deleteTarget(gl, this.g);
    if (this.post) deleteTarget(gl, this.post);
    this.g = target(gl, iw, ih, 2, true, gl.NEAREST, true);
    this.post = target(gl, iw, ih, 1, false);
  }

  private viewProj(): { vp: Mat4; eye: Vec3 } {
    const { right, up, back } = this.basis;
    const D = 3000;
    const f = this.focus;
    const eye: Vec3 = [f[0] + back[0] * D, f[1] + back[1] * D, f[2] + back[2] * D];
    // snap the eye to whole texels in the view plane; keep the remainder for the upscale pass
    const er = eye[0] * right[0] + eye[1] * right[1] + eye[2] * right[2];
    const eu = eye[0] * up[0] + eye[1] * up[1] + eye[2] * up[2];
    const sr = Math.round(er * this.zoom) / this.zoom, su = Math.round(eu * this.zoom) / this.zoom;
    this.subTexel = [(er - sr) * this.zoom, (eu - su) * this.zoom];
    const snapped: Vec3 = [
      eye[0] + right[0] * (sr - er) + up[0] * (su - eu),
      eye[1] + right[1] * (sr - er) + up[1] * (su - eu),
      eye[2] + right[2] * (sr - er) + up[2] * (su - eu),
    ];
    const view = viewFromBasis(right, up, back, snapped);
    const z = this.zoom;
    const proj = ortho(-this.iw / 2 / z, this.iw / 2 / z, -this.ih / 2 / z, this.ih / 2 / z, D - 1500, D + 1500);
    return { vp: mul(proj, view), eye: snapped };
  }

  private lightViewProj(): Mat4 {
    const L = this.lighting.sunDir;
    const b = lookBasis([-L[0], -L[1], -L[2]]);
    const f = this.focus;
    const D = 2000;
    const eye: Vec3 = [f[0] + L[0] * D, f[1] + L[1] * D, f[2] + L[2] * D];
    const half = Math.max(this.iw, this.ih * 1.4) / this.zoom * 0.75 + 64;
    // snap the light eye to shadow texels so shadows never swim
    const texel = (half * 2) / this.shadowSize;
    const er = eye[0] * b.right[0] + eye[1] * b.right[1] + eye[2] * b.right[2];
    const eu = eye[0] * b.up[0] + eye[1] * b.up[1] + eye[2] * b.up[2];
    const dr = Math.round(er / texel) * texel - er, du = Math.round(eu / texel) * texel - eu;
    const se: Vec3 = [eye[0] + b.right[0] * dr + b.up[0] * du, eye[1] + b.right[1] * dr + b.up[1] * du, eye[2] + b.right[2] * dr + b.up[2] * du];
    return mul(ortho(-half, half, -half, half, D - 1200, D + 1200), viewFromBasis(b.right, b.up, b.back, se));
  }

  render(time: number): void {
    const gl = this.gl;
    const g = this.g!, post = this.post!, sh = this.shadowT!;
    const { vp } = this.viewProj();
    const lvp = this.lightViewProj();
    const L = this.lighting;
    const self = this;
    const lean = (2 * this.zoom / this.ih) * this.lean;
    const fo = this.focus, hw = this.iw / 2 / this.zoom, hd = this.ih / 2 / this.zoom / Math.sin((PITCH_DEG * Math.PI) / 180);
    const view = { x0: fo[0] - hw - 48, x1: fo[0] + hw + 48, z0: fo[2] - hd - 64, z1: fo[2] + hd + 180 };
    const f: FrameInfo = {
      view,
      sees(cx: number, cy: number, pad = 0) {
        return cx * 512 + 512 > view.x0 - pad && cx * 512 < view.x1 + pad && cy * 512 + 512 > view.z0 - pad && cy * 512 < view.z1 + pad;
      },
      viewProj: vp, lightViewProj: lvp, time, lighting: L, lean, ...this.basis,
      setLight(p: Program) {
        const u = p.u;
        gl.uniformMatrix4fv(u.uViewProj!, false, vp);
        gl.uniformMatrix4fv(u.uLightViewProj!, false, lvp);
        gl.uniform3fv(u.uSunDir!, L.sunDir);
        gl.uniform3fv(u.uSunCol!, L.sunCol);
        gl.uniform3fv(u.uSkyCol!, L.skyCol);
        gl.uniform3fv(u.uBounceCol!, L.bounceCol);
        gl.uniform3fv(u.uShadeTint!, L.shadeTint);
        gl.uniform1f(u.uTime!, time);
        gl.uniform1f(u.uLean!, lean);
        if (u.uPL) gl.uniform4fv(u.uPL, self.lights);
        if (u.uPLc) gl.uniform3fv(u.uPLc, self.lightCols);
        gl.uniform2f(u.uCloud!, self.cloudOffset[0], self.cloudOffset[1]);
        gl.uniform1f(u.uCloudAmt!, L.cloudAmt);
        gl.uniform2f(u.uShadowTexel!, 1 / self.shadowSize, 1 / self.shadowSize);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sh.depth!);
        gl.uniform1i(u.uShadow!, 0);
      },
    };

    // 1. shadow map
    gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo);
    gl.viewport(0, 0, sh.w, sh.h);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    for (const d of this.drawables) d.shadow?.(gl, f);

    // 2. G-buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
    gl.viewport(0, 0, g.w, g.h);
    gl.clearBufferfv(gl.COLOR, 0, [...L.clear, 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 4 / 255, 1]);
    gl.clearStencil(0);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    for (const d of this.drawables) d.main(gl, f);
    for (const d of this.drawables) d.overlay?.(gl, f);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    // 3. outlines + grade
    gl.bindFramebuffer(gl.FRAMEBUFFER, post.fbo);
    gl.viewport(0, 0, post.w, post.h);
    gl.useProgram(this.postP.prog);
    const pu = this.postP.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.color[0]!); gl.uniform1i(pu.uColor!, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.color[1]!); gl.uniform1i(pu.uAux!, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.depth!); gl.uniform1i(pu.uDepth!, 2);
    gl.uniform2f(pu.uTexel!, 1 / g.w, 1 / g.h);
    gl.uniform1f(pu.uDepthRange!, 3000);
    gl.uniform3fv(pu.uGrade!, L.grade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. upscale to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.blitP.prog);
    const bu = this.blitP.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.color[0]!); gl.uniform1i(bu.uSrc!, 0);
    gl.uniform2f(bu.uSrcSize!, post.w, post.h);
    gl.uniform2f(bu.uDstSize!, this.canvas.width, this.canvas.height);
    gl.uniform2f(bu.uOffset!, Math.round(this.subTexel[0] * this.scale), Math.round(this.subTexel[1] * this.scale));
    gl.uniform1f(bu.uScale!, this.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.afterBlit?.(f);
  }

  /** World px point (+ `h` px of lean height) -> G-buffer texel xy and window depth. */
  toTexel(p: Vec3, h = 0): [number, number, number] {
    const { vp } = this.viewProj();
    const x = vp[0]! * p[0] + vp[4]! * p[1] + vp[8]! * p[2] + vp[12]!;
    const y = vp[1]! * p[0] + vp[5]! * p[1] + vp[9]! * p[2] + vp[13]! + ((2 * this.zoom) / this.ih) * this.lean * h;
    const z = vp[2]! * p[0] + vp[6]! * p[1] + vp[10]! * p[2] + vp[14]!;
    return [(x * 0.5 + 0.5) * this.iw, (y * 0.5 + 0.5) * this.ih, z * 0.5 + 0.5];
  }

  /** World px point -> CSS px on the canvas (for debug labels). */
  project(p: Vec3): [number, number] {
    const { vp } = this.viewProj();
    const x = vp[0]! * p[0] + vp[4]! * p[1] + vp[8]! * p[2] + vp[12]!;
    const y = vp[1]! * p[0] + vp[5]! * p[1] + vp[9]! * p[2] + vp[13]!;
    return [((x * 0.5 + 0.5) * this.iw - 1) * this.scale, ((0.5 - y * 0.5) * this.ih - 1) * this.scale];
  }
}
