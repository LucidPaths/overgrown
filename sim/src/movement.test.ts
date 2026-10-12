import { describe, expect, it } from "vitest";
import { createCharacterWorld, IntentButton, spawnCharacter, type CharacterWorld } from "./character";
import { DODGE_TICKS, stepActions } from "./actions";
import { World, type EntityId } from "./ecs";
import { stepMovement } from "./movement";
import { Action, Facing, Species } from "./protocol";
import { groundFromRows, openGround } from "./world/test-ground";
import { Tile } from "./world/tile";
import { SHALLOW_WATER_SPEED } from "./world/walkability";

function setIntent(world: CharacterWorld, id: EntityId, moveX: number, moveY: number): void {
  const i = world.ecs.indexOf(id);
  world.components.intent.store.moveX[i] = moveX;
  world.components.intent.store.moveY[i] = moveY;
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
  };
}

describe("stepMovement", () => {
  it("movement: walks 80 px/s on an axis, the same speed on a diagonal, and keeps sub-unit stick magnitudes", () => {
    const world = createCharacterWorld(new World());
    const axis = spawnCharacter(world, { x: 0, y: 0, species: Species.Human, tick: 0 });
    const diagonal = spawnCharacter(world, { x: 0, y: 0, species: Species.Orc, tick: 0 });
    const half = spawnCharacter(world, { x: 0, y: 0, species: Species.Elf, tick: 0 });
    setIntent(world, axis, 1, 0);
    setIntent(world, diagonal, -1, 1);
    setIntent(world, half, 0.5, 0);
    for (let tick = 1; tick <= 20; tick++) stepMovement(world, tick, openGround);

    expect(state(world, axis).x).toBe(80);
    expect(state(world, axis).y).toBe(0);
    const d = state(world, diagonal);
    expect(Math.abs(Math.hypot(d.x, d.y) - 80)).toBeLessThan(1e-9);
    expect(state(world, half).x).toBe(40);
  });

  it("movement: facing follows the dominant axis and holds on exact diagonals and when idle; action is Walk/Idle with actionStart at the change tick", () => {
    const world = createCharacterWorld(new World());
    const id = spawnCharacter(world, { x: 0, y: 0, species: Species.Human, tick: 0 });
    expect(state(world, id)).toMatchObject({ facing: Facing.Down, action: Action.Idle, start: 0 });

    setIntent(world, id, 1, 0);
    stepMovement(world, 1, openGround);
    expect(state(world, id)).toMatchObject({ facing: Facing.Right, action: Action.Walk, start: 1 });

    setIntent(world, id, 1, 1);
    stepMovement(world, 2, openGround);
    expect(state(world, id)).toMatchObject({ facing: Facing.Right, action: Action.Walk, start: 1 });

    setIntent(world, id, 0, -1);
    stepMovement(world, 3, openGround);
    expect(state(world, id)).toMatchObject({ facing: Facing.Up, action: Action.Walk, start: 1 });

    setIntent(world, id, 0, 0);
    stepMovement(world, 4, openGround);
    expect(state(world, id)).toMatchObject({ facing: Facing.Up, action: Action.Idle, start: 4 });
  });

  it("collision: shallow water slows walk, sprint and dodge displacement by SHALLOW_WATER_SPEED", () => {
    const shallow = () => Tile.ShallowWater;
    const spawnAt = (): { world: CharacterWorld; id: EntityId } => {
      const world = createCharacterWorld(new World());
      return { world, id: spawnCharacter(world, { x: 8, y: 8, species: Species.Human, tick: 0 }) };
    };

    const walk = spawnAt();
    setIntent(walk.world, walk.id, 1, 0);
    stepMovement(walk.world, 1, shallow);
    expect(Math.abs(state(walk.world, walk.id).x - (8 + (80 * SHALLOW_WATER_SPEED) / 20))).toBeLessThan(1e-9);
    // The stored velocity stays the requested one.
    const vi = walk.world.ecs.indexOf(walk.id);
    expect(walk.world.components.velocity.store.vx[vi]).toBe(80);

    const dry = spawnAt();
    setIntent(dry.world, dry.id, 1, 0);
    stepMovement(dry.world, 1, openGround);
    expect(state(dry.world, dry.id).x).toBe(8 + 4);

    const sprint = spawnAt();
    setIntent(sprint.world, sprint.id, 1, 0);
    sprint.world.components.intent.store.buttons[sprint.world.ecs.indexOf(sprint.id)] = IntentButton.Sprint;
    stepMovement(sprint.world, 1, shallow);
    expect(Math.abs(state(sprint.world, sprint.id).x - (8 + (128 * SHALLOW_WATER_SPEED) / 20))).toBeLessThan(1e-9);

    const roll = spawnAt();
    setIntent(roll.world, roll.id, 1, 0);
    roll.world.components.intent.store.buttons[roll.world.ecs.indexOf(roll.id)] = IntentButton.DodgePress;
    for (let tick = 1; tick <= DODGE_TICKS; tick++) {
      stepActions(roll.world, tick);
      stepMovement(roll.world, tick, shallow);
    }
    expect(Math.abs(state(roll.world, roll.id).x - (8 + 48 * SHALLOW_WATER_SPEED))).toBeLessThan(1e-9);
  });

  it("collision: a dodge into a cliff stops flush at the wall and stays Dodge for DODGE_TICKS", () => {
    const wall = groundFromRows(Array.from({ length: 6 }, () => "#"), 3, -3);
    const world = createCharacterWorld(new World());
    const id = spawnCharacter(world, { x: 8, y: 8, species: Species.Human, tick: 0 });
    setIntent(world, id, 1, 0);
    world.components.intent.store.buttons[world.ecs.indexOf(id)] = IntentButton.DodgePress;
    for (let tick = 1; tick <= DODGE_TICKS; tick++) {
      stepActions(world, tick);
      stepMovement(world, tick, wall);
      expect(state(world, id), `tick ${tick}`).toMatchObject({ action: Action.Dodge, start: 1 });
    }
    expect(state(world, id)).toMatchObject({ x: 3 * 16 - 5, y: 8 });
  });
});
