// The one character entity, shared by players and NPCs: same components, same spawn path.
import type { Component, EntityId, World } from "./ecs";
import { Action, Facing, Kind, type SpeciesValue } from "./protocol";

export const FOOT_HALF_W = 5; // px; 10×6 foot box (OQ-025), tunable
export const FOOT_HALF_H = 3;

export interface CharacterComponents {
  /** The feet point = the sprite's bottom centre, world px, y-down. */
  position: Component<{ x: "f64"; y: "f64" }>;
  /** px/s, written by movement. */
  velocity: Component<{ vx: "f64"; vy: "f64" }>;
  /** FacingValue */
  facing: Component<{ dir: "u8" }>;
  /** Half-extents; the box is [x-hw, x+hw] × [y-2hh, y]. */
  collider: Component<{ hw: "f32"; hh: "f32" }>;
  /**
   * What the character wants to do this tick. moveX/moveY: desired move direction, magnitude 0..1
   * (movement clamps larger values to 1). aimX/aimY: aim offset from the character in world px.
   * buttons: a bitfield of IntentButton bits (below). Written by the host input latch (later AI);
   * stepActions reads aim and the press bits, stepMovement reads Sprint.
   */
  intent: Component<{ moveX: "f32"; moveY: "f32"; aimX: "f32"; aimY: "f32"; buttons: "u8" }>;
  /** ActionValue + the tick it started. */
  action: Component<{ state: "u8"; start: "u32" }>;
  /** SpeciesValue */
  species: Component<{ species: "u8" }>;
  /** KindValue */
  kind: Component<{ kind: "u16" }>;
}

/**
 * Intent.buttons bits. Sprint mirrors what is held now. *Press bits are edges: set by whoever writes the
 * Intent (the host input latch, later AI), consumed or dropped by stepActions.
 */
export const IntentButton = { Sprint: 1, AttackPress: 2, DodgePress: 4 } as const;

/** The ECS world plus the character components registered in it. */
export interface CharacterWorld {
  readonly ecs: World;
  readonly components: CharacterComponents;
}

export function createCharacterWorld(ecs: World): CharacterWorld {
  return {
    ecs,
    components: {
      position: ecs.register("Position", { x: "f64", y: "f64" }),
      velocity: ecs.register("Velocity", { vx: "f64", vy: "f64" }),
      facing: ecs.register("Facing", { dir: "u8" }),
      collider: ecs.register("Collider", { hw: "f32", hh: "f32" }),
      intent: ecs.register("Intent", { moveX: "f32", moveY: "f32", aimX: "f32", aimY: "f32", buttons: "u8" }),
      action: ecs.register("Action", { state: "u8", start: "u32" }),
      species: ecs.register("Species", { species: "u8" }),
      kind: ecs.register("Kind", { kind: "u16" }),
    },
  };
}

export interface SpawnCharacterOptions {
  x: number;
  y: number;
  species: SpeciesValue;
  tick: number;
}

/** The only way to make a character, player or NPC. */
export function spawnCharacter(world: CharacterWorld, opts: SpawnCharacterOptions): EntityId {
  const { x, y, species, tick } = opts;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError(`spawnCharacter: position must be finite, got (${x}, ${y})`);
  }
  const { ecs, components: c } = world;
  const id = ecs.create();
  // add() zeroes every column, so Velocity and Intent start at 0.
  for (const component of Object.values(c)) ecs.add(id, component);
  const index = ecs.indexOf(id);
  c.position.store.x[index] = x;
  c.position.store.y[index] = y;
  c.facing.store.dir[index] = Facing.Down;
  c.collider.store.hw[index] = FOOT_HALF_W;
  c.collider.store.hh[index] = FOOT_HALF_H;
  c.action.store.state[index] = Action.Idle;
  c.action.store.start[index] = tick;
  c.species.store.species[index] = species;
  c.kind.store.kind[index] = Kind.Character;
  return id;
}
