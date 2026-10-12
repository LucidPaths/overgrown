import { describe, expect, it } from "vitest";
import { createCharacterWorld, spawnCharacter, type CharacterWorld } from "./character";
import { World, type EntityId } from "./ecs";
import { stepMovement } from "./movement";
import { Action, Facing, Species } from "./protocol";

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
    for (let tick = 1; tick <= 20; tick++) stepMovement(world, tick);

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
    stepMovement(world, 1);
    expect(state(world, id)).toMatchObject({ facing: Facing.Right, action: Action.Walk, start: 1 });

    setIntent(world, id, 1, 1);
    stepMovement(world, 2);
    expect(state(world, id)).toMatchObject({ facing: Facing.Right, action: Action.Walk, start: 1 });

    setIntent(world, id, 0, -1);
    stepMovement(world, 3);
    expect(state(world, id)).toMatchObject({ facing: Facing.Up, action: Action.Walk, start: 1 });

    setIntent(world, id, 0, 0);
    stepMovement(world, 4);
    expect(state(world, id)).toMatchObject({ facing: Facing.Up, action: Action.Idle, start: 4 });
  });
});
