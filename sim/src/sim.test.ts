import { describe, expect, it } from "vitest";
import {
  Action,
  Facing,
  Kind,
  snapshotBuffers,
  Species,
  type ActionValue,
  type InputMessage,
  type Snapshot,
} from "./protocol";
import { createSim, type Sim } from "./sim";
import { generateChunk } from "./world/chunk-gen";

function input(patch: Partial<InputMessage>): InputMessage {
  return { type: "input", moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprint: false, attackPresses: 0, dodgePresses: 0, ...patch };
}

/** Steps `n` times and returns the distinct actionStart values of the player's snapshots showing `action`. */
function episodes(sim: Sim, n: number, action: ActionValue): Set<number> {
  const starts = new Set<number>();
  for (let k = 0; k < n; k++) {
    sim.step();
    const s = sim.snapshot();
    const i = Array.from(s.ids).indexOf(s.you);
    if (s.action[i] === action) starts.add(s.actionStart[i]!);
  }
  return starts;
}

describe("createSim", () => {
  it("createSim spawns one Human character at (0,0) and `you` names it", () => {
    const s = createSim(1).snapshot();
    expect(s.count).toBe(1);
    expect(s.you).not.toBe(-1);
    expect(s.ids[0]).toBe(s.you);
    expect(s.kind[0]).toBe(Kind.Character);
    expect(s.species[0]).toBe(Species.Human);
    expect(s.facing[0]).toBe(Facing.Down);
    expect(s.action[0]).toBe(Action.Idle);
    expect(s.x[0]).toBe(0);
    expect(s.y[0]).toBe(0);
  });

  it("snapshotBuffers transfers every snapshot column", () => {
    const sim = createSim(1);
    sim.step();
    const s = sim.snapshot();
    const buffers = snapshotBuffers(s);
    const columns = Object.values(s).filter((v) => ArrayBuffer.isView(v));
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) {
      expect((column as Uint8Array).length).toBe(s.count);
      expect(buffers).toContain(column.buffer);
    }
    expect(buffers.length).toBe(columns.length);
  });

  it("input: a press between ticks is applied exactly once, and several presses between ticks are one press", () => {
    const sim = createSim(1);
    sim.input(input({ attackPresses: 1 }));
    sim.input(input({ attackPresses: 1, moveX: 1 })); // supersedes the first before any tick: the press survives
    sim.step();
    const s = sim.snapshot();
    expect(s.action[0]).toBe(Action.Attack);
    expect(s.actionStart[0]).toBe(1);
    expect(episodes(sim, 20, Action.Attack)).toEqual(new Set([1]));

    sim.input(input({ attackPresses: 3 })); // two presses since the last message
    expect(episodes(sim, 20, Action.Attack).size).toBe(1);

    sim.input(input({ attackPresses: 3, dodgePresses: 1 }));
    expect(episodes(sim, 20, Action.Dodge).size).toBe(1);
  });

  it("input: rejects malformed messages naming the field", () => {
    const sim = createSim(1);
    const bad: [string, Record<string, unknown>][] = [
      ["moveX", { moveX: NaN }],
      ["moveX", { moveX: 1.5 }],
      ["aimY", { aimY: Infinity }],
      ["aimX", { aimX: 1e300 }], // finite, but Infinity once stored in the f32 Intent column
      ["attackPresses", { attackPresses: -1 }],
      ["attackPresses", { attackPresses: 1.5 }],
      ["sprint", { sprint: 1 }],
    ];
    for (const [field, patch] of bad) {
      expect(() => sim.input(input(patch as Partial<InputMessage>))).toThrow(RangeError);
      expect(() => sim.input(input(patch as Partial<InputMessage>))).toThrow(field);
    }
  });

  it("input: a press buffered during an action survives the latch re-applying messages, and dodge beats attack on the same tick", () => {
    const sim = createSim(1);
    const actions: ActionValue[] = [];
    const record = () => {
      sim.step();
      const s = sim.snapshot();
      actions.push(s.action[Array.from(s.ids).indexOf(s.you)]! as ActionValue);
    };

    // Attack pressed for tick 1; dodge pressed for tick 6, inside the attack's last BUFFER_TICKS.
    // A fresh message is posted before every tick, so the latch rewrites buttons each time.
    for (let tick = 1; tick <= 16; tick++) {
      sim.input(input({ attackPresses: 1, dodgePresses: tick >= 6 ? 1 : 0 }));
      record();
    }
    const expected: ActionValue[] = [
      ...Array<ActionValue>(8).fill(Action.Attack), // ticks 1–8
      ...Array<ActionValue>(7).fill(Action.Dodge), // ticks 9–15
      Action.Idle, // tick 16
    ];
    expect(actions).toEqual(expected);

    // Both presses land on the same tick: dodge wins, and the attack press is dropped.
    actions.length = 0;
    for (let k = 0; k < 8; k++) {
      sim.input(input({ attackPresses: 2, dodgePresses: 2 }));
      record();
    }
    expect(actions).toEqual([...Array<ActionValue>(7).fill(Action.Dodge), Action.Idle]);
  });
  it("determinism: the same seed and inputs give identical snapshots and chunk messages", () => {
    type Logged =
      | { type: "chunk"; cx: number; cy: number; tiles: number[]; biomes: number[] }
      | { type: "unchunk"; cx: number; cy: number };

    function run(seed: number): { snapshots: Snapshot[]; chunks: Logged[] } {
      const sim = createSim(seed);
      const snapshots: Snapshot[] = [];
      const chunks: Logged[] = [];
      const script: [ticks: number, msg: InputMessage][] = [
        [100, input({ moveX: 1, sprint: true })],
        [140, input({ moveX: 1, sprint: true, attackPresses: 1 })], // one attack on the way east
        [230, input({ moveX: -1, sprint: true, attackPresses: 1 })],
      ];
      for (const [ticks, msg] of script) {
        sim.input(msg);
        for (let k = 0; k < ticks; k++) {
          sim.step();
          snapshots.push(sim.snapshot());
          for (const m of sim.drainChunkMessages()) {
            if (m.type === "unchunk") {
              chunks.push({ type: "unchunk", cx: m.cx, cy: m.cy });
              continue;
            }
            const expected = generateChunk(seed, m.cx, m.cy);
            expect(m.tiles).toEqual(expected.tiles);
            expect(m.biomes).toEqual(expected.biomes);
            chunks.push({ type: "chunk", cx: m.cx, cy: m.cy, tiles: [...m.tiles], biomes: [...m.biomes] });
            m.tiles.fill(255); // the host owns these arrays and may do anything with them
            m.biomes.fill(255);
          }
        }
      }
      return { snapshots, chunks };
    }

    const a = run(1);
    expect(run(1)).toEqual(a);
    expect(run(8).chunks).not.toEqual(a.chunks);

    expect(a.chunks.some((m) => m.type === "unchunk")).toBe(true);
    const sent = a.chunks.flatMap((m) => (m.type === "chunk" ? [`${m.cx},${m.cy}`] : []));
    expect(new Set(sent).size).toBeLessThan(sent.length); // a chunk reloaded after its unchunk
  });
});
