// Starts, ends and buffers the attack and dodge actions from every character's Intent.
// One rule for players and NPCs alike. Same arithmetic restriction as movement: only + - * / and
// Math.sqrt/Math.abs, which are exactly rounded, so every JS engine computes the same bits.
import { IntentButton, type CharacterWorld } from "./character";
import { TICK_HZ } from "./constants";
import { facingToward } from "./movement";
import { Action, Facing, type FacingValue } from "./protocol";

export const ATTACK_TICKS = Math.round(0.4 * TICK_HZ); // 8 at 20 Hz; 0.4 s tunable (OQ-021)
export const DODGE_TICKS = Math.round(0.35 * TICK_HZ); // 7; 0.35 s tunable (OQ-021)
export const DODGE_DISTANCE = 48; // px = 3 tiles, tunable (OQ-021)
export const BUFFER_TICKS = Math.round(0.2 * TICK_HZ); // 4; press-buffer window, tunable

const DODGE_SPEED = (DODGE_DISTANCE * TICK_HZ) / DODGE_TICKS; // px/s
const PRESSES = IntentButton.AttackPress | IntentButton.DodgePress;

/** Unit vector of each facing (y-down). */
export const FACING_UNIT: Record<FacingValue, readonly [number, number]> = {
  [Facing.Down]: [0, 1],
  [Facing.Left]: [-1, 0],
  [Facing.Right]: [1, 0],
  [Facing.Up]: [0, -1],
};

/** Ticks an action lasts; 0 for states that don't end on their own here (Idle, Walk, Hurt, Death). */
function durationOf(state: number): number {
  if (state === Action.Attack) return ATTACK_TICKS;
  if (state === Action.Dodge) return DODGE_TICKS;
  return 0;
}

/** Starts, ends and buffers attack/dodge for every character from its Intent, for the tick that produces snapshot `tick`. */
export function stepActions(world: CharacterWorld, tick: number): void {
  const { intent, action, facing, velocity } = world.components;
  const { moveX, moveY, aimX, aimY, buttons } = intent.store;
  const { state, start } = action.store;
  const { dir } = facing.store;
  const { vx, vy } = velocity.store;

  world.ecs.each([intent, action, facing, velocity], (id, i) => {
    // 1. End. An action started at s is shown by snapshots s .. s+D-1.
    const duration = durationOf(state[i]!);
    if (duration > 0 && tick - start[i]! >= duration) {
      state[i] = Action.Idle;
      start[i] = tick;
    }

    // 2. Start, only from Idle or Walk. Dodge wins over attack.
    if (state[i] === Action.Idle || state[i] === Action.Walk) {
      const ax = aimX[i]!;
      const ay = aimY[i]!;
      if ((buttons[i]! & IntentButton.DodgePress) !== 0) {
        const mx = moveX[i]!;
        const my = moveY[i]!;
        const len2 = mx * mx + my * my;
        const a2 = ax * ax + ay * ay;
        if (!Number.isFinite(len2) || !Number.isFinite(a2)) {
          throw new RangeError(`stepActions: entity ${id} has a non-finite move (${mx}, ${my}) or aim (${ax}, ${ay})`);
        }
        const current = dir[i]! as FacingValue;
        let dx: number;
        let dy: number;
        if (len2 > 0) {
          const len = Math.sqrt(len2);
          dx = mx / len;
          dy = my / len;
        } else if (a2 > 0) {
          const len = Math.sqrt(a2);
          dx = ax / len;
          dy = ay / len;
        } else {
          [dx, dy] = FACING_UNIT[current];
        }
        // OQ-025: facing snaps to the aim, independent of the roll direction.
        dir[i] = facingToward(ax, ay, current);
        vx[i] = dx * DODGE_SPEED;
        vy[i] = dy * DODGE_SPEED;
        state[i] = Action.Dodge;
        start[i] = tick;
        buttons[i] = buttons[i]! & ~IntentButton.DodgePress;
      } else if ((buttons[i]! & IntentButton.AttackPress) !== 0) {
        dir[i] = facingToward(ax, ay, dir[i]! as FacingValue);
        state[i] = Action.Attack;
        start[i] = tick;
        buttons[i] = buttons[i]! & ~IntentButton.AttackPress;
      }
    }

    // 3. Buffer. A press made in the last BUFFER_TICKS of an action survives to start the next one
    // when it ends; earlier presses (and presses in any other busy state) are dropped.
    const s = state[i]!;
    if (s !== Action.Idle && s !== Action.Walk) {
      const busy = durationOf(s);
      const keep = busy > 0 && start[i]! + busy - tick <= BUFFER_TICKS;
      if (!keep) buttons[i] = buttons[i]! & ~PRESSES;
    }
  });
}

