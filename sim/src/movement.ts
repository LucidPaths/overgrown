// Turns every character's Intent into velocity, position, facing and a Walk/Idle action.
// One rule for players and NPCs alike. Only + - * / and Math.sqrt/Math.abs are used:
// they are exactly rounded, so every JS engine computes the same bits.
import { IntentButton, type CharacterWorld } from "./character";
import { TICK_HZ } from "./constants";
import { Action, Facing, type FacingValue } from "./protocol";

export const WALK_SPEED = 80; // px/s = 5 tiles/s (OQ-025), tunable
export const SPRINT_MULTIPLIER = 1.6; // OQ-021, tunable

/** The facing for a direction: its dominant axis (y-down). An exact tie, including (0, 0), keeps `current`. */
export function facingToward(dx: number, dy: number, current: FacingValue): FacingValue {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay) return dx > 0 ? Facing.Right : Facing.Left;
  if (ay > ax) return dy > 0 ? Facing.Down : Facing.Up;
  return current;
}

/** Applies every character's Intent for the tick that produces snapshot `tick`. */
export function stepMovement(world: CharacterWorld, tick: number): void {
  const { position, velocity, intent, facing, action } = world.components;
  const { x, y } = position.store;
  const { vx: vxs, vy: vys } = velocity.store;
  const { moveX, moveY, buttons } = intent.store;
  const { dir } = facing.store;
  const { state, start } = action.store;

  world.ecs.each([position, velocity, intent, facing, action], (id, i) => {
    const current = state[i]!;
    if (current === Action.Dodge) {
      // The roll keeps the velocity stepActions set; the move intent is ignored and facing is held.
      x[i] = x[i]! + vxs[i]! / TICK_HZ;
      y[i] = y[i]! + vys[i]! / TICK_HZ;
      return;
    }
    if (current !== Action.Idle && current !== Action.Walk) {
      // Attack (later Hurt/Death): rooted, facing held.
      vxs[i] = 0;
      vys[i] = 0;
      return;
    }

    const mx = moveX[i]!;
    const my = moveY[i]!;
    const len2 = mx * mx + my * my;
    if (!Number.isFinite(len2)) {
      throw new RangeError(`stepMovement: entity ${id} has a non-finite move intent (${mx}, ${my})`);
    }
    const speed = (buttons[i]! & IntentButton.Sprint) !== 0 ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED;
    const scale = len2 > 1 ? speed / Math.sqrt(len2) : speed;
    const vx = mx * scale;
    const vy = my * scale;
    vxs[i] = vx;
    vys[i] = vy;
    x[i] = x[i]! + vx / TICK_HZ;
    y[i] = y[i]! + vy / TICK_HZ;

    dir[i] = facingToward(vx, vy, dir[i]! as FacingValue);

    const next = vx !== 0 || vy !== 0 ? Action.Walk : Action.Idle;
    if (current !== next) {
      state[i] = next;
      start[i] = tick;
    }
  });
}
