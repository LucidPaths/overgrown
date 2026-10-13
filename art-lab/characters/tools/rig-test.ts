// node: npx tsx characters/tools/rig-test.ts — rest pose must give identity skin matrices
import { buildSpecies, SPECIES } from "../src/body/species";
import { newPose, newPosed, fk, skin, placeM } from "../src/rig/pose";
import { BONES, BONE_NAMES } from "../src/rig/skeleton";
for (const s of SPECIES) {
  const { j } = buildSpecies(s);
  const p = newPose(), ps = newPosed();
  fk(j.sk, p, ps);
  const out = new Float32Array(BONES * 16);
  skin(j.sk, p, ps, placeM(0, 0, 0, 0), out);
  let worst = 0, wb = -1;
  for (let b = 0; b < BONES; b++) {
    for (let i = 0; i < 16; i++) {
      const e = Math.abs(out[b * 16 + i]! - (i % 5 === 0 ? 1 : 0));
      if (e > worst) { worst = e; wb = b; }
    }
  }
  console.log(s.name, "max deviation from identity", worst.toFixed(5), "at", BONE_NAMES[wb]);
}
