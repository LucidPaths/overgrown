// GPU upload of a meshed character. Materials switch per pixel, not per vertex: every triangle carries the same
// three material ids on all three corners and per-corner weights for them, and the fragment shader picks the
// largest interpolated weight. Seams between materials are then crisp curves at any zoom (the GGXrd rule:
// information in the mesh, resolution independent). Corners are shared wherever their records agree.
import { mesh, type GL, type Mesh } from "../../../src/gl/glu";
import type { RawMesh } from "../sdf/mesher";

export const CLOC = { pos: 0, nrm: 1, boneI: 2, boneW: 3, matI: 4, matW: 5 } as const;

export interface CharGeo {
  pos: Float32Array<ArrayBuffer>;
  nrm: Float32Array<ArrayBuffer>;
  boneI: Uint8Array<ArrayBuffer>;
  boneW: Uint8Array<ArrayBuffer>;
  matI: Uint8Array<ArrayBuffer>;
  matW: Uint8Array<ArrayBuffer>;
  index: Uint32Array<ArrayBuffer>;
  vertexCount: number;
}

export function toCharGeo(r: RawMesh): CharGeo {
  const I = r.index;
  const map = new Map<string, number>();
  const pos: number[] = [], nrm: number[] = [], bi: number[] = [], bw: number[] = [], mi: number[] = [], mw: number[] = [], idx: number[] = [];
  const weightOf = (v: number, m: number) => {
    const m0 = r.mat[v * 4]!, m1 = r.mat[v * 4 + 1]!, t = r.mat[v * 4 + 2]! / 255;
    return (m0 === m ? 1 - t : 0) + (m1 === m ? t : 0);
  };
  for (let t = 0; t < I.length; t += 3) {
    // the triangle's material set: up to three ids by total weight
    const tot = new Map<number, number>();
    for (let c = 0; c < 3; c++) {
      const v = I[t + c]!;
      const m0 = r.mat[v * 4]!, m1 = r.mat[v * 4 + 1]!, tt = r.mat[v * 4 + 2]! / 255;
      tot.set(m0, (tot.get(m0) ?? 0) + 1 - tt);
      tot.set(m1, (tot.get(m1) ?? 0) + tt);
    }
    const ms = [...tot.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map((e) => e[0]);
    while (ms.length < 3) ms.push(ms[0]!);
    for (let c = 0; c < 3; c++) {
      const v = I[t + c]!;
      const w = ms.map((m, i) => (ms.indexOf(m) === i ? weightOf(v, m) : 0));
      const key = `${v}|${ms[0]},${ms[1]},${ms[2]}|${w.map((x) => Math.round(x * 255)).join(",")}`;
      let ni = map.get(key);
      if (ni === undefined) {
        ni = pos.length / 3;
        map.set(key, ni);
        pos.push(r.pos[v * 3]!, r.pos[v * 3 + 1]!, r.pos[v * 3 + 2]!);
        nrm.push(r.nrm[v * 3]!, r.nrm[v * 3 + 1]!, r.nrm[v * 3 + 2]!);
        for (let k = 0; k < 4; k++) { bi.push(r.boneIdx[v * 4 + k]!); bw.push(r.boneW[v * 4 + k]!); }
        mi.push(ms[0]!, ms[1]!, ms[2]!, r.layer[v]!);
        mw.push(Math.round(w[0]! * 255), Math.round(w[1]! * 255), Math.round(w[2]! * 255), r.mat[v * 4 + 3]!);
      }
      idx.push(ni);
    }
  }
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm), boneI: new Uint8Array(bi), boneW: new Uint8Array(bw),
    matI: new Uint8Array(mi), matW: new Uint8Array(mw), index: new Uint32Array(idx), vertexCount: pos.length / 3,
  };
}

export function uploadChar(gl: GL, g: CharGeo): Mesh {
  return mesh(gl, [
    { loc: CLOC.pos, size: 3, type: gl.FLOAT, normalized: false, data: g.pos },
    { loc: CLOC.nrm, size: 3, type: gl.FLOAT, normalized: false, data: g.nrm },
    { loc: CLOC.boneI, size: 4, type: gl.UNSIGNED_BYTE, normalized: false, data: g.boneI },
    { loc: CLOC.boneW, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: g.boneW },
    { loc: CLOC.matI, size: 4, type: gl.UNSIGNED_BYTE, normalized: false, data: g.matI },
    { loc: CLOC.matW, size: 4, type: gl.UNSIGNED_BYTE, normalized: true, data: g.matW },
  ], g.vertexCount, g.index);
}
