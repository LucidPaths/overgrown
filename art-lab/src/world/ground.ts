// Read-only view of the real seeded world: tiles and biomes from sim/src/world/chunk-gen.ts, plus the
// continuous worldgen fields (elevation, moisture, ...) the renderer uses for presentation only.
import { fmix32, mixSeedPart } from "../../../sim/src/rng";
import { generateChunk, type ChunkData } from "../../../sim/src/world/chunk-gen";
import { createWorldFields, type WorldFields } from "../../../sim/src/world/biome-map";

export const T = { Grass: 0, Dirt: 1, Sand: 2, Stone: 3, Cliff: 4, Shallow: 5, Deep: 6, VeryDeep: 7 } as const;
export const B = { Grassland: 0, Forest: 1, River: 2, Mountain: 3, Ocean: 4 } as const;

export class Ground {
  readonly fields: WorldFields;
  private chunks = new Map<number, ChunkData>();
  constructor(readonly seed: number) {
    this.fields = createWorldFields(seed);
  }
  chunk(cx: number, cy: number): ChunkData {
    const k = (cx + 32768) * 65536 + (cy + 32768);
    let c = this.chunks.get(k);
    if (!c) {
      c = generateChunk(this.seed, cx, cy);
      this.chunks.set(k, c);
    }
    return c;
  }
  /** Adopt a chunk that arrived from the sim worker (identical to generateChunk's output). */
  put(c: ChunkData): void {
    this.chunks.set((c.cx + 32768) * 65536 + (c.cy + 32768), c);
  }
  tile(tx: number, ty: number): number {
    const cx = Math.floor(tx / 32), cy = Math.floor(ty / 32);
    return this.chunk(cx, cy).tiles[(ty - cy * 32) * 32 + (tx - cx * 32)]!;
  }
  biome(tx: number, ty: number): number {
    const cx = Math.floor(tx / 32), cy = Math.floor(ty / 32);
    return this.chunk(cx, cy).biomes[(ty - cy * 32) * 32 + (tx - cx * 32)]!;
  }
}

/** Cosmetic deterministic hash in [0, 1) from a seed and integer parts (no wall clock, no Math.random). */
export function hash01(seed: number, a: number, b = 0, c = 0): number {
  return mixSeedPart(mixSeedPart(mixSeedPart(fmix32(seed), a | 0), b | 0), c | 0) / 4294967296;
}
export function hashU32(seed: number, a: number, b = 0, c = 0): number {
  return mixSeedPart(mixSeedPart(mixSeedPart(fmix32(seed), a | 0), b | 0), c | 0);
}
