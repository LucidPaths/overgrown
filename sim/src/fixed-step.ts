// Fixed-timestep accumulator. Pure and browser-free: the host reads the clock and passes elapsed time in.
import { TICK_MS } from "./constants";

export const MAX_STEPS_PER_ADVANCE = 5;

export interface StepClock {
  accumulatorMs: number;
}

/**
 * Adds elapsedMs, returns how many ticks to run now. If more than MAX_STEPS_PER_ADVANCE would be due,
 * runs MAX and drops the remaining backlog (accumulator := 0): the world pauses rather than
 * fast-forwards after throttling.
 */
export function advance(clock: StepClock, elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError(`advance: elapsedMs must be a finite number >= 0, got ${elapsedMs}`);
  }
  clock.accumulatorMs += elapsedMs;
  const due = Math.floor(clock.accumulatorMs / TICK_MS);
  if (due > MAX_STEPS_PER_ADVANCE) {
    clock.accumulatorMs = 0;
    return MAX_STEPS_PER_ADVANCE;
  }
  clock.accumulatorMs -= due * TICK_MS;
  return due;
}
