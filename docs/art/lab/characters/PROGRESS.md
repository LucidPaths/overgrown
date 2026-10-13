# ART-026 character lab: progress log

Newest entry last. A resumed run reads this first.

## 2026-10-12 start

- Read the brief, the first lab's README/DIRECTION/INTEGRATION and the `art-lab/` code (13 rigid bones, box/cylinder
  parts, 28 px figures in a 3x pixel buffer).
- Plan:
  1. Research (RESEARCH.md).
  2. Diverge: several directions in very different proportions, rendering and dimensionality, all rendered in the
     same world spot; kill the weak ones (EXPLORATION.md).
  3. Build the winner: modelling pipeline, rig, animation, shading, 9 species, gear/dye/aging, a monster sketch.
  4. Live prototype with all nine species fighting; captures; DIRECTION, INTEGRATION, README; perf numbers.

## 2026-10-13 state found by the resumed run (after a container restart)

Committed by the first run (d0a2e8f, 30f9627), but not logged here:
- `art-lab/characters/`: SDF sculpt (`sdf/model.ts`, `field.ts`) -> surface nets (`sdf/mesher.ts`) -> skinned mesh
  with per-pixel materials (`render/char-mesh.ts`), 30-bone shared skeleton (`rig/`), toon + ink shading drawn at
  full resolution over the pixel world (`render/char-layer.ts`, `char-shaders.ts`), painted faces with expressions.
- Animation: key-pose clips, leg IK, springs (`anim/`). Live prototype `characters.html` (`game.ts`) on the lab
  sim worker, mesh worker pool. Stage captures `?mode=stage`.
- Only human, foxfolk and bearfolk are sculpted; the other six species map to human.
- Explorations in `docs/art/lab/characters/img/explore-*.png` (pixel, hibit, smooth, clay, heroic, chibi, puppet).
- No RESEARCH/EXPLORATION/DIRECTION/INTEGRATION/README yet.
- Meshing costs 6-10 s per look per core (0.36 px cells, 32-47k tris).

Resumed plan: research doc; finish the design language and all nine species; gear/dye/aging; a monster;
animation polish and hit readability; faster meshing; captures; docs; perf numbers.
