// Exploration D: "Voxel diorama" (Cube World lineage). The same seeded relief and props, voxelised at 4 px,
// rendered smooth at full resolution with the shared light model.
import { Geo, MAT, hex, mixc, shade, type RGB } from "../geo/builder";
import { drawMesh, mesh, program, type GL, type Mesh } from "../gl/glu";
import { compose } from "../gl/math";
import { PROP_FS, PROP_SHADOW_VS, PROP_VS } from "../render/mesh-shaders";
import { Renderer, type Drawable, type FrameInfo } from "../render/renderer";
import { LOC, SHADOW_FS } from "../render/terrain-shaders";
import { Ground, T, hash01 } from "../world/ground";
import { HeightField } from "../world/heightfield";
import { P, propAt } from "../world/placement";
import { chunkRelief } from "../world/relief";
import { grassTint } from "../world/terrain-mesh";

const V = 4;

export async function drawVoxel(canvas: HTMLCanvasElement): Promise<void> {
  const r = new Renderer(canvas);
  canvas.style.width = "1280px"; canvas.style.height = "720px";
  r.resize(1280, 720, 1);
  r.zoom = 2;
  const g = new Ground(22);
  const hf = new HeightField();
  const fx = 1600, fz = 980;
  for (let cy = -1; cy <= 1; cy++) for (let cx = -1; cx <= 1; cx++) hf.add(chunkRelief(g, Math.floor(fx / 512) + cx, Math.floor(fz / 512) + cy));
  const geo = new Geo();
  const solid = new Set<string>();
  const x0 = fx - 400, x1 = fx + 400, z0 = fz - 330, z1 = fz + 330;
  const colH = (x: number, z: number) => {
    const w = hf.water(x + V / 2, z + V / 2);
    const h = hf.height(x + V / 2, z + V / 2);
    return Math.round((Number.isNaN(w) ? h : Math.max(h, w)) / V);
  };
  const face = (p: number[][], c: RGB) => {
    geo.tri(p[0]!, p[1]!, p[2]!, { col: c, mat: MAT.Prop });
    geo.tri(p[0]!, p[2]!, p[3]!, { col: c, mat: MAT.Prop });
  };
  for (let z = z0; z < z1; z += V) {
    for (let x = x0; x < x1; x += V) {
      const hv = colH(x, z);
      const tx = Math.floor((x + 2) / 16), tz = Math.floor((z + 2) / 16);
      const t = g.tile(tx, tz);
      const wet = !Number.isNaN(hf.water(x + 2, z + 2));
      const j = hash01(5, x, z) * 0.12 - 0.06;
      let top: RGB = grassTint(g, tx, tz);
      if (t === T.Sand) top = hex(0xe6d29a);
      if (t === T.Dirt) top = hex(0x9a7050);
      if (t === T.Stone || t === T.Cliff) top = hex(0x9a968e);
      if (wet) top = t === T.Deep ? hex(0x2f6fa0) : hex(0x4aa3c0);
      top = shade(top, 1 + j);
      const y = hv * V;
      face([[x, y, z], [x, y, z + V], [x + V, y, z + V], [x + V, y, z]], top);
      const side = wet ? hex(0x3a8ab0) : t === T.Sand ? hex(0xd2b882) : hex(0x8a6448);
      // south and east/west sides down to the neighbour
      const hs = colH(x, z + V), he = colH(x + V, z), hw = colH(x - V, z);
      if (hs < hv) face([[x, hs * V, z + V], [x + V, hs * V, z + V], [x + V, y, z + V], [x, y, z + V]], shade(side, 0.95));
      if (he < hv) face([[x + V, hs * V > y ? y : he * V, z + V], [x + V, he * V, z], [x + V, y, z], [x + V, y, z + V]], shade(side, 0.85));
      if (hw < hv) face([[x, hw * V, z], [x, hw * V, z + V], [x, y, z + V], [x, y, z]], shade(side, 0.85));
    }
  }
  const cube = (vx: number, vy: number, vz: number, c: RGB) => {
    const k = `${vx},${vy},${vz}`;
    if (solid.has(k)) return;
    solid.add(k);
    geo.box(compose(vx * V + V / 2, 0, vz * V + V / 2), V, V, V, (f) => ({ col: shade(c, [1, 0.92, 0.8, 0.85, 0.85, 0.6][f]!), mat: MAT.Prop }), vy * V);
  };
  for (let tz = Math.floor(z0 / 16); tz < z1 / 16; tz++) {
    for (let tx = Math.floor(x0 / 16); tx < x1 / 16; tx++) {
      const pl = propAt(g, tx, tz);
      if (pl.kind === P.None) continue;
      const wx = (tx + pl.ox) * 16, wz = (tz + pl.oy) * 16;
      const gy = Math.round(hf.height(wx, wz) / V);
      const cx = Math.floor(wx / V), cz = Math.floor(wz / V);
      if (pl.kind === P.Oak || pl.kind === P.Birch || pl.kind === P.Pine) {
        const th = 6 + Math.floor(pl.v * 3);
        const bark = pl.kind === P.Birch ? hex(0xe8e4dc) : hex(0x6e4c3c);
        for (let y = 0; y < th; y++) cube(cx, gy + y, cz, bark);
        const rad = pl.kind === P.Pine ? 3 : 4;
        const leafA = pl.kind === P.Pine ? hex(0x2c6450) : pl.kind === P.Birch ? hex(0xa8cc58) : hex(0x3f8a4c);
        const leafB = pl.kind === P.Pine ? hex(0x3f8466) : pl.kind === P.Birch ? hex(0xcfe07a) : hex(0x6eb455);
        for (let dy = -rad; dy <= rad + (pl.kind === P.Pine ? 4 : 0); dy++) {
          const rr = pl.kind === P.Pine ? Math.max(0, rad - (dy + rad) * 0.45) : Math.sqrt(Math.max(0, rad * rad - dy * dy));
          for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dz * dz > rr * rr + 0.5) continue;
            if (hash01(9, cx + dx, cz + dz, dy) < 0.12) continue;
            cube(cx + dx, gy + th + rad - 1 + dy, cz + dz, mixc(leafA, leafB, (dy + rad) / (rad * 2) + hash01(3, dx, dy, dz) * 0.2));
          }
        }
      } else if (pl.kind === P.Bush || pl.kind === P.Flowers || pl.kind === P.Rock || pl.kind === P.Boulder || pl.kind === P.Reeds) {
        const c = pl.kind === P.Flowers ? hex([0xf3cf3b, 0xee7a9a, 0xf6f1e4][Math.floor(pl.v * 3)]!) : pl.kind === P.Bush ? hex(0x4f9a4a) : pl.kind === P.Reeds ? hex(0x8aa84e) : hex(0x8e8a88);
        cube(cx, gy, cz, c);
        if (pl.kind === P.Bush || pl.kind === P.Boulder) { cube(cx + 1, gy, cz, c); cube(cx, gy + 1, cz, shade(c, 1.1)); }
        if (pl.kind === P.Reeds) { cube(cx, gy + 1, cz, c); cube(cx, gy + 2, cz, hex(0x7a4e32)); }
      }
    }
  }
  // two voxel figures (Cube World-ish: big head, block body)
  const fig = (wx: number, wz: number, skin: RGB, cloth: RGB, ears: number) => {
    const cx = Math.floor(wx / V), cz = Math.floor(wz / V), gy = Math.round(hf.height(wx, wz) / V);
    for (const dx of [0, 2]) { cube(cx + dx, gy, cz, hex(0x4a4058)); cube(cx + dx, gy + 1, cz, hex(0x4a4058)); }
    for (let y = 2; y < 4; y++) for (let dx = 0; dx < 3; dx++) cube(cx + dx, gy + y, cz, cloth);
    for (let y = 4; y < 7; y++) for (let dx = -1; dx < 4; dx++) for (let dz = -1; dz < 2; dz++) cube(cx + dx, gy + y, cz + dz, skin);
    if (ears) { cube(cx - 1, gy + 7, cz, skin); cube(cx + 3, gy + 7, cz, skin); cube(cx - 1, gy + 8, cz, skin); cube(cx + 3, gy + 8, cz, skin); }
  };
  fig(1650, 960, hex(0xe8833a), hex(0x3f8fbf), 1);
  fig(1700, 1000, hex(0xf0c09a), hex(0xd0483e), 0);

  const gl = r.gl;
  const p = program(gl, "vox", PROP_VS, PROP_FS);
  const sp = program(gl, "vox-shadow", PROP_SHADOW_VS, SHADOW_FS);
  const m: Mesh = mesh(gl, [
    { loc: LOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(geo.pos) },
    { loc: LOC.nrm, size: 3, type: gl.FLOAT, normalized: false, data: new Float32Array(geo.nrm) },
    { loc: LOC.col, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(geo.col) },
    { loc: LOC.aux, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: new Uint8Array(geo.aux) },
  ], geo.vertexCount);
  const d: Drawable = {
    shadow(gl: GL, f: FrameInfo) {
      gl.useProgram(sp.prog);
      gl.uniformMatrix4fv(sp.u.uLightViewProj!, false, f.lightViewProj);
      drawMesh(gl, m);
    },
    main(gl: GL, f: FrameInfo) {
      gl.useProgram(p.prog);
      f.setLight(p);
      drawMesh(gl, m);
    },
  };
  r.drawables.push(d);
  r.focus = [fx, 20, fz];
  r.render(1);
  r.render(1);
  console.log(`voxel tris ${geo.vertexCount / 3}`);
}
