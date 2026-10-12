// Draws an interpolated frame. Read-only toward the sim: it only reads snapshots.
import { Kind } from "@overgrown/sim/protocol";
import { Container, Sprite, Texture } from "pixi.js";
import type { Frame } from "./interpolate";

const SIZE = 8;
const KIND_TINT: Record<number, number> = { [Kind.DebugMover]: 0xe8c547 };
const UNKNOWN_KIND_TINT = 0xff00ff; // loud magenta: a kind nobody assigned a look to

export class SnapshotView {
  private readonly sprites = new Map<number, Sprite>();
  private readonly layer = new Container();

  constructor(parent: Container) {
    parent.addChild(this.layer);
  }

  update(s: Frame): void {
    const present = new Set<number>();
    for (let i = 0; i < s.count; i++) {
      const id = s.ids[i]!;
      present.add(id);
      let sprite = this.sprites.get(id);
      if (sprite === undefined) {
        sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.setSize(SIZE, SIZE);
        sprite.tint = KIND_TINT[s.kind[i]!] ?? UNKNOWN_KIND_TINT;
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
