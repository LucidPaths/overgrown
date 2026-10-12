import { TICK_MS } from "@overgrown/sim/constants";
import type { HostToSim, SimToHost, Snapshot } from "@overgrown/sim/protocol";
import { SIM_VERSION } from "@overgrown/sim/version";
import { Application, Container, Text, TextStyle, TextureStyle } from "pixi.js";
import { loadCoreAtlas } from "./assets";
import { HostInput } from "./input/host-input";
import { KeyboardMouseInput } from "./input/keyboard-mouse";
import { TouchInput } from "./input/touch";
import { actorFrameNames } from "./render/actor-frames";
import { layoutCamera } from "./render/camera";
import { ChunkLayer } from "./render/chunk-layer";
import { createFrame, interpolate } from "./render/interpolate";
import { requireFrames } from "./render/kind-frames";
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
  // A fractional CSS size (backing / resolution at e.g. DPR 2.625) is composited with resampling; keep it nearest.
  app.canvas.style.imageRendering = "pixelated";
  root.appendChild(app.canvas);

  const sheet = await loadCoreAtlas();
  requireFrames(sheet, actorFrameNames());

  // World-space layer, added before debugText so it draws behind the text.
  const world = new Container();
  app.stage.addChild(world);
  // Ground first, so it draws under the characters. The background colour shows until the first chunk is baked.
  const ground = new ChunkLayer(world, sheet, app.renderer);
  const view = new SnapshotView(world, sheet);

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
  // Camera target: the `you` character, or the last place it was seen.
  let targetX = 0;
  let targetY = 0;
  // An error thrown inside a ticker callback never reaches the try/catch below, so it is caught here.
  app.ticker.add(() => {
    if (curr === null) return;
    try {
      interpolate(prev, curr, (performance.now() - currReceivedAt) / TICK_MS, frame);
      const i = frame.ids.subarray(0, frame.count).indexOf(frame.you);
      if (i >= 0) {
        targetX = frame.x[i]!;
        targetY = frame.y[i]!;
      }
      // Follow camera in device px (the real backing store), mapped back to stage units: one unit = `r` device px.
      const layout = layoutCamera(app.canvas.width, app.canvas.height, targetX, targetY);
      const r = app.renderer.resolution;
      world.scale.set(layout.scale / r);
      world.position.set(layout.originX / r, layout.originY / r);
      input.setLayout(layout);
      ground.update();
      view.update(frame);
    } catch (error) {
      app.ticker.stop();
      worker.terminate();
      showFatal("overgrown couldn't draw a frame", error);
    }
  });

  const worker = new Worker(new URL("./sim-worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<SimToHost>) => {
    const msg = event.data;
    try {
      switch (msg.type) {
        case "snapshot":
          prev = curr;
          curr = msg.snapshot;
          currReceivedAt = performance.now();
          break;
        case "chunk":
          ground.add(msg);
          break;
        case "unchunk":
          ground.remove(msg.cx, msg.cy);
          break;
        case "error":
          showFatal("overgrown's simulation stopped", new Error(msg.message));
          break;
        default: {
          const unknown: never = msg;
          throw new Error(`unknown sim message type: ${(unknown as { type: unknown }).type}`);
        }
      }
    } catch (error) {
      app.ticker.stop();
      worker.terminate();
      showFatal("overgrown couldn't draw the world", error);
    }
  });
  // Failures before the worker's own try/catch exists (e.g. its module fails to load).
  worker.addEventListener("error", (event) => {
    showFatal("overgrown couldn't start the simulation", new Error(event.message || "sim worker failed to load"));
  });
  const init: HostToSim = { type: "init", seed: seedFromUrl() };
  worker.postMessage(init);
  const hostInput = new HostInput(
    (msg) => worker.postMessage(msg),
    window.matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard-mouse",
  );
  const input = new KeyboardMouseInput(app.canvas, hostInput);
  // No per-frame call yet: bind it to a name when UIX-002 reads `stick` and `buttonsDown`.
  new TouchInput(app.canvas, hostInput, frame);
} catch (error) {
  showFatal("overgrown couldn't start the renderer", error);
}
