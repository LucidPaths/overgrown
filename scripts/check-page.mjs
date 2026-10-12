// Headless page checker: loads a URL, reports canvas info and page errors as JSON.
// Usage: node scripts/check-page.mjs <url> [screenshot.png | -] [waitMs]
// Exit codes: 0 = no errors, 1 = errors found, 2 = usage error.
import path from "node:path";
import { chromium } from "playwright-core";

const USAGE = "usage: node scripts/check-page.mjs <url> [screenshot.png | -] [waitMs]";
const VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_WAIT_MS = 1000;

function usageError() {
  console.error(USAGE);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 3) usageError();
const [url, shotArg = "-", waitArg = String(DEFAULT_WAIT_MS)] = args;
if (!/^\d+$/.test(waitArg)) usageError();
const waitMs = Number(waitArg);
const screenshotPath = shotArg === "-" ? null : path.resolve(shotArg);

const errors = [];
let canvases = [];
let screenshot = null;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  let navigated = false;
  try {
    const response = await page.goto(url, { waitUntil: "load" });
    navigated = true;
    if (response && response.status() >= 400) {
      errors.push(`navigation: HTTP ${response.status()}`);
    }
  } catch (err) {
    // Playwright appends a multi-line call log; the first line is the reason.
    const reason = err instanceof Error ? err.message : String(err);
    errors.push(`navigation: ${reason.split("\n")[0]}`);
  }

  if (navigated) {
    await page.waitForTimeout(waitMs);
    canvases = await page.$$eval("canvas", (els) =>
      els.map((c) => {
        const rect = c.getBoundingClientRect();
        return {
          width: c.width,
          height: c.height,
          cssWidth: Math.round(rect.width),
          cssHeight: Math.round(rect.height),
        };
      }),
    );
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath });
      screenshot = screenshotPath;
    }
  }
} finally {
  await browser.close();
}

console.log(
  JSON.stringify({ url, canvas: canvases.length > 0, canvases, errors, screenshot }, null, 2),
);
process.exit(errors.length === 0 ? 0 : 1);
