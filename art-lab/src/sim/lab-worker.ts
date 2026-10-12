// The lab's sim worker: steps the lab world at TICK_HZ and posts snapshots and chunk messages, like client/src/sim-worker.ts.
import { TICK_MS } from "../../../sim/src/constants";
import { chunkBuffers, snapshotBuffers, type InputMessage, type SimToHost } from "../../../sim/src/protocol";
import { createLabWorld, type LabWorld } from "./lab-world";

type In = { type: "init"; seed: number; npcs: number; species: number } | InputMessage;
let w: LabWorld | undefined;
const post = (m: SimToHost, t: ArrayBuffer[] = []) => (self as unknown as Worker).postMessage(m, t);

self.onmessage = (e: MessageEvent<In>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      w = createLabWorld(m.seed, { npcs: m.npcs, species: m.species as 0 });
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
