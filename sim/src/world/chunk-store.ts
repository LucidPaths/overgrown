// Chunk streaming and the chunk cache. Contract: CLAUDE.md "Chunk streaming".
// Pure sim code: which chunks are loaded depends only on the anchors and the calls made, never on time.
import { CHUNK_TILES, TILE_PX } from "../constants";
import type { ChunkStreamMessage } from "../protocol";
import { generateChunk, type ChunkData } from "./chunk-gen";
import type { TileValue } from "./tile";

// Chebyshev radius, in chunks, around each anchor's chunk that is loaded and sent to the host.
export const LOAD_RADIUS = 2;
// Loaded chunks farther than this (Chebyshev, chunks) from every anchor's chunk are unloaded. > LOAD_RADIUS (hysteresis).
export const UNLOAD_RADIUS = 3;
// Most chunks stream() generates per tick. Cache hits and tileAt() generation don't count.
export const GEN_PER_TICK = 2;
// LRU capacity for unloaded chunks kept for a quick return. Loaded chunks are never evicted and don't count.
export const RECENT_CHUNKS = 64;

const CHUNK_PX = TILE_PX * CHUNK_TILES;

export interface ChunkCoord {
  cx: number;
  cy: number;
}
// World px (a character's Position).
export interface AnchorPos {
  x: number;
  y: number;
}
export interface StreamPlan {
  unload: ChunkCoord[];
  load: ChunkCoord[];
}
export type GenerateChunk = (seed: number, cx: number, cy: number) => ChunkData;

// Chunk coordinate of a world px coordinate: Math.floor(Math.floor(px / TILE_PX) / CHUNK_TILES) (M1 contract).
export function chunkOf(px: number): number {
  return Math.floor(Math.floor(px / TILE_PX) / CHUNK_TILES);
}

function keyOf(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

// Pure. unload: every chunk in `loaded` whose Chebyshev distance to every anchor's chunk exceeds UNLOAD_RADIUS,
// in `loaded` iteration order. load: every chunk within LOAD_RADIUS of some anchor's chunk that is not in `loaded`,
// sorted by (d², cy, cx) ascending, where d² is the smallest squared distance from an anchor position to the chunk
// centre (cx * CHUNK_PX + CHUNK_PX / 2, cy * CHUNK_PX + CHUNK_PX / 2), CHUNK_PX = TILE_PX * CHUNK_TILES.
// RangeError naming the anchor index if an anchor coordinate is not finite. No anchors → unload everything, load nothing.
export function planStream(anchors: readonly AnchorPos[], loaded: Iterable<ChunkCoord>): StreamPlan {
  const centres: ChunkCoord[] = anchors.map((a, i) => {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) {
      throw new RangeError(`planStream: anchor ${i} must have a finite position, got (${a.x}, ${a.y})`);
    }
    return { cx: chunkOf(a.x), cy: chunkOf(a.y) };
  });
  const near = (c: ChunkCoord, radius: number): boolean =>
    centres.some((a) => Math.max(Math.abs(c.cx - a.cx), Math.abs(c.cy - a.cy)) <= radius);

  const unload: ChunkCoord[] = [];
  const held = new Set<string>();
  for (const c of loaded) {
    held.add(keyOf(c.cx, c.cy));
    if (!near(c, UNLOAD_RADIUS)) unload.push({ cx: c.cx, cy: c.cy });
  }

  const due = new Map<string, { cx: number; cy: number; d2: number }>();
  for (const a of centres) {
    for (let cy = a.cy - LOAD_RADIUS; cy <= a.cy + LOAD_RADIUS; cy++) {
      for (let cx = a.cx - LOAD_RADIUS; cx <= a.cx + LOAD_RADIUS; cx++) {
        const key = keyOf(cx, cy);
        if (held.has(key) || due.has(key)) continue;
        const mx = cx * CHUNK_PX + CHUNK_PX / 2;
        const my = cy * CHUNK_PX + CHUNK_PX / 2;
        let d2 = Infinity;
        for (const p of anchors) {
          const dx = mx - p.x;
          const dy = my - p.y;
          d2 = Math.min(d2, dx * dx + dy * dy);
        }
        due.set(key, { cx, cy, d2 });
      }
    }
  }
  const load = [...due.values()]
    .sort((a, b) => a.d2 - b.d2 || a.cy - b.cy || a.cx - b.cx)
    .map(({ cx, cy }) => ({ cx, cy }));
  return { unload, load };
}

