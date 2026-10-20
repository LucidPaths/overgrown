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

### Loop 1: first build (Blender Workbench preview)
- Built: Skin-modifier body, boots, mitten gloves, quad-sphere head, hair cap + tube locks, a three-wrap scarf,
  a two-sided cape (poncho top) and robe from authored point grids, ~25k tris, 101 bones, 6 clips. Rebuild 17 s.
- Critique: reads as a robed figure, but the cape is a short stiff "lampshade" (the mood board's poncho drapes over
  the arms to the hips), the hair is spikes sticking up, the forearms are sticks.
- Changed: cape longer and broader, bell sleeves with a woven cuff, hair locks swept back.

### Loop 2: poncho points
- Critique: still two stacked bells. A square poncho worn diamond-wise hangs in points (front, back, over the
  arms): that is the wanderer's shape in images 01, 07, 09. Robe too flared (a "dress").
- Changed: pointed cape hem (cos 2θ), slimmer robe.

### Loop 3: first in-game captures (default zoom, autopilot)
- At 80 px it already reads: gold scarf, dark poncho, orange bands, wild hair.
- Critique: the run stride (3.3 m per cycle) makes the legs look like stilts; a beige "rim" floods the inner
  lining (the rim term fired on inward normals seen through the robe opening); the attack arc is an opaque white
  fan; the scattered rust diamonds read as polka dots at 80 px.
- Changed: run 2.83 m / sprint 4.0 m per cycle (faster cadence), rim only where N·V ≥ 0, additive gold crescent
  arc, fewer smaller muted diamonds, thicker trousers, taller wrapped boots, robe hem 3 cm lower.
- Rejected: a forward roll for the dodge. A 0.35 s somersault reads as a spinning blob at 80 px and throws the
  cloth sim into gravity flips; a low dash with the cape and hair streaming reads as "dodge" and is the
  wanderer's wind identity. Kept the dash (full size, no scaling: Lucid's "shrinks" complaint).

### Loop 4: studio (Godot, real shader) turnaround, contact sheet, close-up
- Added `tools/godot/wanderer_studio.sh` (turnaround / sheet / closeup / frame) with a key light over the camera's
  shoulder (the game's sun is fixed; the first studio renders were all shadow side).
- Critique: the head was a flat black hole; the hair only grew from the back so the sides showed bare void; the
  scarf's rust stripes read as ropes; idle arms stuck out sideways with the hands splayed at the cape edge; the
  scarf tails hung as one flat yellow bib.
- Changed: lighter blue-black void face (still faceless), hairline down past the temples plus two side chains
  (11 hair chains), irregular scarf rolls with one faint stripe per 128 px, idle arms in by 13°, narrower tails.
