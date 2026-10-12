// Finds the highest mountain tile near the origin for a seed (for snow captures): npx tsx tools/find-high.ts <seed>
import { createWorldFields } from "../../sim/src/world/biome-map";
import { generateChunk } from "../../sim/src/world/chunk-gen";
const seed = Number(process.argv[2] ?? 4);
const f = createWorldFields(seed);
let best = { e: 0, x: 0, y: 0, cliffs: 0 };
for (let cy = -6; cy < 6; cy++) for (let cx = -6; cx < 6; cx++) {
  const c = generateChunk(seed, cx, cy);
  let cliffs = 0;
  for (let i = 0; i < 1024; i++) if (c.tiles[i] === 4) cliffs++;
  const e = f.elevation(cx * 32 + 16, cy * 32 + 16);
  if (c.biomes[528] === 3 && e + cliffs * 0.0005 > best.e + best.cliffs * 0.0005 && e < 0.8) best = { e, x: cx * 512 + 256, y: cy * 512 + 256, cliffs };
}
console.log(seed, best);
