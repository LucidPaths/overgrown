import type { Snapshot } from "@overgrown/sim/protocol";
import { describe, expect, it } from "vitest";
import { createFrame, interpolate } from "./interpolate";

function snap(tick: number, entities: [id: number, x: number, y: number][]): Snapshot {
  return {
    tick,
    count: entities.length,
    ids: Uint32Array.from(entities.map((e) => e[0])),
    x: Float32Array.from(entities.map((e) => e[1])),
    y: Float32Array.from(entities.map((e) => e[2])),
    kind: new Uint16Array(entities.length).fill(1),
  };
}

function at(out: ReturnType<typeof createFrame>, id: number): { x: number; y: number } {
  const i = Array.from(out.ids.subarray(0, out.count)).indexOf(id);
  expect(i).toBeGreaterThanOrEqual(0);
  return { x: out.x[i]!, y: out.y[i]! };
}

describe("interpolate", () => {
  it("lerps by id when entity order differs between prev and curr", () => {
    const prev = snap(1, [
      [10, 0, 0],
      [20, 100, 100],
    ]);
    const curr = snap(2, [
      [20, 110, 120],
      [10, 10, 20],
    ]);
    const out = createFrame();
    interpolate(prev, curr, 0.5, out);
    expect(out.count).toBe(2);
    expect(at(out, 10)).toEqual({ x: 5, y: 10 });
    expect(at(out, 20)).toEqual({ x: 105, y: 110 });
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
