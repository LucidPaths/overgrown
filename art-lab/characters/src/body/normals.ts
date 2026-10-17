// Shading normals. A cel terminator draws every lump of a smooth-min body as a blotch, so the normals are pulled
// toward simple proxy forms (Arc System Works edits normals by hand for the same reason): a sphere for the head,
// capsules along the limbs, an elliptic cylinder for the torso. Each vertex blends the proxies of its skin bones
// by its skin weights, then mixes the result with the true normal. Silhouettes keep the real shape; the light
// falls across simple forms.
import type { RawMesh } from "../sdf/mesher";
import { B, BONES, PARENT, type Skeleton } from "../rig/skeleton";
import type { Build } from "./build";

const TORSO = new Set<number>([B.pelvis, B.spine, B.chest, B.root]);
/** bones whose shapes are flat or hard (blades, ears): they keep their true normals */
const KEEP = new Set<number>([B.weapon, B.offhand, B.earL, B.earL2, B.earR, B.earR2]);

export function proxyNormals(r: RawMesh, sk: Skeleton, b: Build, headC: [number, number, number], amount = 0.6): void {
  const P = sk.pos;
  // segment per bone: from its joint to its main child (or along its frame for leaves)
  const seg: [number[], number[]][] = [];
  for (let i = 0; i < BONES; i++) {
    const c = PARENT.indexOf(i);
    const a = P[i]!;
    if (c >= 0 && sk.len[i]! > 0.3) seg.push([a, P[c]!]);
    else {
      const rr = sk.rot[i]!; // leaf: 2 px back along -y
      seg.push([a, [a[0] - rr[3] * 2, a[1] - rr[4] * 2, a[2] - rr[5] * 2]]);
    }
  }
  const spineA = P[B.pelvis]!, spineB = P[B.head]!;
  const n = r.vertexCount;
  for (let v = 0; v < n; v++) {
    const x = r.pos[v * 3]!, y = r.pos[v * 3 + 1]!, z = r.pos[v * 3 + 2]!;
    let px = 0, py = 0, pz = 0;
    for (let k = 0; k < 4; k++) {
      const bone = r.boneIdx[v * 4 + k]!, w = r.boneW[v * 4 + k]! / 255;
      if (w <= 0) continue;
      let nx: number, ny: number, nz: number;
      if (KEEP.has(bone)) {
        nx = r.nrm[v * 3]!; ny = r.nrm[v * 3 + 1]!; nz = r.nrm[v * 3 + 2]!;
      } else if (bone === B.head || bone === B.jaw) {
        // the head: a sphere, squashed like the skull
        nx = (x - headC[0]) / b.head[0]; ny = (y - headC[1]) / b.head[1]; nz = (z - headC[2]) / b.head[2];
      } else {
        const [a, c] = TORSO.has(bone) ? [spineA, spineB] : seg[bone]!;
        const dx = c[0]! - a[0]!, dy = c[1]! - a[1]!, dz = c[2]! - a[2]!;
        const l2 = dx * dx + dy * dy + dz * dz || 1;
        let t = ((x - a[0]!) * dx + (y - a[1]!) * dy + (z - a[2]!) * dz) / l2;
        t = Math.max(0, Math.min(1, t));
        nx = x - (a[0]! + dx * t); ny = y - (a[1]! + dy * t); nz = z - (a[2]! + dz * t);
        if (TORSO.has(bone)) { nx /= b.chest[0]; nz /= b.chest[2]; ny /= b.chest[1] * 1.5; }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      px += (nx / l) * w; py += (ny / l) * w; pz += (nz / l) * w;
    }
    const pl = Math.hypot(px, py, pz);
    if (pl < 1e-4) continue;
    const tx = r.nrm[v * 3]!, ty = r.nrm[v * 3 + 1]!, tz = r.nrm[v * 3 + 2]!;
    // never flip: on concave seams the proxy may face away from the true normal
    const d = (px * tx + py * ty + pz * tz) / pl;
    const a = d > 0 ? amount : amount * Math.max(0, 1 + d);
    const mx = tx * (1 - a) + (px / pl) * a, my = ty * (1 - a) + (py / pl) * a, mz = tz * (1 - a) + (pz / pl) * a;
    const ml = Math.hypot(mx, my, mz) || 1;
    r.nrm[v * 3] = mx / ml; r.nrm[v * 3 + 1] = my / ml; r.nrm[v * 3 + 2] = mz / ml;
  }
}
