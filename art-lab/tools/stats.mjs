import { chromium } from "playwright-core";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.argv[2]);
await p.waitForFunction(() => window.sketchDone === true, null, { timeout: 120000 });
await p.waitForTimeout(6000);
console.log(await p.evaluate(() => {
  const l = window.__lab;
  let tv = 0, wv = 0, cv = 0;
  for (const c of l.terrain.chunks.values()) { tv += c.ground.count; wv += c.water ? c.water.count : 0; cv += c.cliff ? c.cliff.count : 0; }
  const fo = l.r.focus, hw = l.r.iw / 2, hd = l.r.ih / 2 / Math.sin(52 * Math.PI / 180);
  const v = { x0: fo[0] - hw - 48, x1: fo[0] + hw + 48, z0: fo[2] - hd - 64, z1: fo[2] + hd + 180 };
  const sees = (cx, cy, pad) => cx * 512 + 512 > v.x0 - pad && cx * 512 < v.x1 + pad && cy * 512 + 512 > v.z0 - pad && cy * 512 < v.z1 + pad;
  let mainV = 0, shadowV = 0;
  const el = Math.max(0.2, l.r.lighting.sunDir[1]); const pad = Math.min(256, (70 * Math.sqrt(1 - el * el)) / el);
  for (const [k, m] of l.props.meshes) { const [cx, cy] = k.split(",").map(Number); const n = (m.cast?.count ?? 0) + (m.small?.count ?? 0); if (sees(cx, cy, 0)) mainV += n; if (sees(cx, cy, pad)) shadowV += m.cast?.count ?? 0; }
  return JSON.stringify({ propVertsDrawnMain: mainV, propVertsDrawnShadow: shadowV, chunks: l.terrain.chunks.size, terrainIdx: tv, waterVerts: wv, cliffVerts: cv, propVerts: l.props.stats.verts, actors: l.actors.list.length, gbuffer: [l.r.iw, l.r.ih], scale: l.r.scale });
}));
await b.close();
