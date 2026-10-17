# overgrown art direction: the pixel diorama

ART-025. This is the art bible for the direction built in `art-lab/`. It replaces nothing yet: integration is a
separate task (`INTEGRATION.md`).

![the prototype at 1280x720, day](img/desktop-day.png)

## 1. Philosophy

**What it is.** The world is a tabletop diorama of small, chunky, hand-made models: lumpy trees, faceted rocks,
stubby people with big heads. A pixel camera photographs it. Everything is real low-poly 3D, lit by one sun, and
drawn into a buffer where one texel is one world pixel. Then it is scaled up by a whole number with no smoothing. The
result reads as pixel art but behaves like a place. The sun moves, shadows lengthen, wind runs through the grass,
lanterns make pools at night, and a fox behind a tree is still there.

**Why it fits overgrown.**
- *The world never ends and nobody draws it.* Every model is a small seeded program: a tree is a trunk plus a few
  lumpy balls, and a cliff is a jittered column. The 300th tree is a new tree, not the same sprite repeated. Biomes
  differ by data (materials, palettes, placement tables), not by new art.
- *Living-world stories need state on screen.* Age, scars, gear, dye, death, a corpse wearing someone else's armour,
  a bear asleep in its den: these are parameters of a mesh and a pose, not new sprite sheets. One rig and nine
  species already give every armour and animation combination for free (section 4).
- *Cozy at a glance, real stakes underneath.* The toon light is soft and warm with blue-violet shade and friendly
  shapes. Under it the same light makes nights properly dark, hits flash white and throw sparks, and the dead fall
  down and stay down (legs in the air, which is the dark-humour register the GDD asks for).
- *Magic, hits and loot must read instantly.* The world sits in mid-chroma. The bright colours are kept for action:
  a white flash on a hit, white-gold sparks, the white-to-amber slash ribbon, lanterns. Characters hidden by trees
  show as dithered silhouettes (the local player in orange, everyone else in blue), and foliage between the camera
  and the player thins to a dither.
- *It opens from a link.* There are no asset files. The whole art set is about 41 KB of gzipped JavaScript, and the
  first frame on the slow phone profile arrives in about 2.4 s (numbers in `INTEGRATION.md`).

**What it refuses to be.**
- Not smooth 3D: no anti-aliasing, no bilinear upscale, no mipmapped mush, no sub-texel shimmer. Every pixel sits on
  the grid.
- Not imitation hand-pixel noise: no per-pixel random speckle in materials. Texture is a few flat tones with
  1-2 px marks, and dither appears only at boundaries.
- Not voxels and not Minecraft. Shapes are lumpy and faceted, not cubed.
- Not grimdark and not photoreal. Night is blue, not black, and shadows are tinted, never grey.
- Not a 2D tile catalogue: no tile seams, no repeated 16x16 stamps, no lattice of identical flowers.

## 2. How it is made

Everything is generated at runtime in the browser from the seed. There is no build-time art step.

```
sim (Web Worker)  --snapshots, chunk tiles-->  host
                                               |- Ground: tiles + biomes per chunk (same data as the sim)
                                               |- relief.ts: presentation heights (terraces, river beds, beaches)
                                               |- terrain-mesh.ts: 33x33 heightfield per chunk + water sheet + cliff columns
                                               |- placement.ts: seeded prop per tile -> props.ts variants (cached) -> one baked mesh per chunk
                                               |- rig.ts + species.ts: one mesh per (species, dye, weapon, trousers)
                                               |- anim.ts: procedural clips -> 13 bone matrices per character per frame
                                               '- fx-layer.ts: particles from snapshot events
renderer (WebGL2):
  1. shadow map (1024^2, ortho from the sun, texel-snapped)
  2. G-buffer at the low resolution: colour + (normal.xz, material id) + depth/stencil
       terrain -> props (wind, lean, cutaway) -> actors (tilt, lean, stencil) -> FX
     overlay: hidden parts of actors drawn where depth says they are behind something (stencil masks self)
  3. post: outlines from depth/normals, grade (saturation, contrast, vignette)
  4. blit: nearest upscale by an integer, plus the sub-texel camera remainder in device px
```

Code map (all in `art-lab/src/`): `render/renderer.ts` (frame, camera, lean), `render/glsl.ts` (the one `light()`),
`render/ground-glsl.ts` (ground materials), `render/terrain-shaders.ts` (terrain, water, outline post),
`render/mesh-shaders.ts` (props, wind), `render/actor-layer.ts`, `render/fx-layer.ts`, `render/sky.ts` (time of day),
`geo/builder.ts` (primitives), `geo/props.ts`, `actors/rig.ts`, `actors/species.ts`, `actors/anim.ts`,
`world/*.ts` (relief, meshes, placement).

