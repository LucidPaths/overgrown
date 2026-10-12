// Turns every character's Intent into velocity, position, facing and a Walk/Idle action.
// One rule for players and NPCs alike. Only + - * / and Math.sqrt/Math.abs are used:
// they are exactly rounded, so every JS engine computes the same bits.
import type { CharacterWorld } from "./character";
import { TICK_HZ } from "./constants";
import { Action, Facing } from "./protocol";

export const WALK_SPEED = 80; // px/s = 5 tiles/s (OQ-025), tunable

/** Applies every character's Intent for the tick that produces snapshot `tick`. */
export function stepMovement(world: CharacterWorld, tick: number): void {
  const { position, velocity, intent, facing, action } = world.components;
  const { x, y } = position.store;
  const { vx: vxs, vy: vys } = velocity.store;
  const { moveX, moveY } = intent.store;
  const { dir } = facing.store;
  const { state, start } = action.store;

  world.ecs.each([position, velocity, intent, facing, action], (id, i) => {
    const mx = moveX[i]!;
    const my = moveY[i]!;
    const len2 = mx * mx + my * my;
    if (!Number.isFinite(len2)) {
      throw new RangeError(`stepMovement: entity ${id} has a non-finite move intent (${mx}, ${my})`);
    }
    const scale = len2 > 1 ? WALK_SPEED / Math.sqrt(len2) : WALK_SPEED;
    const vx = mx * scale;
    const vy = my * scale;
    vxs[i] = vx;
    vys[i] = vy;
    x[i] = x[i]! + vx / TICK_HZ;
    y[i] = y[i]! + vy / TICK_HZ;

    const ax = Math.abs(vx);
    const ay = Math.abs(vy);
    if (ax > ay) dir[i] = vx > 0 ? Facing.Right : Facing.Left;
    else if (ay > ax) dir[i] = vy > 0 ? Facing.Down : Facing.Up;
    // else: an exact diagonal tie or idle keeps the previous facing.

    const next = vx !== 0 || vy !== 0 ? Action.Walk : Action.Idle;
    if (state[i] !== next) {
      state[i] = next;
      start[i] = tick;
    }
  });
}
