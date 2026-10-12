// Thin adapter between the browser worker globals and the browser-free sim.
// The only module that touches worker globals.
import { TICK_MS } from "@overgrown/sim/constants";
import { snapshotBuffers, type HostToSim, type SimToHost } from "@overgrown/sim/protocol";
import { createSim } from "@overgrown/sim/sim";

// The client compiles against the DOM lib, not WebWorker, so type the slice of
// DedicatedWorkerGlobalScope we use here instead of adding a second tsconfig.
interface WorkerScope {
  postMessage(message: SimToHost, transfer: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<HostToSim>) => void): void;
}
const scope = self as unknown as WorkerScope;

let loop: ReturnType<typeof setInterval> | undefined;

function fail(error: unknown): void {
  if (loop !== undefined) clearInterval(loop); // a broken sim must not keep ticking
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  scope.postMessage({ type: "error", message }, []);
}

function start(seed: number): void {
  if (loop !== undefined) throw new Error("sim worker received a second init");
  const sim = createSim(seed);
  loop = setInterval(() => {
    try {
      sim.step();
      const snapshot = sim.snapshot();
      scope.postMessage({ type: "snapshot", snapshot }, snapshotBuffers(snapshot));
    } catch (error) {
      fail(error);
    }
  }, TICK_MS);
}

scope.addEventListener("message", (event) => {
  try {
    const msg = event.data;
    switch (msg.type) {
      case "init":
        start(msg.seed);
        break;
      default:
        throw new Error(`sim worker got unknown message type: ${(msg as { type: unknown }).type}`);
    }
  } catch (error) {
    fail(error);
  }
});
