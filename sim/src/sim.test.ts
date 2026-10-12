import { describe, expect, it } from "vitest";
import { Action, Facing, Kind, snapshotBuffers, Species } from "./protocol";
import { createSim } from "./sim";

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
});
