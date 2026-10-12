import { describe, expect, it } from "vitest";
import { createSim, type Sim } from "./sim";

function run(seed: number, steps: number): Sim {
  const sim = createSim(seed);
  for (let i = 0; i < steps; i++) sim.step();
  return sim;
}

describe("createSim", () => {
  it("two sims with the same seed produce identical snapshots after 100 steps", () => {
    const a = run(42, 100).snapshot();
    const b = run(42, 100).snapshot();
    expect(a.count).toBe(64);
    expect(a.tick).toBe(100);
    expect(a).toEqual(b);
  });

  it("different seeds produce different snapshots", () => {
    expect(run(1, 100).snapshot()).not.toEqual(run(2, 100).snapshot());
  });
});
