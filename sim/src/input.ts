// The host input latch: validates InputMessages and writes the newest one into a character's Intent at tick start.
import { IntentButton, type CharacterWorld } from "./character";
import type { EntityId } from "./ecs";
import type { InputMessage } from "./protocol";

export interface InputLatch {
  latest: InputMessage | null;
  attackSeen: number;
  dodgeSeen: number;
}

/** latest = null; both seen counters 0, matching the host's starting counters. */
export function createInputLatch(): InputLatch {
  return { latest: null, attackSeen: 0, dodgeSeen: 0 };
}

function invalid(field: string, value: unknown, want: string): RangeError {
  return new RangeError(`input: ${field} must be ${want}, got ${String(value)}`);
}

function assertUnitAxis(field: string, v: unknown): void {
  if (typeof v !== "number" || !Number.isFinite(v) || v < -1 || v > 1) throw invalid(field, v, "a finite number in [-1, 1]");
}

function assertFinite(field: string, v: unknown): void {
  if (typeof v !== "number" || !Number.isFinite(v)) throw invalid(field, v, "a finite number");
}

function assertU32(field: string, v: unknown): void {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 0xffffffff) {
    throw invalid(field, v, "an integer in 0..4294967295");
  }
}

/** Throws a RangeError naming the first invalid field and its value. */
export function assertInputMessage(msg: InputMessage): void {
  assertUnitAxis("moveX", msg.moveX);
  assertUnitAxis("moveY", msg.moveY);
  assertFinite("aimX", msg.aimX);
  assertFinite("aimY", msg.aimY);
  if (typeof msg.sprint !== "boolean") throw invalid("sprint", msg.sprint, "a boolean");
  assertU32("attackPresses", msg.attackPresses);
  assertU32("dodgePresses", msg.dodgePresses);
}

/** Tick start: writes `latch.latest` into character `id`'s Intent. No-op until the first message. */
export function latchInput(latch: InputLatch, world: CharacterWorld, id: EntityId): void {
  const msg = latch.latest;
  if (msg === null) return;
  const i = world.ecs.indexOf(id);
  const { moveX, moveY, aimX, aimY, buttons } = world.components.intent.store;
  moveX[i] = msg.moveX;
  moveY[i] = msg.moveY;
  aimX[i] = msg.aimX;
  aimY[i] = msg.aimY;
  // Pending press bits are kept: that is the buffer stepActions relies on.
  const pending = buttons[i]! & (IntentButton.AttackPress | IntentButton.DodgePress);
  const newPresses =
    (msg.attackPresses !== latch.attackSeen ? IntentButton.AttackPress : 0) |
    (msg.dodgePresses !== latch.dodgeSeen ? IntentButton.DodgePress : 0);
  buttons[i] = (msg.sprint ? IntentButton.Sprint : 0) | pending | newPresses;
  latch.attackSeen = msg.attackPresses;
  latch.dodgeSeen = msg.dodgePresses;
}
