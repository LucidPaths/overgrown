// Ground and water meshes per chunk, built from the seeded relief around the camera.
import { deleteMesh, drawMesh, mesh, program, type GL, type Mesh, type Program } from "../gl/glu";
import { mat4 } from "../gl/math";
import { Ground } from "../world/ground";
import { chunkRelief, type ChunkRelief } from "../world/relief";
import { terrainArrays, waterArrays } from "../world/terrain-mesh";
import type { Drawable, FrameInfo } from "./renderer";
import { LOC, SHADOW_FS, SHADOW_VS, TERRAIN_FS, TERRAIN_VS, WATER_FS, WATER_VS } from "./terrain-shaders";

interface ChunkMeshes {
  cx: number;
  cy: number;
  ground: Mesh;
  water?: Mesh;
  relief: ChunkRelief;
}

export class TerrainLayer implements Drawable {
  private terrainP: Program;
  private waterP: Program;
  private shadowP: Program;
  readonly chunks = new Map<string, ChunkMeshes>();
  private identity = mat4();
  /** Called when a chunk's relief is ready (props and grass hang off it). */
  onChunk?: (r: ChunkRelief) => void;
  onDrop?: (cx: number, cy: number) => void;

  constructor(private gl: GL, readonly ground: Ground) {
    this.terrainP = program(gl, "terrain", TERRAIN_VS, TERRAIN_FS);
    this.waterP = program(gl, "water", WATER_VS, WATER_FS);
    this.shadowP = program(gl, "shadow", SHADOW_VS, SHADOW_FS);
  }

  /** Keeps chunks within `radius` (Chebyshev) of the focus; builds at most `budget` new ones per call. */
  update(fx: number, fz: number, rx: number, rz: number, budget = 2): void {
    const ccx = Math.floor(fx / 512), ccz = Math.floor(fz / 512);
    const want = new Set<string>();
    const todo: [number, number, number][] = [];
    for (let dz = -rz; dz <= rz; dz++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const cx = ccx + dx, cy = ccz + dz;
        const k = `${cx},${cy}`;
        want.add(k);
        if (!this.chunks.has(k)) todo.push([cx, cy, dx * dx + dz * dz]);
      }
    }
    todo.sort((a, b) => a[2] - b[2]);
    for (const [cx, cy] of todo.slice(0, budget)) this.build(cx, cy);
    for (const [k, c] of this.chunks) {
      if (!want.has(k)) {
        deleteMesh(this.gl, c.ground);
        if (c.water) deleteMesh(this.gl, c.water);
        this.chunks.delete(k);
        this.onDrop?.(c.cx, c.cy);
      }
    }
  }

  pending(fx: number, fz: number, rx: number, rz: number): number {
    const ccx = Math.floor(fx / 512), ccz = Math.floor(fz / 512);
    let n = 0;
    for (let dz = -rz; dz <= rz; dz++) for (let dx = -rx; dx <= rx; dx++) if (!this.chunks.has(`${ccx + dx},${ccz + dz}`)) n++;
    return n;
  }

  private build(cx: number, cy: number): void {
    const gl = this.gl;
    const r = chunkRelief(this.ground, cx, cy);
    const t = terrainArrays(this.ground, r);
    const ground = mesh(gl, [
      { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: t.pos },
      { loc: LOC.nrm, size: 3, type: gl.FLOAT, normalized: false, data: t.nrm },
      { loc: LOC.col, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: t.tint },
      { loc: LOC.aux, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: t.weights },
    ], 0, t.index);
    const w = waterArrays(this.ground, r);
    const water = w.count > 0
      ? mesh(gl, [
        { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: w.pos },
        { loc: LOC.aux, size: 4, type: gl.FLOAT, normalized: false, data: w.info },
      ], w.count)
      : undefined;
    this.chunks.set(`${cx},${cy}`, { cx, cy, ground, water, relief: r });
    this.onChunk?.(r);
  }

  shadow(gl: GL, f: FrameInfo): void {
    gl.useProgram(this.shadowP.prog);
    gl.uniformMatrix4fv(this.shadowP.u.uLightViewProj!, false, f.lightViewProj);
    gl.uniformMatrix4fv(this.shadowP.u.uModel!, false, this.identity);
    for (const c of this.chunks.values()) drawMesh(gl, c.ground);
  }

  main(gl: GL, f: FrameInfo): void {
    gl.useProgram(this.terrainP.prog);
    f.setLight(this.terrainP);
    for (const c of this.chunks.values()) drawMesh(gl, c.ground);
    gl.useProgram(this.waterP.prog);
    f.setLight(this.waterP);
    gl.disable(gl.CULL_FACE);
    for (const c of this.chunks.values()) if (c.water) drawMesh(gl, c.water);
    gl.enable(gl.CULL_FACE);
  }
}
