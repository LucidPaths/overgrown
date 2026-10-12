/* global window, performance */
// Cold-start meter: phone profile + slow 4G + 4x CPU, fresh context and no HTTP cache per run (scripts/perf-profiles.mjs).
// Usage: node scripts/measure-startup.mjs <url> [runs] [shot.png]
// Prints one JSON object; times are ms since navigation start, rounded. Median of an even count = mean of the two middle values.
// Exit codes: 0 = ok, 1 = console/page errors, 2 = usage error.
import path from "node:path";
import { chromium } from "playwright-core";
import { PHONE, SLOW_4G, openPage } from "./perf-profiles.mjs";

const USAGE = "usage: node scripts/measure-startup.mjs <url> [runs] [shot.png]";
const MARK = "overgrown:first-frame";
const MARK_TIMEOUT_MS = 60000;
const SHOT_WAIT_MS = 3000;
const KEYS = ["firstFrameMs", "workerCreatedMs", "atlasJsonEndMs", "firstSnapshotMs", "firstChunkMs"];

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 3) {
  console.error(USAGE);
  process.exit(2);
}
const [url, runsArg = "5", shotArg] = args;
if (!/^[1-9]\d*$/.test(runsArg)) {
  console.error(USAGE);
  process.exit(2);
}
const runs = Number(runsArg);
const screenshotPath = shotArg ? path.resolve(shotArg) : null;

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};
const isAtlas = (u) => u.endsWith("generated/core.json") || u.endsWith("generated/core.png");

const errors = [];
const results = [];
let bytes = { js: 0, atlas: 0, other: 0, total: 0 };
let screenshot = null;
const browser = await chromium.launch();
try {
  for (let run = 0; run < runs; run++) {
    const { context, page } = await openPage(browser, PHONE, SLOW_4G);
    try {
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      const pending = [];
      const runBytes = { js: 0, atlas: 0, other: 0, total: 0 };
      page.on("requestfinished", (request) => {
        pending.push(
          request.sizes().then((sizes) => {
            const u = request.url().split("?")[0];
            const kind = isAtlas(u) ? "atlas" : /\.m?js$/.test(u) ? "js" : "other";
            runBytes[kind] += sizes.responseBodySize;
            runBytes.total += sizes.responseBodySize;
          }),
        );
      });
      await page.addInitScript(() => {
        const t = (window.__startup = {});
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(scriptURL, options) {
            super(scriptURL, options);
            if (!String(scriptURL).includes("sim-worker")) return;
            t.workerCreatedMs = performance.now();
            this.addEventListener("message", (event) => {
              const type = event.data && event.data.type;
              if (type === "snapshot" && t.firstSnapshotMs === undefined) t.firstSnapshotMs = performance.now();
              if (type === "chunk" && t.firstChunkMs === undefined) t.firstChunkMs = performance.now();
            });
          }
        };
      });
      await page.goto(url);
      await page.waitForFunction((mark) => performance.getEntriesByName(mark).length > 0, MARK, {
        timeout: MARK_TIMEOUT_MS,
      });
      const read = await page.evaluate((mark) => {
        const atlas = performance.getEntriesByType("resource").find((e) => e.name.split("?")[0].endsWith("generated/core.json"));
        return {
          firstFrameMs: performance.getEntriesByName(mark)[0].startTime,
          atlasJsonEndMs: atlas ? atlas.responseEnd : undefined,
          ...window.__startup,
        };
      }, MARK);
      // A missing measurement is an error, never a 0 (e.g. the sim worker moved and no longer matches "sim-worker").
      const missing = KEYS.filter((k) => read[k] === undefined);
      if (missing.length > 0) {
        errors.push(`run ${run + 1}: missing measurement(s): ${missing.join(", ")}`);
      } else {
        results.push(Object.fromEntries(KEYS.map((k) => [k, Math.round(read[k])])));
      }
      if (run === runs - 1 && screenshotPath) {
        await page.waitForTimeout(SHOT_WAIT_MS);
        await page.screenshot({ path: screenshotPath });
        screenshot = screenshotPath;
      }
      await Promise.all(pending);
      bytes = runBytes;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const frames = results.map((r) => r.firstFrameMs);
console.log(
  JSON.stringify(
    {
      url,
      profile: "phone+slow4g+cpu4",
      runs: results,
      median: Object.fromEntries(KEYS.map((k) => [k, median(results.map((r) => r[k]))])),
      min: { firstFrameMs: Math.min(...frames) },
      max: { firstFrameMs: Math.max(...frames) },
      bytes,
      byteFloorMs: Math.round((bytes.total / SLOW_4G.downloadThroughput) * 1000),
      screenshot,
      errors,
    },
    null,
    2,
  ),
);
process.exit(errors.length === 0 ? 0 : 1);
