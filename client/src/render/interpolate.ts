// Pure snapshot interpolation. Entities are matched by id: array order is not stable between snapshots.
import type { Snapshot } from "@overgrown/sim/protocol";

export interface Frame {
  count: number;
  ids: Uint32Array;
  x: Float32Array;
  y: Float32Array;
  kind: Uint16Array;
}

export function createFrame(): Frame {
  return { count: 0, ids: new Uint32Array(0), x: new Float32Array(0), y: new Float32Array(0), kind: new Uint16Array(0) };
}

function grow(out: Frame, count: number): void {
  if (out.ids.length >= count) return;
  out.ids = new Uint32Array(count);
  out.x = new Float32Array(count);
  out.y = new Float32Array(count);
  out.kind = new Uint16Array(count);
}

// Reused across calls so the steady state allocates nothing; cleared on every use.
const prevIndex = new Map<number, number>();

/**
 * Writes the state at `alpha` of the way from prev to curr into `out`. alpha is clamped to [0, 1].
 * Entities new in curr use curr's position (no lerp); entities only in prev are dropped.
 * `out`'s arrays only grow, so `out.count` (not array length) says how many entries are valid.
 */
export function interpolate(prev: Snapshot | null, curr: Snapshot, alpha: number, out: Frame): void {
  const a = Math.min(1, Math.max(0, alpha));
  grow(out, curr.count);
  prevIndex.clear();
  if (prev !== null) {
    for (let i = 0; i < prev.count; i++) prevIndex.set(prev.ids[i]!, i);
  }
  for (let i = 0; i < curr.count; i++) {
    const id = curr.ids[i]!;
    const cx = curr.x[i]!;
    const cy = curr.y[i]!;
    const j = prevIndex.get(id);
    out.ids[i] = id;
    out.kind[i] = curr.kind[i]!;
    if (j === undefined || prev === null) {
      out.x[i] = cx;
      out.y[i] = cy;
    } else {
      const px = prev.x[j]!;
      const py = prev.y[j]!;
      out.x[i] = px + (cx - px) * a;
      out.y[i] = py + (cy - py) * a;
    }
  }
  out.count = curr.count;
}