## 3. The rules

These rules are concrete enough to follow without asking. Numbers are the shipped values in the lab.

### Camera and projection
- Orthographic, pitch 52 deg, no yaw (north is up). One texel is one world px at zoom 1 (a 16 px tile is 16 texels
  wide and about 12.6 tall).
- Integer upscale only: `scale = round(long screen axis in device px / 440)`, at least 1. The long axis always shows
  about 440 texels: 1280x720 gives 3x (427x240 texels), a 390x844 phone at DPR 3 gives 6x (195x422).
- The camera eye snaps to whole texels. The leftover sub-texel offset is applied in device px at the upscale, so
  pans are smooth and pixels never swim.
- The camera follows the local player with a 0.2 s lag and looks ahead 16 px toward the aim.

### The lean and the tilt (the A Link Between Worlds trick)
- **Lean:** every upright thing (props, actors, FX) is stretched upward on screen by `LEAN = 0.3` px per px of height
  above its own base. Depth is computed from the upright position, so occlusion stays correct. Terrain and cliffs do
  not lean. A new prop needs nothing extra: the prop bake writes "height above base" per vertex.
- **Tilt:** characters are also drawn rotated 18 deg back toward the camera, again with upright depth and upright
  lighting. Without the tilt and lean you see the tops of heads and no faces
  (`img/explore-no-lean-no-tilt.png` versus `img/species-lineup.png`).

### Light
- One `light()` function in `render/glsl.ts` for every lit surface: two hard terminators (at N·L = 0 and 0.38), the
  cast shadow, drifting cloud shade, a hemispheric ambient (sky above, bounce below) and a shade tint. Nothing
  else may invent its own lighting.
- Time of day is one keyframe table (`render/sky.ts`): sun azimuth and elevation, sun colour, sky and bounce, shade
  tint, grade. By day the light is warm and the shade cool. At night the moonlight is cool and the lamps warm.
- Point lights (at most 8 per frame) fall off in three flat steps (1, 0.55, 0.22) with a 2x2 dither at the step
  edges. A lantern has radius 60-100 px, warm `(1.0, 0.68, 0.34)`. Glowing mushrooms have radius 26 px, teal.
- Shadows use normal offset plus slope-scaled bias. Low suns must not stripe the ground.

### Outlines
- Outlines are a post pass. A pixel nearer than a neighbour by more than the threshold draws a dark line on itself.
  Thresholds: terrain 7 px, actors 2.5 px, everything else 4 px. Grass, water and FX get no outlines.
- The line colour is the surface colour × `(0.42, 0.38, 0.52)`: a darker, cooler version of the surface, never black.
- Convex creases on props and actors get a light line, which keeps faceted forms readable.

### Colour
- **World:** mid chroma. Grass comes from the continuous worldgen fields (moisture, elevation), never from the
  discrete biome id, so biome borders blend instead of seaming.
- **Materials:** at most 3-4 flat tones each (shade, base, light, plus one mark colour).
- **Cloth dyes:** medium chroma, from 9 dyes and 4 trouser colours.
- **Pop colours** are reserved for action and must out-shout everything else: hit flash white `(1, 0.98, 0.94)`,
  sparks white-gold to orange, slash ribbon white core with an amber `(1, 0.78, 0.42)` edge. Future magic and loot
  go here too.
- Shadow and shade lean blue-violet. Nothing is neutral grey, except stone, which is still warm or cool.

### Texture
- No per-pixel noise. Marks are 1-2 px wide: grass blades are 1x2 strokes on a 3x4 cell grid, pebbles are a
  light pixel over a dark one, and rock seams are 1 px.
- Dither is a Bayer 4x4, only at material boundaries and light steps. Ground dither is anchored in world space, so
  it does not crawl when the camera moves. FX dither is in screen space, as an alpha substitute.
- Large-scale variation comes from low-frequency fields (fbm at 40-70 px) quantised into 2-3 tones, never from
  smooth gradients.

### Shape language and scale
- Five primitives (`geo/builder.ts`):
  - a lumpy icosphere (foliage, rocks, heads);
  - a tapered prism (trunks, limbs, reeds);
  - a cone;
  - a box;
  - a jittered octagon column (cliffs).
- Foliage uses "ball" normals, so a crown shades as one soft form. Wood and stone stay faceted.
- Sizes:

  | Thing | Size |
  |---|---|
  | Tile | 16 px |
  | Character | about 28 px tall (head radius about 6, so heads are about 1/2.3 of the height) |
  | Bush | 10-16 px |
  | Pine | 35-50 px |
  | Oak | 45-70 px |
  | Cliff column | the terrace step + 16-28 px |
  | Boulder | 15-25 px |
