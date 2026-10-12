import type { Snapshot } from "@overgrown/sim/protocol";
import { describe, expect, it } from "vitest";
import { createFrame, interpolate } from "./interpolate";

interface Discrete {
  facing: number;
  action: number;
  actionStart: number;
  species: number;
}

const NO_DISCRETE: Discrete = { facing: 0, action: 0, actionStart: 0, species: 0 };

function snap(tick: number, entities: [id: number, x: number, y: number, discrete?: Discrete][]): Snapshot {
  const d = entities.map((e) => e[3] ?? NO_DISCRETE);
  return {
    tick,
    count: entities.length,
    ids: Uint32Array.from(entities.map((e) => e[0])),
    x: Float32Array.from(entities.map((e) => e[1])),
    y: Float32Array.from(entities.map((e) => e[2])),
    kind: new Uint16Array(entities.length).fill(1),
    facing: Uint8Array.from(d.map((v) => v.facing)),
    action: Uint8Array.from(d.map((v) => v.action)),
    actionStart: Uint32Array.from(d.map((v) => v.actionStart)),
    species: Uint8Array.from(d.map((v) => v.species)),
    you: -1,
  };
}

function rowOf(out: ReturnType<typeof createFrame>, id: number): number {
  const i = Array.from(out.ids.subarray(0, out.count)).indexOf(id);
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}

function at(out: ReturnType<typeof createFrame>, id: number): { x: number; y: number } {
  const i = rowOf(out, id);
  return { x: out.x[i]!, y: out.y[i]! };
}

function discreteAt(out: ReturnType<typeof createFrame>, id: number): Discrete {
  const i = rowOf(out, id);
  return { facing: out.facing[i]!, action: out.action[i]!, actionStart: out.actionStart[i]!, species: out.species[i]! };
}

describe("interpolate", () => {
  it("lerps by id when entity order differs between prev and curr", () => {
    const prev = snap(1, [
      [10, 0, 0, { facing: 0, action: 0, actionStart: 0, species: 0 }],
      [20, 100, 100, { facing: 1, action: 1, actionStart: 1, species: 1 }],
    ]);
    const curr = snap(2, [
      [20, 110, 120, { facing: 2, action: 2, actionStart: 2, species: 2 }],
      [10, 10, 20, { facing: 3, action: 3, actionStart: 3, species: 3 }],
    ]);
    const out = createFrame();
    interpolate(prev, curr, 0.5, out);
    expect(out.count).toBe(2);
    expect(at(out, 10)).toEqual({ x: 5, y: 10 });
    expect(at(out, 20)).toEqual({ x: 105, y: 110 });
    expect(discreteAt(out, 10)).toEqual({ facing: 3, action: 3, actionStart: 3, species: 3 });
    expect(discreteAt(out, 20)).toEqual({ facing: 2, action: 2, actionStart: 2, species: 2 });
  });

  it("uses the current position for an entity that is new in curr", () => {
    const prev = snap(1, [[10, 0, 0]]);
    const curr = snap(2, [
      [10, 10, 10],
      [99, 50, 60],
    ]);
    const out = createFrame();
    interpolate(prev, curr, 0.5, out);
    expect(at(out, 99)).toEqual({ x: 50, y: 60 });
  });

  it("clamps alpha to [0, 1]", () => {
    const prev = snap(1, [[10, 0, 0]]);
    const curr = snap(2, [[10, 10, 20]]);
    const out = createFrame();
    interpolate(prev, curr, 7, out);
    expect(at(out, 10)).toEqual({ x: 10, y: 20 });
    interpolate(prev, curr, -3, out);
    expect(at(out, 10)).toEqual({ x: 0, y: 0 });
  });

  it("draws curr as-is when there is no prev, and reuses out's arrays when capacity suffices", () => {
    const curr = snap(1, [[10, 3, 4]]);
    const out = createFrame();
    interpolate(null, curr, 0.5, out);
    expect(at(out, 10)).toEqual({ x: 3, y: 4 });
    const xs = out.x;
    interpolate(null, curr, 0.5, out);
    expect(out.x).toBe(xs);
  });
});
