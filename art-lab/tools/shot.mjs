// Headless screenshot: node tools/shot.mjs <url> <out.png> [width height dpr] [waitForGlobal] [extraWaitMs]
import { chromium } from "playwright-core";
const [url, out, w = "1280", h = "720", dpr = "1", flag = "sketchDone", extra = "0"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(url);
if (flag !== "none") await page.waitForFunction((f) => window[f] === true, flag, { timeout: 90000 });
await page.waitForTimeout(+extra);
await page.screenshot({ path: out });
await browser.close();
