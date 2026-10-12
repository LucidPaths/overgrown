// Screenshot sequence of a live page: node tools/seq.mjs <url> <outPrefix> <count> <everyMs> [w h dpr] [startDelayMs] [touch]
import { chromium } from "playwright-core";
const [url, out, count = "6", every = "500", w = "1280", h = "720", dpr = "1", delay = "2000", touch = "0"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: touch === "1", isMobile: touch === "1" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.sketchDone === true, null, { timeout: 120000 });
await page.waitForTimeout(+delay);
for (let i = 0; i < +count; i++) {
  await page.screenshot({ path: `${out}-${String(i).padStart(2, "0")}.png` });
  await page.waitForTimeout(+every);
}
await browser.close();
