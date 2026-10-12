# ART-025 art lab: progress log

Resume file. Read this first after a container restart, then `BRIEF.md`.

## Chosen direction: "pixel diorama"

Real low-poly 3D (flat-shaded, vertex-coloured, every mesh built by seeded code) rendered by WebGL2 into a
low-resolution buffer (1 texel = 1 world px at the default zoom), then upscaled by a whole number with nearest
filtering. Orthographic 3/4 camera (52 deg pitch). Toon light (two hard terminators + cast shadow map + drifting
cloud shade), outlines from depth and normals in a post pass (dark silhouette lines, light crease lines),
per-texel camera snapping with a sub-texel upscale offset so pans are smooth but pixels never swim.
Reference lineage: t3ssel8r's 3D pixel art, A Short Hike, Eastward's palette warmth.

Why: it is the only direction explored that gives real light, shadow, wind, water, time of day and many
species/armour combinations from one rig, while still reading as hand-made pixel art and staying "all code".

Explorations (killed or kept), images in `art-lab/out/` (to be copied into docs/art/lab/img/):
- A paper cut-out 2D (canvas): charming, but flat, no light, edges every tile; dies at scale.
- B ink + wash 2D: nice illustration, but a still; motion and readability in a fight are weak.
- C pixel diorama (WebGL2): KEPT.
- D voxel diorama: chunky, reads as Minecraft-derivative; stair-stepped rivers look wrong on a free 2D sim.

## Done
- d766fe8: sandbox, sketches A/B, diorama core: seeded relief from the real sim chunks (terraces for
  mountains, water surfaces), terrain + water shaders, 17 prop kinds, wind, shadow map, outline post.
- 8657813: WIP actor rig (13 rigid bones) and nine species definitions; voxel sketch D.

## Next (in order)
1. Actor layer: pose solver + animation clips (idle, walk, run, attack, dodge, hurt, death) and a render layer.
2. Lab sim worker: real sim systems (spawnCharacter, stepActions, stepMovement, chunk store, findSpawn) with
   lab NPC wanderers writing Intent; snapshot interpolation; player input (keyboard + touch); camera follow.
3. Biome passes: mountain cliffs/terraces, ocean/beach, forest density; biome borders.
4. Time of day (dawn/day/dusk/night) and FX: hit flash, slash arc, dust, splash.
5. Captures: desktop/phone, biomes, species lineup, motion sheets, explorations. Docs: DIRECTION, RESEARCH,
   EXPLORATION, INTEGRATION, README. Perf numbers (payload, first frame slow-4G + 4x CPU, headless fps).
