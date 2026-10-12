// Temporary scaffolding: squares that drift and bounce so the sim -> renderer path
// has something to show. Replaced by real entities in M1/M2.
import type { Component, World } from "./ecs";
import { Kind } from "./protocol";
import type { Rng } from "./rng";

export const MOVER_AREA_W = 640;
export const MOVER_AREA_H = 360;
const MIN_SPEED = 20; // px/s
const MAX_SPEED = 60; // px/s

export interface MoverComponents {
  readonly position: Component<{ x: "f32"; y: "f32" }>;
  readonly velocity: Component<{ vx: "f32"; vy: "f32" }>;
  readonly kind: Component<{ kind: "u16" }>;
}

export function spawnDebugMovers(world: World, components: MoverComponents, rng: Rng, n = 64): void {
  const { position, velocity, kind } = components;
  for (let i = 0; i < n; i++) {
    const id = world.create();
    world.add(id, position);
    world.add(id, velocity);
    world.add(id, kind);
    const index = world.indexOf(id);
    position.store.x[index] = rng.nextFloat() * MOVER_AREA_W;
    position.store.y[index] = rng.nextFloat() * MOVER_AREA_H;

    // Random direction by rejection-sampling the unit disk: only +, *, sqrt (all exactly
    // rounded in IEEE 754), so every JS engine gets the same bits. Math.cos/sin are not
    // guaranteed identical across engines.
    let dx = 0;
    let dy = 0;
    let len2 = 0;
    while (len2 === 0 || len2 > 1) {
      dx = rng.nextFloat() * 2 - 1;
      dy = rng.nextFloat() * 2 - 1;
      len2 = dx * dx + dy * dy;
    }
    const speed = MIN_SPEED + rng.nextFloat() * (MAX_SPEED - MIN_SPEED);
    const scale = speed / Math.sqrt(len2);
    velocity.store.vx[index] = dx * scale;
    velocity.store.vy[index] = dy * scale;
    kind.store.kind[index] = Kind.DebugMover;
  }
}

/** Integrates position by dt seconds and reflects movers off the area edges. */
export function stepDebugMovers(world: World, components: MoverComponents, dt: number): void {
  const { x, y } = components.position.store;
  const { vx, vy } = components.velocity.store;
  world.each([components.position, components.velocity], (_id, index) => {
    [x[index], vx[index]] = bounce(x[index]! + vx[index]! * dt, vx[index]!, MOVER_AREA_W);
    [y[index], vy[index]] = bounce(y[index]! + vy[index]! * dt, vy[index]!, MOVER_AREA_H);
  });
}

function bounce(p: number, v: number, max: number): [number, number] {
  if (p < 0) return [-p, -v];
  if (p > max) return [2 * max - p, -v];
  return [p, v];
}
