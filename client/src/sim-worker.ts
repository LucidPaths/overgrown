// Thin adapter between the browser worker globals and the browser-free sim.
// The only module that touches worker globals.
import { TICK_MS } from "@overgrown/sim/constants";
import { advance, type StepClock } from "@overgrown/sim/fixed-step";
import { snapshotBuffers, type HostToSim, type SimToHost } from "@overgrown/sim/protocol";
import { createSim, type Sim } from "@overgrown/sim/sim";

// The client compiles against the DOM lib, not WebWorker, so type the slice of
// DedicatedWorkerGlobalScope we use here instead of adding a second tsconfig.
interface WorkerScope {
  postMessage(message: SimToHost, transfer: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<HostToSim>) => void): void;
}
const scope = self as unknown as WorkerScope;

let loop: ReturnType<typeof setInterval> | undefined;
let sim: Sim | undefined;

function fail(error: unknown): void {
  if (loop !== undefined) clearInterval(loop); // a broken sim must not keep ticking
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  scope.postMessage({ type: "error", message }, []);
}

function start(seed: number): void {
  if (loop !== undefined) throw new Error("sim worker received a second init");
  const created = createSim(seed);
  sim = created;
  const clock: StepClock = { accumulatorMs: 0 };
  let last = performance.now(); // wall-clock time is read here, in the adapter, never in the sim
  // Poll at twice the tick rate: setInterval is irregular, the accumulator makes the average exact.
  loop = setInterval(() => {
    try {
      const now = performance.now();
      const steps = advance(clock, now - last);
      last = now;
      for (let i = 0; i < steps; i++) created.step();
      if (steps > 0) {
        const snapshot = created.snapshot(); // only the newest: the renderer never needs the skipped ones
        scope.postMessage({ type: "snapshot", snapshot }, snapshotBuffers(snapshot));
      }
    } catch (error) {
      fail(error);
    }
  }, TICK_MS / 2);
}

scope.addEventListener("message", (event) => {
  try {
    const msg = event.data;
    switch (msg.type) {
      case "init":
        start(msg.seed);
        break;
      case "input":
        if (sim === undefined) throw new Error("sim worker got input before init");
        sim.input(msg);
        break;
      default:
        throw new Error(`sim worker got unknown message type: ${(msg as { type: unknown }).type}`);
    }
  } catch (error) {
    fail(error);
  }
});