- Every prop variant is a seeded function of (kind, variant, biome flavour). There are 6 variants per kind, plus
  per-instance yaw, scale (0.85-1.15) and a small hue shift. Rare features must not live in only one variant.

### Characters
- One shared skeleton of 13 rigid bones: root, hips, torso, head, two arms, two legs, two tail segments, two ears,
  weapon. Each vertex belongs to one bone. A new species is proportions plus head features (snout, ears, crest,
  hair) plus a tail plus colours. It never gets a new skeleton.
- **Silhouette first:** with the colour removed, ears, snout, tail and proportions must still name the species. The
  fox has tall ears and a big tail, the bear is round and wide, the rabbit has long ears, the bird a beak and crest,
  the lizard a snout and tail, the orc tusks and a mohawk, the dwarf is short with a beard, and the elf is tall
  with long ears.
- Eyes are dark 1.25 x 2.6 px boxes at 0.3 head-radius from centre, pushed out of the head surface so they always
  rasterise. Faces stay clear of hair: hair is a cap on the crown and the back.
- Gear is rigid parts on bones, so armour layers are meshes on the same bones. Dyes are vertex colours.
- **Planned, not built:** aging and scars as per-character parameters (greying ramps, scar decals as vertex colour).

### Animation
- Clips are pure functions of time (`actors/anim.ts`), so any frame can be reproduced (captures, replays).
- **Timing comes from the sim:**
  - Attack (0.4 s): wind-up 0-30 %, strike 30-50 %. The hit lands at 37.5 % (tick 3 of 8), then the pose holds
    and recovers.
  - Dodge (0.35 s): a tucked forward roll about the body centre with a 6 px hop, so nothing digs into the ground.
  - Hurt: snaps back, arms fly out, and the body flashes white for the first 22 %.
  - Death: buckles, falls back, bounces once, and stays.
- Walk and run blend by speed. The phase advances with distance travelled, so feet mostly do not skate. Ears and
  tail lag behind the bounce (overlap). Clips blend in over about 50 ms.
- Characters turn toward their motion while walking or rolling, and toward the sim facing otherwise, quickly but
  never instantly.

### The world moving
- One wind field moves grass, flowers, reeds and tree crowns: a sway plus gusts that travel across the land.
  Characters push foliage aside (up to 12 pushers).
- Clouds drift as soft shade over everything. Rivers flow downhill along the elevation field. The sea has slow,
  sparse highlights. The shore foam breathes with a swell.

### Readability in a fight
- **X-ray silhouettes:** the hidden parts of a character draw as a 50 % dither of a team colour with two tones from
  a fixed key, so heads and arms still read. A stencil stops a character from x-raying itself.
- **Cutaway:** tall props in front of the local player thin out in a 26-texel circle around the player's chest.
- **Hit:** a white flash, 14 sparks away from the attacker, and a flat shock ring. Rolls kick dust, or splash in water.

## 4. Recipes

**A new monster (for example a horned rabbit or a bear).**
1. Add a body plan only if the monster cannot be expressed as the shared rig. A quadruped needs its own 13-15 bone
   rig with the same conventions: rigid parts, +z forward, feet at y = 0.
2. Build its mesh from the five primitives, at the scale table above. A level-2 horned bunny is about 10 px tall and
   a level-40 bear about 40 px.
3. Add age and mutation as parameters, not variants: greying multiplies the fur ramp toward `#c8c4bc` by age, scars
   are 1 px light lines in vertex colour, and size scales with level.
4. Give it clips with the same signature as `anim.ts`: idle, locomotion, attack, hurt and death. The timing comes
   from the sim's action durations.
5. Check it in `?mode=stage` (lineup and motion sheet) at scale 3 and 6, against grass, sand and snow.

**A new prop.** Write a `(seed) => Geo` function in `geo/props.ts`. Use base colours from the natural palette, set
the material id (Prop or Foliage), and set a wind weight that rises with height. Register it in `propGeo`, give it a
placement rule in `world/placement.ts` (as a fraction of a hash per tile, clustered by the `grove` field), and add
it to `BLOCKING` if it should stop feet.

**A new biome.**
1. The sim decides tiles and biomes. The look decides four things: the grass tint from the worldgen fields, the
   material weights per tile, a relief rule in `relief.ts` (how high, terraces or not), and a placement table.
2. Add a material function to `ground-glsl.ts` only if no existing material fits. Follow the texture rules.
3. Check the biome's borders in a wide capture (`?mode=static&scale=1`) as well as at game scale.

## 5. Where it stands

The prototype shows all of this live:
- the meadow, forest, river, coast, highlands and snow;
- nine species, with walk, run, attack, dodge, hurt and death;
- hits and splashes;
- dawn, day, dusk and night.

What is not yet built (gear layers, aging, monsters, weather, UI) is listed in `README.md`, with the open problems.
