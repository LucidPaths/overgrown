import { TICK_MS } from "@overgrown/sim/constants";
import type { ChunkStreamMessage, HostToSim, SimToHost, Snapshot } from "@overgrown/sim/protocol";
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
import { MAX_RENDER_DPR, renderResolution } from "./render/resolution";
import { SnapshotView } from "./render/snapshot-view";
import { PerfReadout } from "./perf-readout";
import { TouchOverlay } from "./ui/touch-overlay";

const DEFAULT_SEED = 1;
/** Performance mark for the first frame that draws a snapshot with at least one baked ground chunk. Read by scripts/measure-*.mjs and docs/perf.md. */
const FIRST_FRAME_MARK = "overgrown:first-frame";

const root = document.getElementById("app");
if (!root) {
  throw new Error("overgrown: #app element is missing from index.html");
}
const appRoot = root;

/** True once the page shows a fatal error; the first one wins (the sim can fail before the renderer is up). */
let fatal = false;

/** The one fatal-error display: replaces the page with `<headline>: <message>`. Later calls only log. */
function showFatal(headline: string, error: unknown): void {
  console.error(error);
  if (fatal) return;
  fatal = true;
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

/** `?maxdpr=<1..4>` overrides the render-resolution cap (for measuring); missing → default, invalid → default plus a warning. */
function maxDprFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("maxdpr");
  if (raw === null) return MAX_RENDER_DPR;
  if (/^[1-4]$/.test(raw)) return Number(raw);
  console.warn(`overgrown: ignoring invalid ?maxdpr=${raw} (want an integer 1..4), using ${MAX_RENDER_DPR}`);
  return MAX_RENDER_DPR;
}
const maxDpr = maxDprFromUrl();

// Pixel art: sample textures with nearest-neighbor. Must be set before any texture exists.
TextureStyle.defaultOptions.scaleMode = "nearest";

// Everything the worker's message handler and the ticker touch is declared before the worker exists:
// a message can arrive while app.init or the atlas load is still pending.
let app: Application | null = null;
let ground: ChunkLayer | null = null;
/** Chunk messages that arrived before the ground layer existed, in arrival order. */
const early: ChunkStreamMessage[] = [];
// Rendering is one tick behind: draw prev -> curr, `alpha` of the way through the tick.
let prev: Snapshot | null = null;
let curr: Snapshot | null = null;
let currReceivedAt = 0;
const frame = createFrame();
let chunksAdded = 0;
let firstFrameMarked = false;
let worker: Worker | null = null;

/** Applies a chunk message to the ground layer, or keeps it until the layer exists. */
function applyChunkMessage(msg: ChunkStreamMessage): void {
  if (ground === null) {
    early.push(msg);
    return;
  }
  if (msg.type === "chunk") {
    ground.add(msg);
    chunksAdded += 1;
  } else {
    ground.remove(msg.cx, msg.cy);
  }
}

// Browser zoom or another screen changes devicePixelRatio; Pixi's resizeTo only tracks the CSS size.
function watchDpr(onChange: () => void): void {
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener(
    "change",
    () => {
      watchDpr(onChange);
      onChange();
    },
    { once: true },
  );
}

