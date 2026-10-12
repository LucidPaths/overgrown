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

  private textureFor(s: Frame, i: number): Texture {
    const resolve = (KIND_FRAMES as Record<number, ((frame: Frame, row: number) => string) | undefined>)[s.kind[i]!];
    if (resolve === undefined) {
      throw new Error(`no atlas frame is assigned to entity kind ${s.kind[i]}; add it to KIND_FRAMES (render/kind-frames.ts)`);
    }
    const name = resolve(s, i);
    const texture = this.sheet.textures[name];
    if (texture === undefined) {
      throw new Error(`atlas frame "${name}" (entity ${s.ids[i]}, kind ${s.kind[i]}) is missing from the core atlas`);
    }
    return texture;
  }

  update(s: Frame): void {
    const present = new Set<number>();
    for (let i = 0; i < s.count; i++) {
      const id = s.ids[i]!;
      present.add(id);
      const texture = this.textureFor(s, i);
      let sprite = this.sprites.get(id);
      if (sprite === undefined) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1); // bottom centre on Position, the feet point
        this.layer.addChild(sprite);
        this.sprites.set(id, sprite);
      } else {
        sprite.texture = texture; // a no-op when unchanged
      }
      // Whole art px × integer scale + integer origin = every texel on whole device px (10-art-audio: no sub-pixel jitter).
      sprite.position.set(Math.round(s.x[i]!), Math.round(s.y[i]!));
    }
    for (const [id, sprite] of this.sprites) {
      if (!present.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }
}
