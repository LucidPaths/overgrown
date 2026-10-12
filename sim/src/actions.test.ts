import { describe, expect, it } from "vitest";
import { ATTACK_TICKS, BUFFER_TICKS, DODGE_DISTANCE, DODGE_TICKS, stepActions } from "./actions";
import { createCharacterWorld, IntentButton, spawnCharacter, type CharacterWorld } from "./character";
import { World, type EntityId } from "./ecs";
import { stepMovement } from "./movement";
import { Action, Facing, Species } from "./protocol";
import { openGround } from "./world/test-ground";

interface IntentPatch {
  move?: [number, number];
  aim?: [number, number];
  /** Bits OR-ed into buttons. */
  press?: number;
  /** Replaces buttons. */
  buttons?: number;
}

function spawn(world: CharacterWorld): EntityId {
  return spawnCharacter(world, { x: 0, y: 0, species: Species.Human, tick: 0 });
}

function setIntent(world: CharacterWorld, id: EntityId, patch: IntentPatch): void {
  const i = world.ecs.indexOf(id);
  const s = world.components.intent.store;
  if (patch.move) [s.moveX[i], s.moveY[i]] = patch.move;
  if (patch.aim) [s.aimX[i], s.aimY[i]] = patch.aim;
  if (patch.buttons !== undefined) s.buttons[i] = patch.buttons;
  if (patch.press !== undefined) s.buttons[i] = s.buttons[i]! | patch.press;
}

/** One sim tick without the input latch: actions, then movement. */
function tickOnce(world: CharacterWorld, tick: number): void {
  stepActions(world, tick);
  stepMovement(world, tick, openGround);
}

function state(world: CharacterWorld, id: EntityId) {
  const i = world.ecs.indexOf(id);
  const c = world.components;
  return {
    x: c.position.store.x[i]!,
    y: c.position.store.y[i]!,
    facing: c.facing.store.dir[i]!,
    action: c.action.store.state[i]!,
    start: c.action.store.start[i]!,
    buttons: c.intent.store.buttons[i]!,
  };
}

