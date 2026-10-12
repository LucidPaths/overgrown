import { describe, expect, it } from "vitest";
import { CHUNK_TILES } from "../constants";
import { generateChunk, type ChunkData } from "./chunk-gen";
import {
  createChunkStore,
  GEN_PER_TICK,
  planStream,
  RECENT_CHUNKS,
  type AnchorPos,
  type ChunkCoord,
  type ChunkStore,
} from "./chunk-store";

const SEED = 42;

const key = (c: ChunkCoord): string => `${c.cx},${c.cy}`;
const keys = (cs: readonly ChunkCoord[]): string[] => cs.map(key).sort();
const column = (cx: number): string[] => [-2, -1, 0, 1, 2].map((cy) => key({ cx, cy })).sort();

/** A generator that counts its calls. */
function counting(): { generate: (seed: number, cx: number, cy: number) => ChunkData; calls: () => number } {
  let n = 0;
  return {
    generate: (seed, cx, cy) => {
      n += 1;
      return generateChunk(seed, cx, cy);
    },
    calls: () => n,
  };
}

function chunkMessages(store: ChunkStore): ChunkCoord[] {
  return store.drain().flatMap((m) => (m.type === "chunk" ? [{ cx: m.cx, cy: m.cy }] : []));
}

describe("chunk store", () => {
  it("planStream: load radius 2, unload beyond 3, nearest first", () => {
    let loaded: ChunkCoord[] = [];
    const step = (anchors: AnchorPos[]) => {
      const plan = planStream(anchors, loaded);
      const gone = new Set(plan.unload.map(key));
      loaded = [...loaded.filter((c) => !gone.has(key(c))), ...plan.load];
      return plan;
    };

    let plan = step([{ x: 256, y: 256 }]);
    expect(plan.load.length).toBe(25);
    expect(plan.load[0]).toEqual({ cx: 0, cy: 0 });
    expect(plan.unload).toEqual([]);

    plan = step([{ x: 768, y: 256 }]); // chunk (1, 0)
    expect(plan.unload).toEqual([]); // hysteresis: column -2 is 3 away
    expect(plan.load).toEqual([
      { cx: 3, cy: 0 },
      { cx: 3, cy: -1 },
      { cx: 3, cy: 1 },
      { cx: 3, cy: -2 },
      { cx: 3, cy: 2 },
    ]);

    plan = step([{ x: 1280, y: 256 }]); // chunk (2, 0)
    expect(keys(plan.unload)).toEqual(column(-2));

    plan = step([{ x: 768, y: 256 }]); // back across the border: nothing flickers
    expect(plan).toEqual({ unload: [], load: [] });

    const negative = planStream([{ x: -1, y: -1 }], []).load.map(key);
    expect(negative).toContain("-3,-3");
    expect(negative).toContain("1,1");
    expect(negative).not.toContain("2,2");

    const two: AnchorPos[] = [
      { x: 256, y: 256 },
      { x: 5376, y: 256 },
    ];
    const both = planStream(two, []);
    expect(both.load.length).toBe(50);
    const first = planStream([two[0]!], []).load;
    expect(planStream(two, first).unload).toEqual([]);

    expect(planStream([{ x: 0, y: 0 }], []).load.slice(0, 4)).toEqual([
      { cx: -1, cy: -1 },
      { cx: 0, cy: -1 },
      { cx: -1, cy: 0 },
      { cx: 0, cy: 0 },
    ]);

    const bad = [{ x: 256, y: 256 }, { x: NaN, y: 0 }];
    expect(() => planStream(bad, [])).toThrow(RangeError);
    expect(() => planStream(bad, [])).toThrow("anchor 1");
  });

  it("recent chunks: LRU-capped at RECENT_CHUNKS, loaded chunks never evicted", () => {
    const gen = counting();
    const store = createChunkStore(SEED, gen.generate);
    const loaded = new Map<string, ChunkCoord>();
    for (let k = 0; k <= 20; k++) {
      const anchors = [{ x: k * 512 + 256, y: 256 }];
      let busy = 0; // calls that sent something
      for (;;) {
        store.stream(anchors);
        expect(store.counts().recent).toBeLessThanOrEqual(RECENT_CHUNKS);
        const messages = store.drain();
        if (messages.length === 0) break;
        busy += 1;
        for (const m of messages) {
          if (m.type === "chunk") loaded.set(key(m), { cx: m.cx, cy: m.cy });
          else loaded.delete(key(m));
        }
      }
      expect(busy).toBeLessThanOrEqual(13);
    }
    expect(store.counts().recent).toBe(RECENT_CHUNKS);
    expect(store.counts().loaded).toBe(loaded.size);

    let before = gen.calls();
    store.tileAt(16 * CHUNK_TILES + 3, 4); // chunk (16, 0): unloaded last, still cached
    expect(gen.calls()).toBe(before);

    const tx = -2 * CHUNK_TILES + 5;
    const ty = 7;
    const tile = store.tileAt(tx, ty); // chunk (-2, 0): unloaded first, evicted
    expect(gen.calls()).toBe(before + 1);
    expect(tile).toBe(generateChunk(SEED, -2, 0).tiles[ty * CHUNK_TILES + 5]);

    before = gen.calls();
    for (const c of loaded.values()) store.tileAt(c.cx * CHUNK_TILES, c.cy * CHUNK_TILES);
    expect(gen.calls()).toBe(before);
  });

  it("stream: at most GEN_PER_TICK generations per tick; cache hits free; tileAt generates on demand", () => {
    const anchors = [{ x: 0, y: 0 }];
    const gen = counting();
    const store = createChunkStore(SEED, gen.generate);
    store.stream(anchors);
    expect(gen.calls()).toBe(GEN_PER_TICK);
    expect(chunkMessages(store)).toEqual([
      { cx: -1, cy: -1 },
      { cx: 0, cy: -1 },
    ]);
    for (let call = 2; call <= 13; call++) {
      const before = gen.calls();
      store.stream(anchors);
      expect(gen.calls() - before).toBeLessThanOrEqual(GEN_PER_TICK);
    }
    expect(store.counts().loaded).toBe(25);
    const settled = gen.calls();
    store.stream(anchors);
    store.stream(anchors);
    expect(gen.calls()).toBe(settled);

    const fresh = counting();
    const touched = createChunkStore(SEED, fresh.generate);
    const picks: ChunkCoord[] = [
      { cx: 2, cy: 2 },
      { cx: -2, cy: 2 },
      { cx: 2, cy: -2 },
      { cx: 1, cy: 1 },
      { cx: -2, cy: -2 },
    ];
    for (const [n, { cx, cy }] of picks.entries()) {
      const tile = touched.tileAt(cx * CHUNK_TILES + 9, cy * CHUNK_TILES + 11);
      expect(fresh.calls()).toBe(n + 1);
      expect(tile).toBe(generateChunk(SEED, cx, cy).tiles[11 * CHUNK_TILES + 9]);
    }
    touched.stream(anchors);
    expect(fresh.calls()).toBe(picks.length + GEN_PER_TICK);
    expect(chunkMessages(touched).length).toBe(picks.length + GEN_PER_TICK);

    expect(() => touched.tileAt(0.5, 0)).toThrow(RangeError);
    expect(() => touched.tileAt(0.5, 0)).toThrow("tx");
  });
});
