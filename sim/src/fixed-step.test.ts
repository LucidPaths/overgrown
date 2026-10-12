import { describe, expect, it } from "vitest";
import { TICK_MS } from "./constants";
import { advance, MAX_STEPS_PER_ADVANCE, type StepClock } from "./fixed-step";
import { Rng } from "./rng";

describe("advance", () => {
  it("over irregular elapsed times yields floor(total / TICK_MS) steps in total", () => {
    const rng = new Rng(7);
    const clock: StepClock = { accumulatorMs: 0 };
    let total = 0;
    let steps = 0;
    for (let i = 0; i < 1000; i++) {
      const elapsed = rng.int(1, 40);
      total += elapsed;
      steps += advance(clock, elapsed);
    }
    expect(steps).toBe(Math.floor(total / TICK_MS));
  });

  it("a 10 s gap yields MAX_STEPS_PER_ADVANCE steps and drops the backlog", () => {
    const clock: StepClock = { accumulatorMs: 0 };
    expect(advance(clock, 10_000)).toBe(MAX_STEPS_PER_ADVANCE);
    expect(advance(clock, 50)).toBe(1);
  });

  it("rejects negative and non-finite elapsed times", () => {
    const clock: StepClock = { accumulatorMs: 0 };
    expect(() => advance(clock, -1)).toThrow(RangeError);
    expect(() => advance(clock, NaN)).toThrow(RangeError);
    expect(() => advance(clock, Infinity)).toThrow(RangeError);
  });
});
