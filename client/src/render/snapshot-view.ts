// Draws an interpolated frame. Read-only toward the sim: it only reads snapshots.
import { Container, Sprite, type Spritesheet, type Texture } from "pixi.js";
import type { Frame } from "./interpolate";
import { KIND_FRAMES } from "./kind-frames";

export class SnapshotView {
  private readonly sprites = new Map<number, Sprite>();
  private readonly layer = new Container();

  constructor(
    parent: Container,
    private readonly sheet: Spritesheet,
  ) {
    parent.addChild(this.layer);
  }

  private textureFor(kind: number): Texture {
    const frame = (KIND_FRAMES as Record<number, string | undefined>)[kind];
    if (frame === undefined) {
      throw new Error(`no atlas frame is assigned to entity kind ${kind}; add it to KIND_FRAMES (render/kind-frames.ts)`);
    }
    const texture = this.sheet.textures[frame];
    if (texture === undefined) {
      throw new Error(`atlas frame "${frame}" (entity kind ${kind}) is missing from the core atlas`);
    }
    return texture;
  }

  update(s: Frame): void {
    const present = new Set<number>();
    for (let i = 0; i < s.count; i++) {
      const id = s.ids[i]!;
      present.add(id);
      let sprite = this.sprites.get(id);
      if (sprite === undefined) {
        sprite = new Sprite(this.textureFor(s.kind[i]!));
        sprite.anchor.set(0.5, 1); // bottom centre on Position, the feet point
        this.layer.addChild(sprite);
        this.sprites.set(id, sprite);
      }
      sprite.position.set(s.x[i]!, s.y[i]!);
    }
    for (const [id, sprite] of this.sprites) {
      if (!present.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }
}
