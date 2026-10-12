// Prints an ASCII biome/tile map around the origin for a seed, to pick framing for sketches.
import { generateChunk } from "../../sim/src/world/chunk-gen";
const seed = Number(process.argv[2] ?? 1);
const R = Number(process.argv[3] ?? 4);
const step = Number(process.argv[4] ?? 4);
const ch = "GFRMO";
const tl = ".,s^#~=@";
const chunks = new Map<string, ReturnType<typeof generateChunk>>();
const get = (cx: number, cy: number) => {
  const k = cx + "," + cy;
  let c = chunks.get(k);
  if (!c) chunks.set(k, (c = generateChunk(seed, cx, cy)));
  return c;
};
const ox = Number(process.argv[5] ?? 0), oy = Number(process.argv[6] ?? 0);
for (let ty = oy - R * 32; ty < oy + R * 32; ty += step) {
  let line = "";
  for (let tx = ox - R * 32; tx < ox + R * 32; tx += step) {
    const cx = Math.floor(tx / 32), cy = Math.floor(ty / 32);
    const c = get(cx, cy);
    const i = (ty - cy * 32) * 32 + (tx - cx * 32);
    const t = c.tiles[i]!;
    line += t === 0 || t === 1 ? ch[c.biomes[i]!] : tl[t];
  }
  console.log(line);
}
