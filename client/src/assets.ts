// Loads the art pipeline's atlas (TexturePacker JSON Hash + PNG) with Pixi's built-in spritesheet support.
import { Assets, Spritesheet } from "pixi.js";

// Relative URL: works under the Pages subpath (vite base "./").
const CORE_ATLAS_URL = "generated/core.json";

export async function loadCoreAtlas(): Promise<Spritesheet> {
  let loaded: unknown;
  try {
    loaded = await Assets.load(CORE_ATLAS_URL);
  } catch (error) {
    throw new Error(coreAtlasMessage(error instanceof Error ? error.message : String(error)), { cause: error });
  }
  if (!(loaded instanceof Spritesheet)) {
    throw new Error(coreAtlasMessage("the file loaded but isn't a spritesheet"));
  }
  return loaded;
}

function coreAtlasMessage(cause: string): string {
  return `couldn't load the core atlas (${CORE_ATLAS_URL}): ${cause}. Run npm run build (or python3 tools/art/build.py) to generate it.`;
}
