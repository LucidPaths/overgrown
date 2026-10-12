// Props per chunk, baked into one static mesh per chunk (variants from a small cache, transformed per instance).
import { Geo, type RGB } from "../geo/builder";
import { VARIANTS, propGeo } from "../geo/props";
import { deleteMesh, drawMesh, mesh, program, type GL, type Mesh, type Program } from "../gl/glu";
import { compose } from "../gl/math";
import { B, Ground, T, hash01 } from "../world/ground";
import { P, propAt } from "../world/placement";
import { RC, type ChunkRelief } from "../world/relief";
import { PROP_FS, PROP_SHADOW_VS, PROP_VS } from "./mesh-shaders";
import type { Drawable, FrameInfo } from "./renderer";
import { LOC, SHADOW_FS } from "./terrain-shaders";

export function reliefHeight(r: ChunkRelief, arr: "h" | "water", x: number, z: number): number {
  const gx = x / 16 - r.cx * 32, gz = z / 16 - r.cy * 32;
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const at = (a: number, b: number) => r[arr][(b + 1) * RC + (a + 1)]!;
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fz) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fz;
}

/** Props too low to matter as shadow casters. */
const SMALL = new Set<number>([P.Flowers, P.Fern, P.Mushroom, P.Reeds, P.Lily, P.TallGrass, P.Shell]);

export interface PropInstance {
  kind: number;
  x: number;
  y: number;
  z: number;
}

export class PropLayer implements Drawable {
  private p: Program;
  private sp: Program;
  /** per chunk: shadow casters (trees, rocks, bushes, logs) and small props that only receive (grass, flowers...) */
  private meshes = new Map<string, { cast?: Mesh; small?: Mesh }>();
  /** Tall props per chunk (for the see-through cutaway around characters). */
  readonly tall = new Map<string, PropInstance[]>();
  pushers = new Float32Array(48);
  /** cutaway around the local player (see PROP_FS) */
  cut = new Float32Array(4);
  stats = { verts: 0 };

  constructor(private gl: GL, private ground: Ground) {
    this.p = program(gl, "props", PROP_VS, PROP_FS);
    this.sp = program(gl, "props-shadow", PROP_SHADOW_VS, SHADOW_FS);
  }

  add(r: ChunkRelief): void {
    const cast = new Geo(), small = new Geo();
    const tall: PropInstance[] = [];
    const s = this.ground.seed;
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const tx = r.cx * 32 + lx, ty = r.cy * 32 + ly;
        const pl = propAt(this.ground, tx, ty);
        if (pl.kind === P.None) continue;
        const b = r.biome[(ly + 2) * 36 + (lx + 2)]!;
        let alt = 0;
        if (pl.kind === P.Pine && b === B.Mountain && this.ground.fields.elevation(tx, ty) > 0.645) alt = 1;
        if (pl.kind === P.Oak && b === B.Grassland) alt = 1;
        if ((pl.kind === P.Boulder || pl.kind === P.Rock) && this.ground.fields.elevation(tx, ty) > 0.73) alt = 1; // snow caps
        if (pl.kind === P.TallGrass && (b === B.Ocean || b === B.Mountain || r.tile[(ly + 2) * 36 + (lx + 2)] === T.Dirt)) alt = 1;
        const variant = Math.floor(pl.v * VARIANTS);
        const geo = propGeo(pl.kind, variant, alt);
        if (!geo) continue;
        const x = (tx + pl.ox) * 16, z = (ty + pl.oy) * 16;
        let y = reliefHeight(r, "h", x, z);
        if (pl.kind === P.Lily) y = reliefHeight(r, "water", x, z) + 0.2;
        const yaw = hash01(s, tx, ty, 201) * Math.PI * 2;
        const sc = 0.85 + hash01(s, tx, ty, 202) * 0.3;
        // trees keep a near-upright yaw-only transform so their light stays consistent
        const m = compose(x, y, z, yaw, 0, 0, sc, sc * (0.92 + hash01(s, tx, ty, 203) * 0.16), sc);
        const hue = (hash01(s, tx, ty, 204) - 0.5) * 0.12;
        const g = SMALL.has(pl.kind) ? small : cast;
        const first = g.vertexCount;
        g.append(geo, m, (c: RGB) => [c[0] * (1 + hue), c[1] * (1 + hue * 0.3), c[2] * (1 - hue * 0.5)]);
        // height above the prop's base, for the lean (u8 px)
        for (let v = first; v < g.vertexCount; v++) g.aux[v * 4 + 2] = Math.max(0, Math.min(255, Math.round(g.pos[v * 3 + 1]! - y)));
        if (pl.kind === P.Oak || pl.kind === P.Pine || pl.kind === P.Birch || pl.kind === P.Palm || (pl.kind === P.Mushroom && pl.v < 0.5)) tall.push({ kind: pl.kind, x, y, z });
      }
    }
    const key = `${r.cx},${r.cy}`;
    this.tall.set(key, tall);
    const gl = this.gl;
    const bake = (g: Geo): Mesh | undefined => {
      if (g.vertexCount === 0) return undefined;
      this.stats.verts += g.vertexCount;
      return mesh(gl, [
        { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(g.pos) },
        { loc: LOC.nrm, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(g.nrm) },
        { loc: LOC.col, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(g.col) },
        { loc: LOC.aux, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(g.aux) },
      ], g.vertexCount);
    };
    this.meshes.set(key, { cast: bake(cast), small: bake(small) });
  }

  drop(cx: number, cy: number): void {
    const k = `${cx},${cy}`;
    const m = this.meshes.get(k);
    for (const x of [m?.cast, m?.small]) {
      if (!x) continue;
      this.stats.verts -= x.count;
      deleteMesh(this.gl, x);
    }
    this.meshes.delete(k);
    this.tall.delete(k);
  }

  shadow(gl: GL, f: FrameInfo): void {
    gl.useProgram(this.sp.prog);
    gl.uniformMatrix4fv(this.sp.u.uLightViewProj!, false, f.lightViewProj);
    gl.uniform1f(this.sp.u.uTime!, f.time);
    gl.uniform4fv(this.sp.u.uPushers!, this.pushers);
    gl.disable(gl.CULL_FACE);
    // casters outside the view still throw shadows into it: pad by the longest shadow (a 70 px tree at this sun)
    const el = Math.max(0.2, f.lighting.sunDir[1]);
    const pad = Math.min(256, (70 * Math.sqrt(1 - el * el)) / el);
    for (const [k, m] of this.meshes) { const [cx, cy] = k.split(",").map(Number); if (m.cast && f.sees(cx!, cy!, pad)) drawMesh(gl, m.cast); }
    gl.enable(gl.CULL_FACE);
  }

  main(gl: GL, f: FrameInfo): void {
    gl.useProgram(this.p.prog);
    f.setLight(this.p);
    gl.uniform4fv(this.p.u.uPushers!, this.pushers);
    gl.uniform4fv(this.p.u.uCut!, this.cut);
    gl.disable(gl.CULL_FACE);
    for (const [k, m] of this.meshes) {
      const [cx, cy] = k.split(",").map(Number);
      if (!f.sees(cx!, cy!)) continue;
      if (m.cast) drawMesh(gl, m.cast);
      if (m.small) drawMesh(gl, m.small);
    }
    gl.enable(gl.CULL_FACE);
  }
}
