import { describe, expect, it } from "vitest";
import { Action, Facing, Kind, snapshotBuffers, Species, type ActionValue, type InputMessage } from "./protocol";
import { createSim, type Sim } from "./sim";

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
      ["attackPresses", { attackPresses: -1 }],
      ["attackPresses", { attackPresses: 1.5 }],
      ["sprint", { sprint: 1 }],
    ];
    for (const [field, patch] of bad) {
      expect(() => sim.input(input(patch as Partial<InputMessage>))).toThrow(RangeError);
      expect(() => sim.input(input(patch as Partial<InputMessage>))).toThrow(field);
    }
  });
});
