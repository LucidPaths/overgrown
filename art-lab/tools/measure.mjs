// Perf meter for the lab prototype, using the repo's own recipe (scripts/perf-profiles.mjs):
//  - cold start: phone 390x844 DPR 3 + touch, 4x CPU throttle, slow 4G, no HTTP cache; time to the
//    "overgrown:first-frame" mark (first frame with a snapshot, the player drawn and the ground built) and bytes;
//  - fps: desktop 1280x720 and phone, unthrottled network, frames counted over 8 s after the first frame.
// Headless Chromium renders WebGL with SwiftShader (CPU): fps compares costs, it is not a GPU or phone fps.
// Usage: node tools/measure.mjs <url> [runs]
import { chromium } from "playwright-core";
import { DESKTOP, PHONE, SLOW_4G, openPage } from "../../scripts/perf-profiles.mjs";

const [url, runsArg = "3"] = process.argv.slice(2);
if (!url) { console.error("usage: node tools/measure.mjs <url> [runs]"); process.exit(2); }
const MARK = "overgrown:first-frame";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
const cold = [];
let bytes = null;
for (let run = 0; run < Number(runsArg); run++) {
  const { context, page } = await openPage(browser, PHONE, SLOW_4G);
  const b = { js: 0, other: 0, total: 0, files: {} };
  const pending = [];
  page.on("requestfinished", (r) => pending.push(r.sizes().then((s) => {
    const u = r.url().split("?")[0];
    const k = /\.m?js$/.test(u) ? "js" : "other";
    b[k] += s.responseBodySize; b.total += s.responseBodySize;
    b.files[u.replace(/^https?:\/\/[^/]+/, "")] = s.responseBodySize;
  })));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction((m) => performance.getEntriesByName(m).length > 0, MARK, { timeout: 120000 });
  const t = await page.evaluate((m) => {
    const nav = performance.getEntriesByType("navigation")[0];
    return { firstFrameMs: Math.round(performance.getEntriesByName(m)[0].startTime), domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd) };
  }, MARK);
  await Promise.all(pending);
  cold.push(t);
  bytes = b;
  await context.close();
}

async function fps(profile) {
  const { context, page } = await openPage(browser, profile, null);
  await page.goto(url);
  await page.waitForFunction((m) => performance.getEntriesByName(m).length > 0, MARK, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now(); const frameTimes = []; let last = t0;
    const f = (t) => { n++; frameTimes.push(t - last); last = t; if (t - t0 < 8000) requestAnimationFrame(f); else res({ fps: (n * 1000) / (t - t0), worstMs: Math.max(...frameTimes) }); };
    requestAnimationFrame(f);
  }));
  await context.close();
  return { profile: profile.name, fps: Math.round(r.fps * 10) / 10, worstFrameMs: Math.round(r.worstMs) };
}
const fpsDesktop = await fps(DESKTOP);
const fpsPhone = await fps(PHONE);
await browser.close();
const ff = cold.map((c) => c.firstFrameMs).sort((a, b) => a - b);
console.log(JSON.stringify({
  url, coldStart: { profile: "phone+slow4g+cpu4", runs: cold, medianFirstFrameMs: ff[ff.length >> 1] },
  bytes: { js: bytes.js, other: bytes.other, total: bytes.total, byteFloorMs: Math.round((bytes.total / SLOW_4G.downloadThroughput) * 1000), files: bytes.files },
  fps: [fpsDesktop, fpsPhone], note: "fps is SwiftShader (software WebGL): relative cost only", errors,
}, null, 2));
