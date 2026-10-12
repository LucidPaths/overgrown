/* global window, document, performance, requestAnimationFrame */
// Frame-rate meter: idle and walking, under a locked emulation profile (scripts/perf-profiles.mjs).
// Usage: node scripts/measure-fps.mjs <url> <phone|desktop> [runs]
// Prints one JSON object (each metric is the median over runs). Exit codes: 0 = ok, 1 = console/page errors, 2 = usage error.
// p95 = nearest-rank (the value at sorted index ceil(0.95 n) - 1); median of an even count = mean of the two middle values.
// Headless Chromium is software-rendered (SwiftShader): compare fill costs, do not read it as a phone fps.
import { chromium } from "playwright-core";
import { DESKTOP, PHONE, openPage } from "./perf-profiles.mjs";

const USAGE = "usage: node scripts/measure-fps.mjs <url> <phone|desktop> [runs]";
const PROFILES = { phone: PHONE, desktop: DESKTOP };
const MARK = "overgrown:first-frame";
const MARK_TIMEOUT_MS = 30000;
const SETTLE_MS = 2000;
const WINDOW_MS = 5000;

const args = process.argv.slice(2);
if (args.length < 2 || args.length > 3) {
  console.error(USAGE);
  process.exit(2);
}
const [url, profileName, runsArg = "3"] = args;
const profile = PROFILES[profileName];
if (!profile || !/^[1-9]\d*$/.test(runsArg)) {
  console.error(USAGE);
  process.exit(2);
}
const runs = Number(runsArg);

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const round1 = (n) => Math.round(n * 10) / 10;

function summarize(deltas) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    fps: round1((1000 * deltas.length) / sum),
    p95Ms: round1(sorted[Math.ceil(0.95 * sorted.length) - 1]),
    maxMs: round1(sorted[sorted.length - 1]),
  };
}

/** Collect rAF deltas for WINDOW_MS. */
async function collect(page) {
  await page.evaluate(() => {
    window.__deltas = [];
    window.__collect = true;
  });
  await page.waitForTimeout(WINDOW_MS);
  return page.evaluate(() => {
    window.__collect = false;
    return window.__deltas;
  });
}

const errors = [];
const results = [];
let canvas = null;
const browser = await chromium.launch();
try {
  for (let run = 0; run < runs; run++) {
    const { context, page } = await openPage(browser, profile);
    try {
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      await page.addInitScript(() => {
        window.__collect = false;
        window.__deltas = [];
        let last = 0;
        const tick = (now) => {
          if (window.__collect && last > 0) window.__deltas.push(now - last);
          last = now;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(url);
      await page.waitForFunction((mark) => performance.getEntriesByName(mark).length > 0, MARK, {
        timeout: MARK_TIMEOUT_MS,
      });
      await page.waitForTimeout(SETTLE_MS);
      canvas = await page.evaluate(() => {
        const c = document.querySelector("canvas");
        return [c.width, c.height];
      });
      const idle = summarize(await collect(page));
      await page.keyboard.down("ShiftLeft");
      await page.keyboard.down("KeyD");
      const walk = summarize(await collect(page));
      await page.keyboard.up("KeyD");
      await page.keyboard.up("ShiftLeft");
      results.push({ idle, walk });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const pick = (phase) => ({
  fps: round1(median(results.map((r) => r[phase].fps))),
  p95Ms: round1(median(results.map((r) => r[phase].p95Ms))),
  maxMs: round1(median(results.map((r) => r[phase].maxMs))),
});
console.log(
  JSON.stringify({ url, profile: profile.name, runs, canvas, idle: pick("idle"), walk: pick("walk"), errors }, null, 2),
);
process.exit(errors.length === 0 ? 0 : 1);
