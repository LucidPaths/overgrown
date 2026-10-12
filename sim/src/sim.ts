// The simulation entry point. Browser-free: runs in a Web Worker and in Node.
import { TICK_HZ } from "./constants";
import { spawnDebugMovers, stepDebugMovers, type MoverComponents } from "./debug-movers";
import { World } from "./ecs";
import type { Snapshot } from "./protocol";
import { deriveSeed, hashString, Rng } from "./rng";

export interface Sim {
  readonly tick: number;
  /** Advances exactly one tick (dt = 1 / TICK_HZ seconds). */
  step(): void;
  /** Fresh typed arrays (length = count) of every entity with Position and Kind. */
  snapshot(): Snapshot;
}

export function createSim(seed: number): Sim {
  const world = new World();
  const components: MoverComponents = {
    position: world.register("Position", { x: "f32", y: "f32" }),
    velocity: world.register("Velocity", { vx: "f32", vy: "f32" }),
    kind: world.register("Kind", { kind: "u16" }),
  };
  spawnDebugMovers(world, components, new Rng(deriveSeed(seed, hashString("debug-movers"))));

  const dt = 1 / TICK_HZ;
  const visible = [components.position, components.kind];
  let tick = 0;

  return {
    get tick() {
      return tick;
    },
    step() {
      stepDebugMovers(world, components, dt);
      tick += 1;
    },
    snapshot() {
      let count = 0;
      world.each(visible, () => {
        count += 1;
      });
      const s: Snapshot = {
        tick,
        count,
        ids: new Uint32Array(count),
        x: new Float32Array(count),
        y: new Float32Array(count),
        kind: new Uint16Array(count),
      };
      const { x, y } = components.position.store;
      const kind = components.kind.store.kind;
      let i = 0;
      world.each(visible, (id, index) => {
        s.ids[i] = id;
        s.x[i] = x[index]!;
        s.y[i] = y[index]!;
        s.kind[i] = kind[index]!;
        i += 1;
      });
      return s;
    },
  };
}
