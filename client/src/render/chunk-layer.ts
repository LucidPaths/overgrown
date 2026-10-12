// The ground: each held chunk's dual-grid tiles baked once into one 512×512 RenderTexture (CLAUDE.md "Ground rendering").
// Read-only toward the sim: it only draws the chunk messages it is given.
import { CHUNK_TILES, TILE_PX } from "@overgrown/sim/constants";
import type { ChunkMessage } from "@overgrown/sim/protocol";
import type { BiomeValue } from "@overgrown/sim/world/biome";
import type { TileValue } from "@overgrown/sim/world/tile";
import { Container, RenderTexture, Sprite, type Renderer, type Spritesheet } from "pixi.js";
import { tileFrames } from "./tile-frames";

/** Wall-clock ms per frame spent baking (at least one bake per frame when any is queued). Tunable. */
export const BAKE_BUDGET_MS = 4;

const CHUNK_PX = CHUNK_TILES * TILE_PX;
const LAYER_LENGTH = CHUNK_TILES * CHUNK_TILES;

interface HeldChunk {
  readonly cx: number;
  readonly cy: number;
  readonly tiles: Uint8Array;
  readonly biomes: Uint8Array;
  /** Created on the first bake, reused by re-bakes. */
  baked: { texture: RenderTexture; sprite: Sprite } | null;
}

function keyOf(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class ChunkLayer {
  private readonly layer = new Container();
  private readonly held = new Map<string, HeldChunk>();
  /** Chunks to (re-)bake, oldest first. A chunk already queued keeps its place. */
  private readonly queue = new Set<string>();
  /** The bake scene: cell sprites reused by every bake (never shown on stage). Unused ones are hidden. */
  private readonly cells = new Container();
  private readonly pool: Sprite[] = [];

  /** Adds its own layer to `parent` (construct it before SnapshotView so ground draws under characters). */
  constructor(
    parent: Container,
    private readonly sheet: Spritesheet,
    private readonly renderer: Renderer,
  ) {
    parent.addChild(this.layer);
  }

  /** Holds the chunk and queues bakes. Error if (cx, cy) is already held, or a layer's length isn't CHUNK_TILES². */
  add(msg: ChunkMessage): void {
    const { cx, cy, tiles, biomes } = msg;
    const key = keyOf(cx, cy);
    if (this.held.has(key)) throw new Error(`ChunkLayer.add: chunk (${cx}, ${cy}) is already held`);
    if (tiles.length !== LAYER_LENGTH || biomes.length !== LAYER_LENGTH) {
      throw new Error(
        `ChunkLayer.add: chunk (${cx}, ${cy}) layers must have length ${LAYER_LENGTH}, got tiles ${tiles.length}, biomes ${biomes.length}`,
      );
    }
    this.held.set(key, { cx, cy, tiles, biomes, baked: null });
    // Itself, plus the held chunks whose east/south edge cells read this one: west, north, north-west.
    this.queue.add(key);
    for (const [dx, dy] of [
      [-1, 0],
      [0, -1],
      [-1, -1],
    ] as const) {
      const neighbour = keyOf(cx + dx, cy + dy);
      if (this.held.has(neighbour)) this.queue.add(neighbour);
    }
  }

  /** Drops the chunk: destroys its sprite and RenderTexture, removes it from the bake queue. Error if not held. */
  remove(cx: number, cy: number): void {
    const key = keyOf(cx, cy);
    const chunk = this.held.get(key);
    if (chunk === undefined) throw new Error(`ChunkLayer.remove: chunk (${cx}, ${cy}) is not held`);
    if (chunk.baked !== null) {
      chunk.baked.sprite.destroy();
      chunk.baked.texture.destroy(true);
    }
    this.held.delete(key);
    this.queue.delete(key);
    // No re-bakes: chunk data never changes, so a neighbour's edge stays correct.
  }

  /** Once per frame: bakes queued chunks oldest first until BAKE_BUDGET_MS has elapsed. */
  update(): void {
    const start = performance.now();
    for (const key of this.queue) {
      this.queue.delete(key);
      this.bake(this.held.get(key)!); // remove() dequeues, so every queued key is held
      if (performance.now() - start >= BAKE_BUDGET_MS) break;
    }
  }

  private bake(chunk: HeldChunk): void {
    const { cx, cy, tiles, biomes } = chunk;
    // Corner sources: this chunk, east, south, south-east (by whether lx, ly reach CHUNK_TILES). Only TR, BL, BR can leave it.
    const sources = [
      tiles,
      this.held.get(keyOf(cx + 1, cy))?.tiles,
      this.held.get(keyOf(cx, cy + 1))?.tiles,
      this.held.get(keyOf(cx + 1, cy + 1))?.tiles,
    ];
    const last = CHUNK_TILES - 1;
    // Local tile (lx, ly) in 0..CHUNK_TILES; a neighbour that isn't held yet is stood in for by this chunk's clamped edge tile.
    const corner = (lx: number, ly: number): TileValue => {
      const source = sources[(lx >= CHUNK_TILES ? 1 : 0) + (ly >= CHUNK_TILES ? 2 : 0)];
      if (source === undefined) return tiles[Math.min(ly, last) * CHUNK_TILES + Math.min(lx, last)] as TileValue;
      return source[(ly % CHUNK_TILES) * CHUNK_TILES + (lx % CHUNK_TILES)] as TileValue;
    };

    const tx0 = cx * CHUNK_TILES;
    const ty0 = cy * CHUNK_TILES;
    let used = 0;
    for (let ly = 0; ly < CHUNK_TILES; ly++) {
      for (let lx = 0; lx < CHUNK_TILES; lx++) {
        const names = tileFrames(
          corner(lx, ly),
          corner(lx + 1, ly),
          corner(lx, ly + 1),
          corner(lx + 1, ly + 1),
          biomes[ly * CHUNK_TILES + lx] as BiomeValue,
          tx0 + lx,
          ty0 + ly,
        );
        for (const name of names) {
          const texture = this.sheet.textures[name];
          if (texture === undefined) throw new Error(`atlas frame "${name}" is missing from the core atlas`);
          let sprite = this.pool[used];
          if (sprite === undefined) {
            sprite = new Sprite(texture);
            this.pool.push(sprite);
            this.cells.addChild(sprite);
          }
          sprite.texture = texture;
          sprite.position.set(lx * TILE_PX, ly * TILE_PX);
          sprite.visible = true;
          used += 1;
        }
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.visible = false;

    let baked = chunk.baked;
    if (baked === null) {
      const texture = RenderTexture.create({ width: CHUNK_PX, height: CHUNK_PX, resolution: 1, scaleMode: "nearest" });
      const sprite = new Sprite(texture);
      // The dual grid is offset by half a tile (ART-004).
      sprite.position.set(cx * CHUNK_PX + TILE_PX / 2, cy * CHUNK_PX + TILE_PX / 2);
      this.layer.addChild(sprite);
      baked = { texture, sprite };
      chunk.baked = baked;
    }
    this.renderer.render({ container: this.cells, target: baked.texture, clear: true });
  }
}
