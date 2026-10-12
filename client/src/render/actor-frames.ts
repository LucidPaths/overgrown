// Snapshot actor state → atlas frame name actor/<species>/<anim>/<dir>/<i> (TEC-022).
// Frame counts and timing come from ACTOR_ANIMS (ART-006); key strings are checked against contracts/actor-anims.json by the test.
import { Action, Facing, Species, type ActionValue, type FacingValue, type SpeciesValue } from "@overgrown/sim/protocol";
import { ACTOR_ANIMS, type ActorAnim, type ActorAnimTiming } from "./actor-anims";

const SPECIES_KEYS: Record<SpeciesValue, string> = {
  [Species.Human]: "human",
  [Species.Elf]: "elf",
  [Species.Dwarf]: "dwarf",
  [Species.Orc]: "orc",
  [Species.Foxfolk]: "foxfolk",
  [Species.Bearfolk]: "bearfolk",
  [Species.Rabbitfolk]: "rabbitfolk",
  [Species.Birdfolk]: "birdfolk",
  [Species.Lizardfolk]: "lizardfolk",
};

const DIR_KEYS: Record<FacingValue, string> = {
  [Facing.Down]: "down",
  [Facing.Left]: "left",
  [Facing.Right]: "right",
  [Facing.Up]: "up",
};

/** The animation each action plays. */
export const ACTION_ANIMS: Record<ActionValue, ActorAnim> = {
  [Action.Idle]: "idle",
  [Action.Walk]: "walk",
  // M1 has no weapons, so every attack is unarmed (OQ-022). This is the one switch point:
  // ART-009/CMB-007 pick the attack anim from the equipped weapon family (attack_blade, …) here.
  [Action.Attack]: "attack_unarmed",
  [Action.Dodge]: "dodge",
  [Action.Hurt]: "hurt",
  [Action.Death]: "death",
};

/** Looks up a raw snapshot value in an enum-keyed table; RangeError naming the field and value if it is not a key. */
function lookup<T>(table: Record<number, T>, field: string, value: number): T {
  const found = (table as Record<number, T | undefined>)[value];
  if (found === undefined) {
    throw new RangeError(`actor ${field} ${value} is not a known ${field} value`);
  }
  return found;
}

/**
 * Frame index `elapsed` ticks into an animation: i = floor(elapsed / ticksPerFrame); a loop shows i % frames,
 * a one-shot shows min(i, frames - 1) and holds its last frame. RangeError unless `elapsed` is an integer >= 0.
 */
export function animFrameIndex(timing: ActorAnimTiming, elapsed: number): number {
  if (!Number.isInteger(elapsed) || elapsed < 0) {
    throw new RangeError(`animation elapsed ticks ${elapsed} must be an integer >= 0`);
  }
  const i = Math.floor(elapsed / timing.ticksPerFrame);
  return timing.loop ? i % timing.frames : Math.min(i, timing.frames - 1);
}

/**
 * The atlas frame for one character at snapshot `tick`. The arguments are raw snapshot column values.
 * RangeError naming the field and its value if species, facing or action is not in its enum,
 * or if actionStart is after tick.
 */
export function actorFrame(species: number, facing: number, action: number, actionStart: number, tick: number): string {
  const speciesKey = lookup(SPECIES_KEYS, "species", species);
  const dirKey = lookup(DIR_KEYS, "facing", facing);
  const anim = lookup(ACTION_ANIMS, "action", action);
  if (actionStart > tick) {
    throw new RangeError(`actor actionStart ${actionStart} is after snapshot tick ${tick}`);
  }
  return `actor/${speciesKey}/${anim}/${dirKey}/${animFrameIndex(ACTOR_ANIMS[anim], tick - actionStart)}`;
}

/** Every name actorFrame can return: species × dirs × each anim in ACTION_ANIMS (deduplicated) × its frames. */
export function actorFrameNames(): string[] {
  const anims = new Set(Object.values(ACTION_ANIMS));
  const names: string[] = [];
  for (const speciesKey of Object.values(SPECIES_KEYS)) {
    for (const anim of anims) {
      for (const dirKey of Object.values(DIR_KEYS)) {
        for (let i = 0; i < ACTOR_ANIMS[anim].frames; i++) {
          names.push(`actor/${speciesKey}/${anim}/${dirKey}/${i}`);
        }
      }
    }
  }
  return names;
}
