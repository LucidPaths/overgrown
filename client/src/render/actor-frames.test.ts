import { ATTACK_TICKS, DODGE_TICKS } from "@overgrown/sim/actions";
import { Action, Facing, Species } from "@overgrown/sim/protocol";
import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/actor-anims.json";
import { ACTOR_ANIMS } from "./actor-anims";
import { ACTION_ANIMS, actorFrame, actorFrameNames, animFrameIndex } from "./actor-frames";

describe("actor frames", () => {
  it("every name actorFrame returns is a contract frame, and every mapped frame is reached", () => {
    const contract = new Set<string>();
    for (const s of fixture.species) {
      for (const d of fixture.dirs) {
        for (const [a, n] of Object.entries(fixture.frames)) {
          for (let i = 0; i < n; i++) contract.add(`actor/${s}/${a}/${d}/${i}`);
        }
      }
    }
    const swept = new Set<string>();
    for (const species of Object.values(Species)) {
      for (const facing of Object.values(Facing)) {
        for (const action of Object.values(Action)) {
          for (let e = 0; e < 100; e++) swept.add(actorFrame(species, facing, action, 5, 5 + e));
        }
      }
    }
    expect([...swept].filter((name) => !contract.has(name))).toEqual([]);
    expect([...swept].sort()).toEqual(actorFrameNames().sort());
  });

  it("frame index: loops wrap, one-shots clamp to and hold the last frame", () => {
    const loop = { frames: 4, ticksPerFrame: 3, loop: true };
    const shot = { frames: 4, ticksPerFrame: 2, loop: false };
    const upTo = (n: number) => Array.from({ length: n + 1 }, (_, e) => e);
    expect(upTo(12).map((e) => animFrameIndex(loop, e))).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0]);
    expect(upTo(9).map((e) => animFrameIndex(shot, e))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3, 3]);
    expect(animFrameIndex(shot, 1e6)).toBe(3);
    expect(() => animFrameIndex(shot, -1)).toThrow(RangeError);
    expect(() => animFrameIndex(shot, 1.5)).toThrow(RangeError);
    expect(actorFrame(Species.Foxfolk, Facing.Right, Action.Death, 100, 100_100)).toBe(
      `actor/foxfolk/death/right/${ACTOR_ANIMS.death.frames - 1}`,
    );
    expect(() => actorFrame(Species.Human, Facing.Down, Action.Idle, 10, 9)).toThrow(RangeError);
  });

  it("attack and dodge reach their last frame within the sim's action duration", () => {
    for (const [action, duration] of [
      [Action.Attack, ATTACK_TICKS],
      [Action.Dodge, DODGE_TICKS],
    ] as const) {
      const t = ACTOR_ANIMS[ACTION_ANIMS[action]];
      expect((t.frames - 1) * t.ticksPerFrame).toBeLessThan(duration);
    }
  });
});
