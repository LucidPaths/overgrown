import { generateChunk } from "../../sim/src/world/chunk-gen";
import { createChunkStore } from "../../sim/src/world/chunk-store";
import { findSpawn } from "../../sim/src/world/spawn";
for (let seed = 1; seed <= 40; seed++) {
  const sp = findSpawn(createChunkStore(seed));
  const scx = Math.floor(sp.x / 512), scy = Math.floor(sp.y / 512);
  const counts = [0, 0, 0, 0, 0];
  const tcount = new Array(8).fill(0);
  for (let cy = scy - 1; cy <= scy + 1; cy++) for (let cx = scx - 1; cx <= scx + 1; cx++) {
    const c = generateChunk(seed, cx, cy);
    for (let i = 0; i < 1024; i++) { counts[c.biomes[i]!]++; tcount[c.tiles[i]!]++; }
  }
  console.log(seed, "spawn", sp.x | 0, sp.y | 0, "G F R M O", counts.join(" "), "tiles", tcount.join(" "));
}
