# ART-028 wanderer: progress log

Resume here after a restart. Spec: `docs/specs/ART-028.md`. Branch `g1-wanderer-lab`.

## Plan (decided 2026-10-19)
- **Build:** `bash art/blender/build.sh` runs `art/blender/wanderer.py` (helpers `wn_*.py`) headless. Everything is
  authored in code: a numpy-painted texture atlas (`game/assets/wanderer/wanderer_albedo.png`), the meshes
  (Skin-modifier body, hand-built cloth sheets for the robe and the poncho cape, tube locks for the hair, a
  chunky three-wrap scarf with two tails), my own skin weights (no bone heat), a rig of ~100 bones (20 body
  bones plus cloth chains for the robe, cape, scarf tails and hair) and keyed clips (idle, walk, run, sprint,
  dodge, attack). One joined mesh, one material, one surface.
- **Determinism:** the spike's five workarounds (quad spheres, quad-only subsurf cages, no `ops.object.join`,
  no `materials.clear()`, fixed triangulation) plus: all geometry goes through one Python accumulator and one
  `from_pydata`, UVs are authored (no generated UVs), the PNG is written by my own zlib writer, the glTF carries
  no images (Godot loads the PNG).
- **Godot:** `OgWandererRig` (render-side: samples the clips and blends them itself, runs verlet chains for the
  cloth, hair and scarf) and `OgWandererView` (reads OgSim like `OgCharacterView`). A toon/painterly shader.
  `--wanderer old|new` in main.gd.

## Log
