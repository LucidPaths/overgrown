// Which atlas frame draws each sim Kind. Adding a Kind without a frame here fails typecheck.
import { Kind, type KindValue } from "@overgrown/sim/protocol";
import type { Spritesheet } from "pixi.js";

export const KIND_FRAMES: Record<KindValue, string> = {
  [Kind.Character]: "debug/character32",
};

/** Throws naming every frame the atlas lacks, so a stale or wrong atlas is one readable error. */
export function requireFrames(sheet: Spritesheet, names: readonly string[]): void {
  const missing = names.filter((name) => sheet.textures[name] === undefined);
  if (missing.length > 0) {
    const atlas = sheet.data.meta.image ?? "atlas";
    throw new Error(`atlas ${atlas} is missing frame(s): ${missing.join(", ")}`);
  }
}
