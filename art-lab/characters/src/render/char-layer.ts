// Characters at full resolution over the pixel world. The world renders as before (low-res G-buffer, outlines,
// nearest upscale); then this layer fills a full-res depth buffer from the world's depth texel for texel, draws
// the skinned characters into it with the same projection and blit mapping, and inks them in a post pass.
// Shadows go into the world's shadow map, so characters still shade the ground they stand on.
import { deleteTarget, drawMesh, program, target, type GL, type Mesh, type Program, type Target } from "../../../src/gl/glu";
import type { Drawable, FrameInfo, Renderer } from "../../../src/render/renderer";
import { buildLook, lookPalette, type Built, type Look } from "../body/look";
import type { MeshPool } from "../body/mesh-pool";
import { BONES } from "../rig/skeleton";
import { newPosed, placeM, skin, fk, type Pose, type Posed } from "../rig/pose";
import { toCharGeo, uploadChar } from "./char-mesh";
import { CHAR_FS, CHAR_SHADOW_VS, CHAR_VS, DEPTH_FILL_FS, FULL_VS, INK_FS } from "./char-shaders";
import type { MatDef } from "../body/mats";

export interface CharDraw {
  look: Look;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: Pose;
  /** filled by the layer (or by IK before it) */
  posed?: Posed;
  /** set true when the caller already ran fk() (and IK) into posed */
  posedReady?: boolean;
  /** palette override for this draw (dye, greying) */
  palette?: MatDef[];
}

interface Entry {
  built: Built;
  mesh: Mesh;
}

export const TILT = (18 * Math.PI) / 180;

export class CharLayer implements Drawable {
  readonly list: CharDraw[] = [];
  private cache = new Map<string, Entry>();
  private p: Program;
  private sp: Program;
  private fillP: Program;
  private inkP: Program;
  private t?: Target;
  private mats: Float32Array[] = [];
  private boneTex: WebGLTexture;
  private boneRows = 0;
  private boneData = new Float32Array(0);
  private world = new Float32Array(16);
  tilt = TILT;
  /** clay: full-res ink pass; pixel: drawn into the world's G-buffer; paint: clay + hatching, thin lines */
  mode: "clay" | "pixel" | "paint" = "clay";
  /** key light for characters (world space): from the viewer's upper left and in front, at every time of day */
  key: [number, number, number] = [-0.5, 0.72, 0.48];
  /** ink line radius in world px (scaled by the device px per world px) */
  lineW = 0.42;
  ink: [number, number, number] = [0.34, 0.27, 0.38];
  stats = { tris: 0, draws: 0 };

  constructor(private gl: GL, private r: Renderer) {
    this.p = program(gl, "char", CHAR_VS, CHAR_FS);
    this.sp = program(gl, "char-shadow", CHAR_SHADOW_VS, `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.0); }`);
    this.fillP = program(gl, "char-depth-fill", FULL_VS, DEPTH_FILL_FS);
    this.inkP = program(gl, "char-ink", FULL_VS, INK_FS);
    r.afterBlit = (f) => this.fullRes(f);
    this.boneTex = gl.createTexture()!;
  }

  /** All characters' skin matrices in one RGBA32F texture: a row per character, 4 texels per bone. */
  private uploadBones(): void {
    const gl = this.gl;
    const n = Math.max(1, this.list.length);
    const W = BONES * 4;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.boneTex);
    if (n > this.boneRows) {
      this.boneRows = Math.max(n, this.boneRows * 2, 16);
      this.boneData = new Float32Array(W * 4 * this.boneRows);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, this.boneRows, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    for (let i = 0; i < this.list.length; i++) this.boneData.set(this.mats[i]!, i * W * 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, n, gl.RGBA, gl.FLOAT, this.boneData.subarray(0, W * 4 * n));
  }

