// Sim <-> host message protocol. The single source of truth for what crosses the
// worker boundary; both sides import these types, never re-declare them.

/**
 * The local player's full input state, posted by the host whenever it changes. The sim latches the newest
 * one at the start of each tick. This shape becomes the TEC-010 network input message.
 */
export interface InputMessage {
  type: "input";
  /** Desired move direction, each axis in [-1, 1]. The sim clamps the magnitude to 1 (so W+D is a normal diagonal). */
  moveX: number;
  moveY: number;
  /** Aim point as an offset from the character's feet point, in world px (y-down). (0, 0) means "no aim". */
  aimX: number;
  aimY: number;
  /** Sprint is held. (Attack and dodge are edge actions: only their press counters are sent.) */
  sprint: boolean;
  /** Presses since the host started: u32, starting at 0, +1 per press, wrapping at 2^32. A changed value means "pressed". */
  attackPresses: number;
  dodgePresses: number;
}

export type HostToSim = { type: "init"; seed: number } | InputMessage;

/** What an entity is, for the renderer. 0 is "unset". */
export const Kind = { Character: 1 } as const;
export const Facing = { Down: 0, Left: 1, Right: 2, Up: 3 } as const;
export const Action = { Idle: 0, Walk: 1, Attack: 2, Dodge: 3, Hurt: 4, Death: 5 } as const;
export const Species = {
  Human: 0,
  Elf: 1,
  Dwarf: 2,
  Orc: 3,
  Foxfolk: 4,
  Bearfolk: 5,
  Rabbitfolk: 6,
  Birdfolk: 7,
  Lizardfolk: 8,
} as const;

export type KindValue = (typeof Kind)[keyof typeof Kind];
export type FacingValue = (typeof Facing)[keyof typeof Facing];
export type ActionValue = (typeof Action)[keyof typeof Action];
export type SpeciesValue = (typeof Species)[keyof typeof Species];

/**
 * One tick's renderable state. Column i of every array describes the same entity.
 * Arrays are backed by plain ArrayBuffers (never SharedArrayBuffer) so they can be transferred.
 */
export interface Snapshot {
  tick: number;
  count: number;
  ids: Uint32Array<ArrayBuffer>;
  /** Absolute world px, y-down: the character's feet point. */
  x: Float32Array<ArrayBuffer>;
  y: Float32Array<ArrayBuffer>;
  kind: Uint16Array<ArrayBuffer>;
  /** FacingValue */
  facing: Uint8Array<ArrayBuffer>;
  /** ActionValue */
  action: Uint8Array<ArrayBuffer>;
  /** Tick of the first snapshot that shows this action. */
  actionStart: Uint32Array<ArrayBuffer>;
  /** SpeciesValue */
  species: Uint8Array<ArrayBuffer>;
  /** The local player's EntityId, or -1 if none (EntityIds are never negative). */
  you: number;
}

export type SimToHost = { type: "snapshot"; snapshot: Snapshot } | { type: "error"; message: string };

/** The transfer list for postMessage: every buffer the snapshot owns, so nothing is copied. */
export function snapshotBuffers(s: Snapshot): ArrayBuffer[] {
  return [
    s.ids.buffer,
    s.x.buffer,
    s.y.buffer,
    s.kind.buffer,
    s.facing.buffer,
    s.action.buffer,
    s.actionStart.buffer,
    s.species.buffer,
  ];
}
