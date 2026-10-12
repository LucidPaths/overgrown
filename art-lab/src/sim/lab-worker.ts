// The lab's sim worker: steps the lab world at TICK_HZ and posts snapshots and chunk messages, like client/src/sim-worker.ts.
import { TICK_MS } from "../../../sim/src/constants";
import { chunkBuffers, snapshotBuffers, type InputMessage, type SimToHost } from "../../../sim/src/protocol";
import { createLabWorld, type LabWorld } from "./lab-world";

const bootAt = performance.now();
(self as unknown as Worker).postMessage({ type: "boot" }); // the host waits for this before its own heavy work
type In = { type: "init"; seed: number; npcs: number; species: number } | InputMessage;
let w: LabWorld | undefined;
const post = (m: SimToHost, t: ArrayBuffer[] = []) => (self as unknown as Worker).postMessage(m, t);

const onMessage = (m: In) => {
  try {
    if (m.type === "init") {
      const t0 = performance.now();
      w = createLabWorld(m.seed, { npcs: m.npcs, species: m.species as 0 });
      (self as unknown as Worker).postMessage({ type: "timing", boot: bootAt, init: t0, created: performance.now(), origin: performance.timeOrigin });
      const s0 = w.snapshot(); // tick 0 right away: the host can draw before the first step
      post({ type: "snapshot", snapshot: s0 }, snapshotBuffers(s0));
      let next = performance.now();
      const tick = () => {
        const now = performance.now();
        let n = 0;
        while (now >= next && n < 5) {
          w!.step();
          for (const c of w!.drain()) post(c, c.type === "chunk" ? chunkBuffers(c) : []);
          next += TICK_MS;
          n++;
        }
        if (n === 5) next = now + TICK_MS; // fell far behind (tab hidden): don't spiral
        if (n > 0) {
          const s = w!.snapshot();
          post({ type: "snapshot", snapshot: s }, snapshotBuffers(s));
        }
        setTimeout(tick, Math.max(0, next - performance.now()));
      };
      tick();
    } else if (w) w.input(m);
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? `${err.message}\n${err.stack}` : String(err) });
  }
};
self.onmessage = (e: MessageEvent<In>) => onMessage(e.data);
onMessage(JSON.parse((self as unknown as { name: string }).name) as In);
