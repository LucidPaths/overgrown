// node: npx tsx characters/tools/skin-test.ts — skin the stage pose on the CPU and report vertices that fly away
import { buildLook } from "../src/body/look";
import { newPose, newPosed, fk, skin, placeM, setRot } from "../src/rig/pose";
import { B, BONES, BONE_NAMES } from "../src/rig/skeleton";
const built = buildLook({ species: 0, gear: ["tunic", "trousers", "boots", "belt"], weapon: "sword" });
const p = newPose(), ps = newPosed();
setRot(p, B.armL, -0.05, 0, -0.5); setRot(p, B.armR, -0.05, 0, 0.5); setRot(p, B.foreL, -0.25); setRot(p, B.foreR, -0.6);
fk(built.sk, p, ps);
const M = new Float32Array(BONES * 16);
skin(built.sk, p, ps, placeM(0, 0, 0, 0), M);
const r = built.raw;
let bad = 0;
const hist = new Map<string, number>();
for (let v = 0; v < r.vertexCount; v++) {
  const x = r.pos[v * 3]!, y = r.pos[v * 3 + 1]!, z = r.pos[v * 3 + 2]!;
  let ox = 0, oy = 0, oz = 0;
  for (let k = 0; k < 4; k++) {
    const b = r.boneIdx[v * 4 + k]!, w = r.boneW[v * 4 + k]! / 255;
    const m = M.subarray(b * 16, b * 16 + 16);
    ox += w * (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!);
    oy += w * (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!);
    oz += w * (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
  }
  const d = Math.hypot(ox - x, oy - y, oz - z);
  if (d > 8) {
    bad++;
    const key = [0, 1, 2, 3].map((k) => `${BONE_NAMES[r.boneIdx[v * 4 + k]!]}:${r.boneW[v * 4 + k]}`).join(" ");
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
}
console.log("verts", r.vertexCount, "flying", bad);
console.log([...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
import { toCharGeo } from "../src/render/char-mesh";
const g = toCharGeo(r);
let bad2 = 0, maxIdx = 0;
for (let v = 0; v < g.vertexCount; v++) {
  let ws = 0;
  for (let k = 0; k < 4; k++) { ws += g.boneW[v * 4 + k]!; maxIdx = Math.max(maxIdx, g.boneI[v * 4 + k]!); }
  if (ws !== 255) bad2++;
}
let maxI = 0; for (const i of g.index) maxI = Math.max(maxI, i);
console.log("chargeo verts", g.vertexCount, "weight sum != 255:", bad2, "max bone", maxIdx, "max index", maxI, "tris", g.index.length / 3);
