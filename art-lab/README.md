# overgrown art lab (ART-025)

The live prototype of the "pixel diorama" direction: a real seeded world from `sim/` worldgen, nine species moving
through it on the real sim systems, attacks, rolls, hits, and day to night. All art is code; there are no asset files.
The art bible is `../docs/art/lab/DIRECTION.md`.

## Run it

From this folder (`art-lab/`), with Node 22:

```
npm ci
npm run dev            # http://127.0.0.1:4230/
```

Production build and preview (what the perf numbers use):

```
npm run build
npm run preview        # http://127.0.0.1:4231/
```

Typecheck: `npm run typecheck`.

## Controls

| | Desktop | Phone |
|---|---|---|
| Move | WASD / arrows | drag on the left half (floating stick) |
| Sprint | Shift | push the stick to the edge |
| Attack | Space, J, left click (aims at the mouse) | orange button |
| Dodge roll | K, L, Ctrl, right click | blue button |
| Time of day | T (+1.5 h) | — |

## URL parameters

Game (default):
- `seed=22`, `species=0..8` (0 human … 4 foxfolk … 8 lizardfolk), `npcs=9`
- `hour=10.5`, `cycle=<real minutes per day>` (0 = frozen)
- `bot=1` (a scripted player, for captures), `scale=<n>` (force the texel scale)

`?mode=static&x=..&y=..` is the world without the sim (biome captures). `scale=1` gives a wide view.

`?mode=stage` is for posed, deterministic captures:
- `anim=idle|walk|run|attack|dodge|hurt|death`, `t=<s>`
- `ts=a,b,c` for a motion sheet, `species=..`, `yaw=..` (deg, a row each)
- `lean=0&tilt=0` turns the lean and tilt off, for comparison

`sketch.html?d=paper|ink|voxel` shows the discarded explorations.

## Tools

- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers bash tools/capture-docs.sh` regenerates every image in
  `docs/art/lab/img` (dev server running).
- `node tools/measure.mjs http://127.0.0.1:4231/ 5` measures cold start (phone + slow 4G + 4x CPU), bytes and
  SwiftShader fps.
- `node tools/stats.mjs <url>` prints geometry counts (vertices drawn per frame).
- `node tools/shot.mjs` and `node tools/seq.mjs` take single shots and sequences.

## Layout

| Folder | What is in it |
|---|---|
| `src/game.ts` | live loop: worker, interpolation, clips, FX events, lights, camera |
| `src/sim/` | lab world (real sim systems + NPC brains + hit stand-in) and its worker |
| `src/render/` | WebGL2 renderer, shaders, layers (terrain, props, actors, FX), time of day |
| `src/world/` | presentation relief, terrain and cliff meshes, prop placement |
| `src/geo/` | primitives and prop generators |
| `src/actors/` | rig, species, procedural clips |
| `src/stage.ts`, `src/static-view.ts`, `src/sketch/` | capture views and explorations |
