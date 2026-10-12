// Times the lab world's creation and first steps in Node (no throttle): where does worker startup go?
import { createLabWorld } from "../src/sim/lab-world";
import { generateChunk } from "../../sim/src/world/chunk-gen";
const t0 = performance.now();
for (let i = 0; i < 9; i++) generateChunk(22, 40 + i, 40);
const t1 = performance.now();
const w = createLabWorld(22);
const t2 = performance.now();
w.step(); w.drain();
const t3 = performance.now();
for (let i = 0; i < 20; i++) { w.step(); w.drain(); }
const t4 = performance.now();
console.log({ genChunkMs: ((t1 - t0) / 9).toFixed(1), createMs: (t2 - t1).toFixed(0), firstStepMs: (t3 - t2).toFixed(0), stepMs: ((t4 - t3) / 20).toFixed(1) });
