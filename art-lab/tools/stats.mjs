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
  return JSON.stringify({ chunks: l.terrain.chunks.size, terrainIdx: tv, waterVerts: wv, cliffVerts: cv, propVerts: l.props.stats.verts, actors: l.actors.list.length, gbuffer: [l.r.iw, l.r.ih], scale: l.r.scale });
}));
await b.close();