export interface ChunkStore {
  // The tile at world tile (tx, ty). Generates the chunk synchronously if it isn't cached, so it is never undefined.
  // RangeError naming tx or ty unless it is an integer; generateChunk's RangeError for chunks outside its range.
  tileAt(tx: number, ty: number): TileValue;
  // One tick of streaming for these anchors: queues unchunk then chunk messages.
  stream(anchors: readonly AnchorPos[]): void;
  // Returns the messages queued since the last call, in order, and clears the queue.
  drain(): ChunkStreamMessage[];
  // Sizes, for tests and a later perf HUD (TEC-015).
  counts(): { loaded: number; recent: number };
}

// `generate` exists so tests can count generations; production passes nothing.
export function createChunkStore(seed: number, generate: GenerateChunk = generateChunk): ChunkStore {
  const loaded = new Map<string, ChunkData>();
  // Unloaded chunks kept for a quick return. Insertion order = LRU order, oldest first.
  const recent = new Map<string, ChunkData>();
  let out: ChunkStreamMessage[] = [];

  function remember(key: string, d: ChunkData): void {
    recent.delete(key);
    recent.set(key, d);
    while (recent.size > RECENT_CHUNKS) recent.delete(recent.keys().next().value!);
  }

  function lookup(cx: number, cy: number): ChunkData {
    const key = keyOf(cx, cy);
    const hot = loaded.get(key);
    if (hot !== undefined) return hot;
    const cached = recent.get(key);
    if (cached !== undefined) {
      recent.delete(key); // re-insert: now the most recently used
      recent.set(key, cached);
      return cached;
    }
    const d = generate(seed, cx, cy);
    remember(key, d);
    return d;
  }

  return {
    tileAt(tx, ty) {
      if (!Number.isInteger(tx)) throw new RangeError(`tileAt: tx must be an integer, got ${tx}`);
      if (!Number.isInteger(ty)) throw new RangeError(`tileAt: ty must be an integer, got ${ty}`);
      const cx = Math.floor(tx / CHUNK_TILES);
      const cy = Math.floor(ty / CHUNK_TILES);
      const lx = tx - cx * CHUNK_TILES;
      const ly = ty - cy * CHUNK_TILES;
      return lookup(cx, cy).tiles[ly * CHUNK_TILES + lx] as TileValue;
    },
    stream(anchors) {
      const plan = planStream(anchors, loaded.values());
      for (const { cx, cy } of plan.unload) {
        const key = keyOf(cx, cy);
        const d = loaded.get(key)!; // planStream's unload list comes from `loaded`
        loaded.delete(key);
        remember(key, d);
        out.push({ type: "unchunk", cx, cy });
      }
      let generated = 0;
      for (const { cx, cy } of plan.load) {
        const key = keyOf(cx, cy);
        let d = recent.get(key);
        if (d !== undefined) {
          recent.delete(key); // a cache hit is free
        } else if (generated < GEN_PER_TICK) {
          d = generate(seed, cx, cy);
          generated += 1;
        } else {
          continue; // over budget; later cache hits in the list still load this tick
        }
        loaded.set(key, d);
        // Copies: the host owns (and the worker transfers) these; the cache keeps its own arrays.
        out.push({ type: "chunk", cx, cy, tiles: d.tiles.slice(), biomes: d.biomes.slice() });
      }
    },
    drain() {
      const messages = out;
      out = [];
      return messages;
    },
    counts() {
      return { loaded: loaded.size, recent: recent.size };
    },
  };
}
