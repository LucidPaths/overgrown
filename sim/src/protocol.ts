// Sim <-> host message protocol. The single source of truth for what crosses the
// worker boundary; both sides import these types, never re-declare them.

export type HostToSim = { type: "init"; seed: number };

/**
 * One tick's renderable state. Column i of every array describes the same entity.
 * Arrays are backed by plain ArrayBuffers (never SharedArrayBuffer) so they can be transferred.
 */
export interface Snapshot {
  tick: number;
  count: number;
  ids: Uint32Array<ArrayBuffer>;
  x: Float32Array<ArrayBuffer>;
  y: Float32Array<ArrayBuffer>;
  kind: Uint16Array<ArrayBuffer>;
}

export type SimToHost = { type: "snapshot"; snapshot: Snapshot } | { type: "error"; message: string };

export const Kind = { DebugMover: 1 } as const;

/** The transfer list for postMessage: every buffer the snapshot owns, so nothing is copied. */
export function snapshotBuffers(s: Snapshot): ArrayBuffer[] {
  return [s.ids.buffer, s.x.buffer, s.y.buffer, s.kind.buffer];
}
