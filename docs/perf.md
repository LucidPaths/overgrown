# Performance numbers

One living page. Each task that measures something adds its row here. Scripts: `scripts/measure-fps.mjs`, `scripts/measure-startup.mjs`; the emulation recipe lives only in `scripts/perf-profiles.mjs`.

## 1. What this measures, and what it can't

Headless Chromium renders with SwiftShader, a CPU rasterizer. Its fps scales with the number of pixels filled and says nothing absolute about a phone GPU. CPU throttling (`Emulation.setCPUThrottlingRate`) is relative to the host CPU and may not apply to workers. Timings also move with the host's load; every number below records the 1-minute load average from just before the run (the headless browser itself pushes it above 1.5 while measuring, so "before" is the quiet baseline).

**No real phone was measured by any agent.** The real-phone numbers come from the manual check in section 4.

## 2. Render resolution (TEC-020)

Rule: `resolution = dpr / ceil(dpr / 2)` (`client/src/render/resolution.ts`). The canvas backing store is `dpr / k` times the CSS size and the browser upscales it by exactly `k` (nearest, `image-rendering: pixelated`), so every art pixel stays a whole number of device pixels. `?maxdpr=1..4` overrides the cap of 2 for measuring. The resolution is recomputed when the devicePixelRatio changes (browser zoom, another screen).

Why not `Math.min(dpr, 2)` (measured while drafting the spec, main a137bd1, SwiftShader): at 412x915 DPR 2.625 it upscales x1.3125, and art pixels come out as a mix of 3- and 4-device-px blocks (character 79x118 device px); at DPR 3 a mix of 4- and 5-px blocks and a different zoom (90x135). The integer divisor gives uniform 4x4 device-px art pixels, the same as the uncapped page (character 80x120), with 25 % of the device pixels. Drafting-time fps at 390x844 DPR 3, 4x CPU, 5 s idle, before the ground layer existed: uncapped 22.8 fps (1170x2532), `Math.min` 43.9 (780x1688), integer divisor 59.6 (585x1266).

Measured on this branch with `node scripts/measure-fps.mjs <url> <profile>` (3 runs, median; phone = 390x844 DPR 3 touch, 4x CPU throttle; desktop = 1280x720 DPR 1; idle 5 s, then 5 s holding Shift+D; ground layer included). Host load before each run: 1.07, 1.13, 1.11, 1.08.

| Profile / URL | Canvas (backing) | Idle fps / p95 ms | Walk fps / p95 ms |
|---|---|---|---|
| phone `?maxdpr=4` (uncapped at DPR 3) | 1170x2532 | 5.9 / 200 | 6.2 / 233.3 |
| phone default (cap 2 -> resolution 1.5) | 585x1266 | 23.3 / 50.1 | 22.3 / 66.7 |
| phone `?maxdpr=1` | 390x844 | 45.9 / 33.4 | 42.8 / 33.4 |
| desktop default | 1280x720 | 26.7 / 50 | 27.6 / 50.1 |

Reading it: the cap cuts the fill by 4x and the software rasterizer's fps rises about 4x (5.9 -> 23.3). The absolute numbers are SwiftShader's and mean nothing for a phone GPU. Desktop (unthrottled CPU) lands near the capped phone because it fills 921,600 px against 740,610; under software rendering fill dominates. The earlier drafting numbers were taken before the ground layer, which is why they are higher.

The GDD budget (at least 30 fps at about 300 entities on mid-range phones) is not measurable in M1: there is one character. It is left to the M2 E2E.

## 3. Startup (first frame)

The mark `overgrown:first-frame` (`performance.mark`, set in `client/src/main.ts`) is the first frame that draws a snapshot with at least one baked ground chunk. Times are ms since navigation start.

Recipe: `node scripts/measure-startup.mjs <url> 5 shot.png`; phone profile (390x844 DPR 3), slow 4G (1.6 Mbit/s down, 150 ms RTT), 4x CPU, HTTP cache off, fresh context per run. Served by `vite preview` on localhost (no compression), built from this branch. Host load before the run: 1.36.

