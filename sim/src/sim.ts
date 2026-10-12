// The simulation entry point. Browser-free: runs in a Web Worker and in Node.
import { stepActions } from "./actions";
import { createCharacterWorld, spawnCharacter } from "./character";
import { World } from "./ecs";
import { assertInputMessage, createInputLatch, latchInput } from "./input";
import { stepMovement } from "./movement";
import { Species, type InputMessage, type Snapshot } from "./protocol";

export interface Sim {
  readonly tick: number;
  /** Advances exactly one tick (dt = 1 / TICK_HZ seconds). */
  step(): void;
  /** Validates `msg` (RangeError naming the field) and keeps it as the newest input for the local player's character; the next step() latches it. */
  input(msg: InputMessage): void;
  /** Fresh typed arrays (length = count) of every entity with Position, Kind, Facing, Action and Species. */
  snapshot(): Snapshot;
}

export function createSim(seed: number): Sim {
  // The seed's only use until world generation consumes it: reject what main.ts would reject.
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`createSim: seed must be an integer 0..4294967295, got ${seed}`);
  }
  const ecs = new World();
  const world = createCharacterWorld(ecs);
  const player = spawnCharacter(world, { x: 0, y: 0, species: Species.Human, tick: 0 });
  const latch = createInputLatch();

  const c = world.components;
  const visible = [c.position, c.kind, c.facing, c.action, c.species];
  let tick = 0;

  return {
    get tick() {
      return tick;
    },
    step() {
      tick += 1;
      latchInput(latch, world, player); // the only player-specific line: every system below is shared
      stepActions(world, tick);
      stepMovement(world, tick);
    },
    input(msg) {
      assertInputMessage(msg);
      latch.latest = msg;
    },
    snapshot() {
      let count = 0;
      ecs.each(visible, () => {
        count += 1;
      });
      const s: Snapshot = {
        tick,
        count,
        ids: new Uint32Array(count),
        x: new Float32Array(count),
        y: new Float32Array(count),
        kind: new Uint16Array(count),
        facing: new Uint8Array(count),
        action: new Uint8Array(count),
        actionStart: new Uint32Array(count),
        species: new Uint8Array(count),
        you: player,
      };
      const { x, y } = c.position.store;
      const { kind } = c.kind.store;
      const { dir } = c.facing.store;
      const { state, start } = c.action.store;
      const { species } = c.species.store;
      let i = 0;
      ecs.each(visible, (id, index) => {
        s.ids[i] = id;
        s.x[i] = x[index]!;
        s.y[i] = y[index]!;
        s.kind[i] = kind[index]!;
        s.facing[i] = dir[index]!;
        s.action[i] = state[index]!;
        s.actionStart[i] = start[index]!;
        s.species[i] = species[index]!;
        i += 1;
      });
      return s;
    },
  };
}
