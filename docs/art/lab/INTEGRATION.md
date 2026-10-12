# Bringing the pixel diorama into the game: an honest estimate

## Numbers first

Measured with `art-lab/tools/measure.mjs`, which uses the repo's own recipe (`scripts/perf-profiles.mjs`):
- phone 390x844 at DPR 3 with touch, 4x CPU throttle, slow 4G (1.6 Mbit/s, 150 ms RTT), no HTTP cache;
- served by `vite preview` (gzip on), built from `art-lab/`, seed 22;
- host load under 1.

| | Pixel diorama (lab) | Current game (`docs/perf.md`, after TEC-021) |
|---|---|---|
| First frame (`overgrown:first-frame`), median | **2,466 / 2,579 ms** (two sets of 5 runs, host load 1.0-1.35; single runs 2,413-2,641 ms) | 2,852 ms |
| Bytes on the first screen | **about 50 KB gzip / 125 KB raw** (JS only: renderer, sim, worldgen, all art) | 302,688 B (163 KB JS + 138 KB atlas) |
| Byte floor at 200,000 B/s | about 0.2-0.6 s | 1.5 s |
| Art assets | **none**: every mesh, material and animation is code | a WebP atlas built by `tools/art` |

Notes:
- The meter counts 40,990 B. The worker bundle (9.5 KB gzip) loads through the worker and is not seen by the
  page's request log, so I added it from `dist/` by hand.
- The lab's own marks show where the time goes on the slow profile:

  | Stage | Time |
  |---|---|
  | HTML + JS | about 0.55 s |
  | spawn search (main thread) | 0.35 s |
  | building the 4-6 visible chunks (relief, meshes, props) | 0.9 s |
  | first two frames in SwiftShader | 0.3-0.5 s |

  The worker boots at 0.56 s and has its world ready by 0.65 s.

**Frame rate.** Headless Chromium draws WebGL with SwiftShader on the CPU, so these are cost comparisons, not
phone or GPU numbers. The desktop profile (1280x720, a 429x242 G-buffer) runs at 7.6 fps. The phone profile
(4x CPU, a 195x422 G-buffer) runs at 4.7 fps. On a GPU the fill cost is small: the G-buffer is about 100k pixels
(two RGBA8 targets plus depth/stencil), and post and blit cover the screen once. The real risk is vertex count
(next section). Real-phone numbers need the manual check in `docs/perf.md` §4. I could not run it here.

## Phone risk

- **Vertices.** Props are flat-shaded, non-indexed meshes baked per chunk. The 9 chunks held around the spawn
  contain **0.70 M prop vertices** on seed 22 (meadow/river) and **1.15 M** on seed 1 (forest): foliage blobs are
  80-triangle icospheres and an oak has 4-6 of them. Two things in the lab cut what a frame submits (measured with
  `tools/stats.mjs` at 1280x720):
  - the main pass draws only chunks that touch the view;
  - the shadow pass draws only casters (trees, rocks, bushes, logs; not grass or flowers), padded by the current
    shadow length.

  That leaves **0.27 M + 0.18 M = 0.45 M vertices per frame** on seed 22 and **0.40 M + 0.30 M = 0.70 M** in the
  forest. This is fine on desktop GPUs and the biggest phone risk: a low-end Mali or Adreno at 60 fps wants well
  under 0.5 M.
  - **Mitigations, in order:** indexed foliage blobs (they use smooth "ball" normals, so vertices can be shared: about 3x fewer vertex shader runs); sub-0 icospheres for bushes and
    small crowns; instancing per prop variant instead of baking (6 variants per kind, so tiny buffers); shadow
    casters at a lower LOD.
- **Terrain fragment shader.** The ground material runs a 3x3 Voronoi plus 4-6 value-noise lookups per pixel. At
  100k pixels this is cheap. It should still be measured on a low-end phone. The fallback is to bake ground
  albedo per chunk into a texture once, as the 2D chunk layer does today.
- **WebGL2 is required.** It needs MRT and a sampled depth-stencil texture, which every current mobile browser
  has, including iOS 15+. There is no WebGL1 fallback in the lab.
- **Main-thread chunk builds** cost about 100-200 ms each at 4x CPU. When walking they are budgeted at 1 per
  frame, which hitches on slow phones. They belong in a worker: the relief and the meshes are pure functions of
  chunk data.

## What changes

### `client/`
- **Renderer.** Pixi (`pixi.js` 8.22) is replaced by the lab's WebGL2 renderer, which uses no library: `renderer.ts`,
  `glsl.ts`, `terrain-*`, `mesh-shaders.ts`, `actor-layer.ts`, `fx-layer.ts`, `sky.ts`. That removes most of the
  163 KB of JS today.
  - **Deleted or rewritten:** `render/chunk-layer.ts`, `kind-frames.ts`, `actor-frames.ts`, `actor-anims.ts`,
    `tile-frames.ts`, `snapshot-view.ts`.
  - **Kept:** `render/interpolate.ts` (snapshot interpolation), `render/resolution.ts` (rewritten:
    integer-scale low-res buffer), `render/camera.ts` (rewritten: texel snapping + sub-texel blit offset).