try {
  // The sim starts first and runs while the renderer and the atlas load.
  const sim = new Worker(new URL("./sim-worker.ts", import.meta.url), { type: "module" });
  worker = sim;
  sim.addEventListener("message", (event: MessageEvent<SimToHost>) => {
    const msg = event.data;
    try {
      switch (msg.type) {
        case "snapshot":
          prev = curr;
          curr = msg.snapshot;
          currReceivedAt = performance.now();
          break;
        case "chunk":
        case "unchunk":
          applyChunkMessage(msg);
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
      app?.ticker.stop();
      sim.terminate();
      showFatal("overgrown couldn't draw the world", error);
    }
  });
  // Failures before the worker's own try/catch exists (e.g. its module fails to load).
  sim.addEventListener("error", (event) => {
    showFatal("overgrown couldn't start the simulation", new Error(event.message || "sim worker failed to load"));
  });
  const init: HostToSim = { type: "init", seed: seedFromUrl() };
  sim.postMessage(init);

  const pixi = new Application();
  const [, sheet] = await Promise.all([
    pixi.init({
      resizeTo: window,
      background: "#1d2b22",
      antialias: false,
      resolution: renderResolution(window.devicePixelRatio || 1, maxDpr),
      autoDensity: true,
    }),
    loadCoreAtlas(),
  ]);
  // Assigned only once init has resolved: Pixi defines `app.ticker` then, and the handler's catch uses it.
  app = pixi;
  if (fatal) {
    // The sim already failed while we waited: keep its message.
    sim.terminate();
    pixi.destroy();
  } else {
    // A fractional CSS size (backing / resolution at e.g. DPR 2.625) is composited with resampling; keep it nearest.
    pixi.canvas.style.imageRendering = "pixelated";
    root.appendChild(pixi.canvas);
    watchDpr(() =>
      pixi.renderer.resize(window.innerWidth, window.innerHeight, renderResolution(window.devicePixelRatio || 1, maxDpr)),
    );
    requireFrames(sheet, actorFrameNames());

    // World-space layer, added before debugText so it draws behind the text.
    const world = new Container();
    pixi.stage.addChild(world);
    // Ground first, so it draws under the characters. The background colour shows until the first chunk is baked.
    const layer = new ChunkLayer(world, sheet, pixi.renderer);
    ground = layer;
    for (const msg of early) applyChunkMessage(msg);
    early.length = 0;
    const view = new SnapshotView(world, sheet);

    const debugText = new Text({
      text: `overgrown · sim v${SIM_VERSION}`,
      style: new TextStyle({ fill: "#ffffff", fontSize: 12, fontFamily: "monospace" }),
    });
    debugText.position.set(4, 4);
    pixi.stage.addChild(debugText);

    // Input and overlay come before the ticker, which reads them every frame.
    const hostInput = new HostInput(
      (msg) => sim.postMessage(msg),
      window.matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard-mouse",
    );
    const input = new KeyboardMouseInput(pixi.canvas, hostInput);
    const touch = new TouchInput(pixi.canvas, hostInput, frame);
    const overlay = new TouchOverlay(appRoot);

    // Camera target: the `you` character, or the last place it was seen.
    let targetX = 0;
    let targetY = 0;
    // An error thrown inside a ticker callback never reaches the try/catch below, so it is caught here.
    pixi.ticker.add(() => {
      try {
        overlay.update(hostInput.active === "touch", touch.stick, touch.buttonsDown);
        if (curr === null) return;
        interpolate(prev, curr, (performance.now() - currReceivedAt) / TICK_MS, frame);
        const i = frame.ids.subarray(0, frame.count).indexOf(frame.you);
        if (i >= 0) {
          targetX = frame.x[i]!;
          targetY = frame.y[i]!;
        }
        // Follow camera in device px (the real backing store), mapped back to stage units: one unit = `r` device px.
        const layout = layoutCamera(pixi.canvas.width, pixi.canvas.height, targetX, targetY);
        const r = pixi.renderer.resolution;
        world.scale.set(layout.scale / r);
        world.position.set(layout.originX / r, layout.originY / r);
        input.setLayout(layout);
        layer.update();
        view.update(frame);
        if (!firstFrameMarked && chunksAdded > 0) {
          performance.mark(FIRST_FRAME_MARK);
          firstFrameMarked = true;
        }
      } catch (error) {
        pixi.ticker.stop();
        sim.terminate();
        showFatal("overgrown couldn't draw a frame", error);
      }
    });

    if (new URLSearchParams(window.location.search).has("perf")) {
      const readout = new PerfReadout(document.body);
      pixi.ticker.add(() =>
        readout.frame(performance.now(), {
          dpr: window.devicePixelRatio || 1,
          resolution: pixi.renderer.resolution,
          width: pixi.canvas.width,
          height: pixi.canvas.height,
        }),
      );
    }
  }
} catch (error) {
  worker?.terminate();
  showFatal("overgrown couldn't start the renderer", error);
}
