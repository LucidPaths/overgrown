import { TICK_MS } from "@overgrown/sim/constants";
import type { HostToSim, SimToHost, Snapshot } from "@overgrown/sim/protocol";
import { SIM_VERSION } from "@overgrown/sim/version";
import { Application, Text, TextStyle, TextureStyle } from "pixi.js";
import { createFrame, interpolate } from "./render/interpolate";
import { SnapshotView } from "./render/snapshot-view";

const DEFAULT_SEED = 1;

const root = document.getElementById("app");
if (!root) {
  throw new Error("overgrown: #app element is missing from index.html");
}
const appRoot = root;

/** The one fatal-error display: replaces the page with `<headline>: <message>`. */
function showFatal(headline: string, error: unknown): void {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  appRoot.textContent = `${headline}: ${message}`;
}

/** `?seed=<int>` (unsigned 32-bit); missing → default, invalid → default plus a warning. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) return DEFAULT_SEED;
  const seed = Number(raw);
  if (/^\d+$/.test(raw) && seed <= 0xffffffff) return seed;
  console.warn(`overgrown: ignoring invalid ?seed=${raw} (want an integer 0..4294967295), using ${DEFAULT_SEED}`);
  return DEFAULT_SEED;
}

// Pixel art: sample textures with nearest-neighbor. Must be set before any texture exists.
TextureStyle.defaultOptions.scaleMode = "nearest";

try {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#1d2b22",
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  root.appendChild(app.canvas);

  const view = new SnapshotView(app.stage);

  const debugText = new Text({
    text: `overgrown · sim v${SIM_VERSION}`,
    style: new TextStyle({ fill: "#ffffff", fontSize: 12, fontFamily: "monospace" }),
  });
  debugText.position.set(4, 4);
  app.stage.addChild(debugText);

  // Rendering is one tick behind: draw prev -> curr, `alpha` of the way through the tick.
  let prev: Snapshot | null = null;
  let curr: Snapshot | null = null;
  let currReceivedAt = 0;
  const frame = createFrame();
  app.ticker.add(() => {
    if (curr === null) return;
    interpolate(prev, curr, (performance.now() - currReceivedAt) / TICK_MS, frame);
    view.update(frame);
  });

  const worker = new Worker(new URL("./sim-worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<SimToHost>) => {
    const msg = event.data;
    if (msg.type === "snapshot") {
      prev = curr;
      curr = msg.snapshot;
      currReceivedAt = performance.now();
    } else {
      showFatal("overgrown's simulation stopped", new Error(msg.message));
    }
  });
  // Failures before the worker's own try/catch exists (e.g. its module fails to load).
  worker.addEventListener("error", (event) => {
    showFatal("overgrown couldn't start the simulation", new Error(event.message || "sim worker failed to load"));
  });
  const init: HostToSim = { type: "init", seed: seedFromUrl() };
  worker.postMessage(init);
} catch (error) {
  showFatal("overgrown couldn't start the renderer", error);
}