- **Assets.** `assets.ts` (atlas loading) goes away. Nothing is fetched besides JS.
- **Chunk building** moves into a worker (a second worker, or the sim worker posting relief and mesh arrays as
  transferables).
- **New presentation modules** from the lab: `world/relief.ts`, `terrain-mesh.ts`, `placement.ts`, `geo/*`,
  `actors/*`. They are presentation only, except placement (below).
- **Input.** Aim now goes through an ortho unprojection: screen y is foreshortened by sin 52 deg. The touch
  overlay can stay as it is.

### `tools/`
- `tools/art` (Python: tiles, actors, heads, palettes, atlas) is no longer used for in-game art. It could survive
  for UI icons, or be removed together with its tests and the `contracts/tile-frames.json` and
  `contracts/actor-anims.json` fixtures.
- `contracts/rng-vectors.json` stays: the sim still uses the RNG. Python leaves the build entirely. `npm run build`
  becomes just the Vite build, which also simplifies CI.

### `sim/` (needed, owned by the sim tasks, not by art)
- **Props must enter the sim.** Trees and boulders block movement. The lab fakes this by making their tiles read
  as Cliff, through `world/placement.ts` imported into the worker. In the game, prop placement belongs in worldgen
  (WLD tasks) with a `Prop` layer per chunk in `ChunkData`. Then the renderer and collision read one source.
- **Snapshot additions:**
  - appearance (dye, gear ids, later age and scar parameters);
  - which action ends a Hurt (the lab adds Hurt and Death through a stand-in hit check);
  - an optional world clock, for time of day.
- **NPC brains** write `Intent` exactly as the lab's stand-in does. The lab proves NPC-001's interface works for
  rendering.

## Contracts in `CLAUDE.md` that would change

| Contract today | Becomes |
|---|---|
| Atlas: JSON schema + `<atlas>.webp` (`tools/art/lib/atlas.py`) | **Removed.** |
| Kind → atlas frame name (`kind-frames.ts`) | Kind → mesh builder (`Record<KindValue, (look) => Mesh>`), still tsc-enforced. |
| Ground tile frames (`contracts/tile-frames.json`, dual grid) | **Removed.** Ground materials are shader functions per tile class, weighted per corner (`terrain-mesh.ts` weights, `ground-glsl.ts`). |
| Actor frame names, anim frame counts (`contracts/actor-anims.json`) | **Removed.** Clips are TS functions of time (`anim.ts`), timed from the sim's action durations (`ATTACK_TICKS`, `DODGE_TICKS`, Hurt). |
| Actor skeleton joints, species table, head templates (Python) | The TS rig (`rig.ts`: 13 bones, +z forward, feet at y = 0) and the species table (`species.ts`). |
| Camera: integer device-px scale, whole-art-px snapping | Kept in spirit. The scale is `round(long axis / 440)`. The eye snaps to texels and the remainder goes to the blit. |
| Render resolution (`dpr / ceil(dpr / MAX_RENDER_DPR)`) | The low-res G-buffer is the resolution. The canvas is the device backing size, blitted with nearest filtering. |
| Ground rendering (one 512x512 RenderTexture per chunk) | One heightfield mesh + water sheet + cliff mesh + baked prop mesh per chunk. Heights are presentation-only (relief); the sim stays flat. |
| Sprites snap to whole art pixels (trap) | Superseded: geometry rasterises into the texel grid by construction. |
| *new* Presentation relief | Feet stand on `HeightField.height(x, y)`. Relief may never make a walkable tile look blocked or a blocked tile look walkable: cliffs are drawn only on Cliff tiles. |
| *new* The lean | `LEAN` px per px of height above an object's base, for every upright thing. Depth stays upright. |

## Order of work

1. **Renderer core behind a flag.** `?renderer=diorama` in `client/`, with frame graph, camera, blit and outlines.
   It draws today's flat tiles as a heightfield with the new materials. *Gate: first frame ≤ 3 s, a real-phone
   fps check.*
2. **Chunk build off the main thread.** Relief, terrain, water and cliff meshes are built in a worker and
   transferred.
3. **Props in worldgen and the sim** (a WLD task): the placement table moves into `sim/src/world/`, with
   collision from the prop layer. The renderer bakes from it. *Gate: the 700k-vertex budget is fixed (indexing,
   LOD or instancing) before forests ship.*
4. **Actors:** the rig, species and clips replace the atlas actors. Snapshot appearance columns are added.
   Silhouettes and cutaway come with them.
5. **FX and lights:** hit sparks once the CMB hit system exists, dust and splashes, lanterns. Then the world clock
   in the snapshot and the time-of-day table.
6. **Delete `tools/art` in-game generation** and its contracts. Update `CLAUDE.md`.

**Rough size.** Steps 1-2 are one large task each, step 3 is a sim task of its own, step 4 is a large task, and
step 5 is medium. Most of the code exists in `art-lab/`. The work is porting it into the client's module
boundaries, writing the tests that guard real breakage (relief determinism, the rig's bone hierarchy, aim
unprojection), and the phone performance work above.