describe("stepActions", () => {
  it("attack: rooted for ATTACK_TICKS, facing snaps to the aim, then Walk resumes", () => {
    const world = createCharacterWorld(new World());
    const id = spawn(world);
    setIntent(world, id, { move: [1, 0], aim: [0, -10], press: IntentButton.AttackPress });

    tickOnce(world, 1);
    const first = state(world, id);
    expect(first).toMatchObject({ action: Action.Attack, start: 1, facing: Facing.Up });
    expect(first.buttons & IntentButton.AttackPress).toBe(0);
    for (let tick = 2; tick <= ATTACK_TICKS; tick++) {
      tickOnce(world, tick);
      expect(state(world, id)).toMatchObject({ x: 0, action: Action.Attack, facing: Facing.Up });
    }

    tickOnce(world, ATTACK_TICKS + 1);
    expect(state(world, id)).toMatchObject({ action: Action.Walk, start: ATTACK_TICKS + 1, x: 4, facing: Facing.Right });
  });

  it("dodge: rolls DODGE_DISTANCE over DODGE_TICKS in the move direction, else the aim, else facing; facing snaps to the aim; intent is ignored mid-roll", () => {
    const world = createCharacterWorld(new World());
    const b = spawn(world);
    const c = spawn(world);
    const d = spawn(world);

    // Tick 1: B and C start rolling; D walks one tick to face Left.
    setIntent(world, b, { move: [1, 0.5], aim: [0, -10], press: IntentButton.DodgePress });
    setIntent(world, c, { move: [0, 0], aim: [0, 20], press: IntentButton.DodgePress });
    setIntent(world, d, { move: [-1, 0] });
    tickOnce(world, 1);
    expect(state(world, b)).toMatchObject({ action: Action.Dodge, start: 1, facing: Facing.Up });
    const d0 = state(world, d);
    expect(d0.facing).toBe(Facing.Left);

    // Tick 2: B's move intent changes mid-roll (ignored); D starts rolling with no move and no aim.
    setIntent(world, b, { move: [-1, 0] });
    setIntent(world, d, { move: [0, 0], aim: [0, 0], press: IntentButton.DodgePress });
    for (let tick = 2; tick <= DODGE_TICKS; tick++) tickOnce(world, tick);

    const bEnd = state(world, b);
    expect(Math.abs(Math.hypot(bEnd.x, bEnd.y) - DODGE_DISTANCE)).toBeLessThan(1e-9);
    expect(Math.abs(bEnd.y / bEnd.x - 0.5)).toBeLessThan(1e-9);
    const cEnd = state(world, c);
    expect(Math.abs(cEnd.y - DODGE_DISTANCE)).toBeLessThan(1e-9);
    expect(cEnd.x).toBe(0);
    expect(cEnd.facing).toBe(Facing.Down);

    tickOnce(world, DODGE_TICKS + 1);
    const bAfter = state(world, b);
    expect(bAfter).toMatchObject({ action: Action.Walk, start: DODGE_TICKS + 1, facing: Facing.Left });
    expect(Math.abs(bAfter.x - (bEnd.x - 4))).toBeLessThan(1e-9);
    // D's roll (ticks 2 .. DODGE_TICKS + 1) went along its facing.
    const dEnd = state(world, d);
    expect(Math.abs(dEnd.x - (d0.x - DODGE_DISTANCE))).toBeLessThan(1e-9);
    expect(dEnd.y).toBe(0);
    expect(dEnd.facing).toBe(Facing.Left);
  });

  it("sprint: 128 px/s on an axis and a diagonal, nothing when not moving", () => {
    const world = createCharacterWorld(new World());
    const axis = spawn(world);
    const diagonal = spawn(world);
    const still = spawn(world);
    setIntent(world, axis, { move: [1, 0], buttons: IntentButton.Sprint });
    setIntent(world, diagonal, { move: [-1, 1], buttons: IntentButton.Sprint });
    setIntent(world, still, { move: [0, 0], buttons: IntentButton.Sprint });
    for (let tick = 1; tick <= 20; tick++) tickOnce(world, tick);

    const a = state(world, axis);
    expect(Math.abs(a.x - 128)).toBeLessThan(1e-9);
    expect(a.action).toBe(Action.Walk);
    const dg = state(world, diagonal);
    expect(Math.abs(Math.hypot(dg.x, dg.y) - 128)).toBeLessThan(1e-9);
    expect(state(world, still)).toMatchObject({ x: 0, y: 0, action: Action.Idle });
  });

  it("buffer: a press in the last BUFFER_TICKS starts the next action when the current one ends; an earlier press is dropped", () => {
    const world = createCharacterWorld(new World());
    const id = spawn(world);
    setIntent(world, id, { press: IntentButton.AttackPress });
    tickOnce(world, 1);
    expect(state(world, id)).toMatchObject({ action: Action.Attack, start: 1 });
    const end = 1 + ATTACK_TICKS;

    expect(end - 2).toBeGreaterThan(BUFFER_TICKS);
    setIntent(world, id, { press: IntentButton.AttackPress });
    tickOnce(world, 2);
    expect(state(world, id).buttons & IntentButton.AttackPress).toBe(0);

    for (let tick = 3; tick < end - BUFFER_TICKS; tick++) tickOnce(world, tick);
    setIntent(world, id, { press: IntentButton.DodgePress });
    for (let tick = end - BUFFER_TICKS; tick <= end - 1; tick++) tickOnce(world, tick);
    expect(state(world, id).buttons & IntentButton.DodgePress).not.toBe(0);
    expect(state(world, id).action).toBe(Action.Attack);

    tickOnce(world, end);
    expect(state(world, id)).toMatchObject({ action: Action.Dodge, start: end });
    for (let tick = end + 1; tick <= end + DODGE_TICKS; tick++) {
      tickOnce(world, tick);
      expect(state(world, id).action).not.toBe(Action.Attack);
    }
  });
});
