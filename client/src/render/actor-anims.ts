// Actor animation frame counts and display timing (ART-006). Frames: actor/<species>/<anim>/<dir>/<i> (CLAUDE.md).
// `frames` must equal contracts/actor-anims.json; tools/art/tests/test_actor.py checks the pipeline against the same file.
// Timing rule (TEC-022 implements it): e = ticks since the action started (>= 0), i = Math.floor(e / ticksPerFrame);
// a loop shows i % frames, a one-shot shows Math.min(i, frames - 1) and holds its last frame.
export interface ActorAnimTiming {
  readonly frames: number;
  readonly ticksPerFrame: number;
  readonly loop: boolean;
}

export const ACTOR_ANIMS = {
  idle: { frames: 2, ticksPerFrame: 12, loop: true },
  walk: { frames: 4, ticksPerFrame: 3, loop: true },
  attack_blade: { frames: 4, ticksPerFrame: 2, loop: false },
  attack_unarmed: { frames: 4, ticksPerFrame: 2, loop: false },
  dodge: { frames: 4, ticksPerFrame: 2, loop: false },
  hurt: { frames: 2, ticksPerFrame: 3, loop: false },
  death: { frames: 4, ticksPerFrame: 4, loop: false },
} as const satisfies Record<string, ActorAnimTiming>;

export type ActorAnim = keyof typeof ACTOR_ANIMS;