| State | First frame median (min / max) | Worker created | Atlas JSON done | First snapshot | First chunk | Bytes (js / atlas / other / total) | Byte floor |
|---|---|---|---|---|---|---|---|
| Before TEC-021 | 4627 ms (4579 / 4675) | 4172 ms | 2243 ms | 4454 ms | 4452 ms | 163,245 / 320,851 / 1,003 / 485,099 | 2425 ms |
| After TEC-021 | 2852 ms (2766 / 3094) | 1135 ms | 1525 ms | 1330 ms | 1329 ms | 163,371 / 138,314 / 1,003 / 302,688 | 1513 ms |

Byte floor = total bytes / 200,000 B/s, the time the bytes alone take on the throttled link. The worker is only created after the atlas has loaded and the renderer is up, so first frame is the floor plus a serial chain; TEC-021 adds its "after" row to this table.

The "after TEC-021" row (same recipe, N = 5, host load 0.87, built from the TEC-021 branch) is two changes: parallel startup (the worker is created first, the renderer and the atlas load together) and the lossless WebP atlas (the atlas bytes drop from 320,851 to 138,314).

### Startup variants measured while drafting TEC-021 (main a137bd1, before WLD-003)

Phone 390x844 DPR 3, slow 4G, 4x CPU, cold, vite preview with gzip; ms since navigation start.

| Variant | Atlas | Resolution at DPR 3 | First frame, median (min-max), runs |
|---|---|---|---|
| main (renderer, atlas, worker in series) | PNG 307 KB | 3 | 4892 (4686-4946), 3 |
| worker first, then `Promise.all([app.init, loadCoreAtlas()])` | PNG | 3 | 3375 (3365-3447), 5 |
| same + static `import "pixi.js/browser"` | PNG | 3 | 3417 (3388-3432), 5 |
| same + `import "pixi.js/browser"` + `skipExtensionImports: true` | PNG | 3 | 3584 (3540-3616), 5 |
| same + one JS bundle (`codeSplitting: false`, 2 JS files) | PNG | 3 | 3659 (3659-3688), 3 |
| worker first + `Promise.all` + TEC-020's cap (TEC-021) | WebP 127 KB | 1.5 | 2638 (2608-2773), 5 |

Fan-out changes (Pixi import style, `skipExtensionImports`, one bundle) were neutral or slower, so none was made.

### Target status

- M1 bar ≤ 3.0 s on slow 4G + 4x CPU (OQ-028): met (median 2852 ms).
- ≤ 2.0 s: moved to TEC-012 (OQ-028); now 2852 ms.

Arithmetic: bytes by kind are js 163,371 + atlas 138,314 + other 1,003 = 302,688 B; at 200,000 B/s that is `byteFloorMs` 1513 ms. The rest of the 2852 ms is the serial chain: HTML, then JS, then the lazy WebGL renderer chunk, then atlas decode, upload and the first bake, all at 4x CPU.

### What would get under 2 s (TEC-012)

- Load only what the first screen needs (core atlas first, the rest streamed): the atlas is 138,314 B, about 690 ms of the link at 200,000 B/s; a first-screen subset could save a large part of that.
- Less JS: about 163 KB of the 302 KB is JS, mostly Pixi, about 815 ms at 200,000 B/s; every 20 KB cut saves 100 ms.
- Start the atlas fetch before the JS has evaluated (today `core.json` is requested only after index.js has run, at about 1.1 s): this moves up to about 1.1 s of waiting for the atlas bytes into the JS download time.

## 4. Manual phone check (Lucid)

1. Open the game with `?perf`:
   - `https://lucidpaths.github.io/overgrown/?perf` once GitHub Pages is enabled (still open, see WORKING_STATE).
   - Until then: on a computer on the same Wi-Fi run `npm run build && npm -w @overgrown/client run preview -- --host --port 4204`, then on the phone open `http://<computer's LAN IP>:4204/?perf`.
2. Stand still for 10 s, then read the line under the debug text (for example `fps 25 · worst 59 ms · dpr 3 → 1.5 · 585×1266`).
3. Repeat with `&maxdpr=4` and `&maxdpr=1` appended. With each, also walk for 10 s using the on-screen stick.
4. Report, per URL: phone model, browser (and whether it ran inside the X app), the whole `?perf` line, and whether it looked smooth.

| Phone | Browser (X app?) | URL flags | Standing `?perf` line | Walking `?perf` line | Smooth? |
|---|---|---|---|---|---|
| (empty, for Lucid) | | | | | |
