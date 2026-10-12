// Which atlas frame draws each sim Kind, per entity row of an interpolated Frame. Adding a Kind without an entry fails typecheck.
import { Kind, type KindValue } from "@overgrown/sim/protocol";
import type { Spritesheet } from "pixi.js";
import { actorFrame } from "./actor-frames";
import type { Frame } from "./interpolate";

export const KIND_FRAMES: Record<KindValue, (frame: Frame, i: number) => string> = {
  [Kind.Character]: (f, i) => actorFrame(f.species[i]!, f.facing[i]!, f.action[i]!, f.actionStart[i]!, f.tick),
};

/** Throws naming every frame the atlas lacks, so a stale or wrong atlas is one readable error. */
export function requireFrames(sheet: Spritesheet, names: readonly string[]): void {
  const missing = names.filter((name) => sheet.textures[name] === undefined);
  if (missing.length > 0) {
    const atlas = sheet.data.meta.image ?? "atlas";
    throw new Error(`atlas ${atlas} is missing frame(s): ${missing.join(", ")}`);
  }
}
