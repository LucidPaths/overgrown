# ART-024 previews: before and after

> History: these previews show the retired pixel-art pipeline and browser build (deleted in OVR-010).

Images for Lucid's review of the art direction pass (`art-024-direction`: `docs/art/RESEARCH.md`, `docs/art/DIRECTION.md`, and the redrawn `tools/art/`). All images are nearest-neighbour upscales (x2 to x4) of frames from the built `core` atlas, or screenshots of the real game (`vite preview`, `?seed=N`, 1280x720 at the game's own 2x). The sheets and scenes are composed by a scratch script outside the repo: the terrain is the real dual-grid tile selection (same masks, precedence and variant hash as `client/src/render/tile-frames.ts`) over a made-up height map, not real worldgen. The "before" images are the atlas on `main` before #30 (476b6b7).

Honest lines first: the cast is a big step up and I would show it; the ground is calm and consistent but the open expanses are still large and flat, and the biome borders in the real game show a visible palette seam (see the beach shot).

## Actors

### Cast, idle, facing down (before / after)
![before](lineup-before.png)
![after](lineup-after.png)
Before: nine near-identical white-tunic figures that differ by hair or ear shape. After: nine silhouettes you can tell apart at 1x (dwarf beard block, orc shoulders and tusks, fox ears and tail, bear mass, rabbit ears, bird crest and beak, lizard crest and snout). Still bothers me: the human is the plainest of the nine, and hands are pale squares at this size.

### Idle and walk, every species, four directions (before / after)
Columns: down (idle, walk 0-3), left (idle, walk 0-3), right, up. Rows: human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk.
![before](actors-idle-walk-before.png)
![after](actors-idle-walk-after.png)
Before: shapes read as one body in different paint, dithered noise shading, a walk that barely moves. After: form-shaded, selectively outlined, a 1 px bob and a 2 px foot lift, scissoring feet in profile, tails and ears that lag a frame. Still bothers me: the 4-frame walk is subtle in front and back views because the legs are only 5 to 8 rows long; a 6-frame walk would need a contract change.

### Unarmed attack, every species, four directions (before / after)
Columns: down 0-3, left 0-3, right 0-3, up 0-3.
![before](actors-attack-before.png)
![after](actors-attack-after.png)
Before: a hand moving 1 to 3 px, no read of weight. After: chamber, swing, a lunge with the body sunk 2 px and the head pushed forward on the held extension frame, then a short recover. Still bothers me: front and back attacks (toward and away from the camera) are weaker than the side view; they read as a punch only because of the lunge, and the arm foreshortening is faked.

## Ground

### Meadow terrain with transitions (before / after)
![before](tiles-meadow-before.png)
![after](tiles-meadow-after.png)
Before: every pixel speckled, edges jittered per pixel, flat colour. After: one calm base tone with a few clusters, smooth organic edges, a lit top lip and a dark bottom lip on raised ground, foam on shorelines. Still bothers me: the open grass is now quiet to the point of being empty at game scale; macro variation (large soft patches) cannot be done per tile without repeating on a lattice, so it needs the chunk baker (a renderer task).

### Forest (before / after)
![before](tiles-forest-before.png)
![after](tiles-forest-after.png)
Before: a blue-green carpet of noise. After: darker, cooler canopy-shade green with rust and berry litter and a dull grey-teal water; it reads as a different mood from the meadow at a glance. Still bothers me: the forest water is a little muddy next to the very bright river and ocean water.

### River (before / after)
![before](tiles-river-before.png)
![after](tiles-river-after.png)
Before: saturated but noisy, water the same blue as everywhere. After: emerald marsh and bright turquoise water with a pale foam shelf into the deeper channel. Still bothers me: grass here is the most saturated green in the game and needs to be checked against props later.

### Mountain (before / after)
![before](tiles-mountain-before.png)
![after](tiles-mountain-after.png)
Before: bluish stone that looked like water, thin cliff strips. After: muted sage grass, a violet-grey stone with stepped slab seams, indigo cliff ledges with a dark face. Still bothers me: the stone is a big flat purple field; seams are faint at 2x and look a bit like ripples.

### Ocean and coast (before / after)
![before](tiles-ocean-before.png)
![after](tiles-ocean-after.png)
Before: heavy noise on every tile, hard to see shapes. After: clean aqua shallows, deep-water steps, shell-pale sand, a terracotta cliff for the only warm rock. Still bothers me: the shallow aqua is very close to the pop line in saturation; I would lower it a notch if VFX colours collide with it.

### Terrain catalogue: each terrain, three full variants and four transition masks, five biomes (before / after)
![before](tile-catalogue-before.png)
![after](tile-catalogue-after.png)
Before: texture on every pixel. After: base tone plus a few clusters per tile, edge lips by terrain class, cliff face with strata, ten full variants per terrain in the atlas (three shown). Still bothers me: very deep water is a single flat tone with almost no detail; that is deliberate calm, but it is the least interesting tile.

## Scenes (cast on terrain, composed mock; before / after)
![meadow before](scene-meadow-before.png)
![meadow after](scene-meadow-after.png)
Before: pale, noisy, characters sink into the speckle. After: characters are the first thing the eye finds and each has its own colour; the ground stays out of their way. Still bothers me: no ground shadows yet (ART-018), so feet float slightly.

![forest before](scene-forest-before.png)
![forest after](scene-forest-after.png)
After: the cool dark ground makes the warm species (fox, dwarf) pop and the light ones (rabbit, elf) stand out most. Still bothers me: the orc seen from behind (dark hair, olive skin) has the least value contrast against the dark green; the outline holds it, but it is the one to watch.

![mountain before](scene-mountain-before.png)
![mountain after](scene-mountain-after.png)
After: the coldest, quietest biome gives the characters the most contrast, as the bible intends. Still bothers me: the stone and cliff share a similar violet-blue, so ledges are readable mostly by their dark face.

## In the real game (after, 1280x720, `vite preview`)

![meadow and forest](ingame-meadow-forest.png)
Seed 1, meadow into forest into dirt. Good: calm, saturated, the human reads clearly. Bothers me: the forest border is a hard stair-step at the palette change (the client picks the palette of the top-left tile), and it looks like a rectangle cut out of the meadow.

![mountain cliffs](ingame-mountain-cliffs.png)
Seed 4, mountain stone with cliff ledges. Good: the ledges have a lit lip and a dark face. Bothers me: a very large flat stone field, with seams that are faint at 2x.

![beach](ingame-beach.png)
Seed 9, grass, sand and aqua sea. Good: warm sand, clear foam on the water edge. Bothers me: a one-tile olive band where the ocean palette's grass meets the meadow's; palettes switch at biome borders and their grass ramps differ.

![mountain meadow](ingame-mountain-meadow.png)
Seed 5, a meadow clearing in the mountains. Good: tufts and the occasional flower sit nicely at 2x. Bothers me: the player is only ever the human here; the other eight species can only be judged on the sheets and scenes above.