  private bindBones(p: Program): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.boneTex);
    gl.uniform1i(p.u.uBoneTex!, 3);
  }

  /** Async meshing: when set, looks come from the pool and characters appear once their mesh is ready. */
  pool?: MeshPool;

  /** The GPU entry for a look, or undefined while its mesh is still being sculpted. */
  ready(look: Look): Entry | undefined {
    if (!this.pool) return this.entry(look);
    const b = this.pool.peek(look);
    return b ? this.upload(b) : undefined;
  }

  entry(look: Look): Entry {
    return this.upload(buildLook(look));
  }

  private upload(b: Built): Entry {
    let e = this.cache.get(b.key);
    if (!e) {
      e = { built: b, mesh: uploadChar(this.gl, toCharGeo(b.raw)) };
      this.cache.set(b.key, e);
    }
    return e;
  }

  private prepare(): void {
    // characters whose mesh is still being sculpted are skipped this frame
    if (this.pool) {
      let n = 0;
      for (const d of this.list) if (this.ready(d.look)) this.list[n++] = d;
      this.list.length = n;
    }
    while (this.mats.length < this.list.length) this.mats.push(new Float32Array(BONES * 16));
    this.list.forEach((d, i) => {
      const e = this.ready(d.look)!;
      if (!d.posed) d.posed = newPosed();
      if (!d.posedReady) fk(e.built.sk, d.pose, d.posed);
      placeM(d.x, d.y, d.z, d.yaw, 1, this.world);
      skin(e.built.sk, d.pose, d.posed, this.world, this.mats[i]!);
    });
    this.uploadBones();
  }

  shadow(gl: GL, f: FrameInfo): void {
    this.prepare();
    gl.useProgram(this.sp.prog);
    gl.uniformMatrix4fv(this.sp.u.uLightViewProj!, false, f.lightViewProj);
    gl.disable(gl.CULL_FACE);
    this.bindBones(this.sp);
    this.list.forEach((d, i) => {
      gl.uniform1i(this.sp.u.uRow!, i);
      drawMesh(gl, this.ready(d.look)!.mesh);
    });
    gl.enable(gl.CULL_FACE);
  }

  main(gl: GL, f: FrameInfo): void {
    if (this.mode !== "pixel") return; // clay and paint draw at full resolution after the blit
    const g = this.r.gbuffer!;
    this.drawChars(gl, f, g.w, g.h, { scale: 1, ox: 0, oy: 0 }, true);
    gl.enable(gl.CULL_FACE);
  }


  private drawChars(gl: GL, f: FrameInfo, W: number, H: number, map: { scale: number; ox: number; oy: number }, pixel: boolean): void {
    const r = this.r;
    const g = r.gbuffer!;
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    const p = this.p, u = p.u, L = f.lighting;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(u.uViewProj!, false, f.viewProj);
    gl.uniform2f(u.uTilt!, Math.cos(this.tilt), Math.sin(this.tilt));
    gl.uniform1f(u.uLean!, f.lean);
    gl.uniform4f(u.uMap!, map.scale, map.ox, map.oy, 0);
    gl.uniform4f(u.uSize!, g.w, g.h, W, H);
    gl.uniform1f(u.uPixel!, pixel ? 1 : 0);
    gl.uniform1f(u.uPixelMode!, pixel ? 1 : 0);
    gl.uniform1f(u.uHatch!, this.mode === "paint" ? 1 : 0);
    gl.uniform3fv(u.uKey!, this.keyDir(f));
    gl.uniform1f(u.uDepthBias!, (window as unknown as { dbgSimple?: number }).dbgSimple ?? 0);
    gl.uniform3fv(u.uSunDir!, L.sunDir);
    gl.uniform3fv(u.uSunCol!, L.sunCol);
    gl.uniform3fv(u.uSkyCol!, L.skyCol);
    gl.uniform3fv(u.uBounceCol!, L.bounceCol);
    gl.uniform3fv(u.uShadeTint!, L.shadeTint);
    gl.uniform3fv(u.uView!, f.back);
    if (u.uPL) gl.uniform4fv(u.uPL, r.lights);
    if (u.uPLc) gl.uniform3fv(u.uPLc, r.lightCols);
    this.bindBones(p);
    this.stats.tris = 0;
    this.stats.draws = 0;
    const lit = new Float32Array(64), shd = new Float32Array(48);
    this.list.forEach((d, i) => {
      const e = this.ready(d.look)!;
      const pal = d.palette ?? lookPalette(d.look);
      for (let k = 0; k < 16; k++) {
        const m = pal[k]!;
        lit.set([m.lit[0], m.lit[1], m.lit[2], m.kind], k * 4);
        shd.set(m.shade, k * 3);
      }
      gl.uniform4fv(u.uLit!, lit);
      gl.uniform3fv(u.uShd!, shd);
      gl.uniform1i(u.uRow!, i);
      gl.uniform3f(u.uFeet!, d.x, d.y, d.z);
      gl.uniform1f(u.uFlash!, d.pose.flash);
      gl.uniform1f(u.uInShadow!, 0);
      gl.uniform1f(u.uId!, ((i % 250) + 1) / 255);
      const fc = e.built.face, hc = e.built.headC;
      gl.uniform3f(u.uHeadC!, hc[0], hc[1], hc[2]);
      gl.uniform4f(u.uEye!, fc.eyeX, fc.eyeY, fc.eyeW, fc.eyeH);
      gl.uniform4f(u.uEye2!, fc.eyeTilt, fc.slit, fc.brow, fc.browY);
      gl.uniform4f(u.uMouth!, fc.mouthY, fc.mouthW, fc.faceZ, 0);
      gl.uniform3fv(u.uIris!, fc.iris);
      gl.uniform4f(u.uFace!, d.pose.blink, d.pose.expr, 0, 0);
      drawMesh(gl, e.mesh);
      this.stats.tris += e.mesh.count / 3;
      this.stats.draws++;
    });
  }

  /**
   * The key light. Characters get their own light (as Arc System Works gives each fighter one): the sun moves and
   * can sit behind the camera, but a figure must always read as a lit form with a shade side. The camera has no
   * yaw, so a fixed world direction is fixed on screen too.
   */
  private keyDir(_f: FrameInfo): [number, number, number] {
    const k = this.key;
    const n = Math.hypot(k[0], k[1], k[2]);
    return [k[0] / n, k[1] / n, k[2] / n];
  }

  private ensureTarget(w: number, h: number): Target {
    if (this.t && this.t.w === w && this.t.h === h) return this.t;
    if (this.t) deleteTarget(this.gl, this.t);
    this.t = target(this.gl, w, h, 2, true);
    return this.t;
  }

  private fullRes(f: FrameInfo): void {
    if (this.mode === "pixel") return;
    const gl = this.gl, r = this.r;
    const W = r.canvas.width, H = r.canvas.height;
    const t = this.ensureTarget(W, H);
    const map = r.blitMap();
    const g = r.gbuffer!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    // 1. the world's depth, texel for texel
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    gl.useProgram(this.fillP.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.depth!);
    gl.uniform1i(this.fillP.u.uDepth!, 0);
    gl.uniform4f(this.fillP.u.uMap!, map.scale, map.ox, map.oy, 0);
    gl.uniform2f(this.fillP.u.uSrc!, g.w, g.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.colorMask(true, true, true, true);
    // 2. characters
    this.drawChars(gl, f, W, H, map, false);
    gl.disable(gl.DEPTH_TEST);
    // 3. ink and composite onto the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const ip = this.inkP;
    gl.useProgram(ip.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.color[0]!); gl.uniform1i(ip.u.uCol!, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.color[1]!); gl.uniform1i(ip.u.uAux!, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t.depth!); gl.uniform1i(ip.u.uDepth!, 2);
    gl.uniform1f(ip.u.uW!, this.lineW <= 0 ? 0 : Math.max(0.8, this.lineW * map.scale * r.zoom));
    gl.uniform1f(ip.u.uRange!, 3000);
    gl.uniform1f(ip.u.uStep!, 1.6);
    gl.uniform3fv(ip.u.uInk!, this.ink);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
}
