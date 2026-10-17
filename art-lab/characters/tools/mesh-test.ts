// node: npx tsx characters/tools/mesh-test.ts — meshes each species, prints timing, size and winding check
import { Field } from "../src/sdf/field";
import { meshField } from "../src/sdf/mesher";
import { SPECIES, buildSpecies } from "../src/body/species";
for (const s of SPECIES) {
  const { model } = buildSpecies(s);
  const f = new Field(model);
  const h = Number(process.argv[2] ?? 0.4);
  const r = meshField(f, { min: [-14, -1, -14], max: [14, 40, 14], h });
  // winding: face normal vs vertex normal
  let good = 0, bad = 0;
  const P = r.pos, N = r.nrm, I = r.index;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!, b = I[t + 1]!, c = I[t + 2]!;
    const ux = P[b * 3]! - P[a * 3]!, uy = P[b * 3 + 1]! - P[a * 3 + 1]!, uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
    const vx = P[c * 3]! - P[a * 3]!, vy = P[c * 3 + 1]! - P[a * 3 + 1]!, vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const d = nx * N[a * 3]! + ny * N[a * 3 + 1]! + nz * N[a * 3 + 2]!;
    if (d > 0) good++; else bad++;
  }
  console.log(s.name, `${r.vertexCount} verts, ${I.length / 3} tris, ${r.ms.toFixed(0)} ms, winding good ${good} bad ${bad}`);
}
