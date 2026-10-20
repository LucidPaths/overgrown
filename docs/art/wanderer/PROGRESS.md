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

### Loop 5: foot plant and the rim
- Logged the worst unreachable ankle distance per clip (a floating foot): walk 6.1 cm, run 4.7 cm. Walk and run
  stances moved back a little and the heel now stays raised from toe-off into the early swing: walk 1.2 cm,
  run 0.3 cm, sprint 1.8 cm.
- Critique (in-game close-up via `WANDERER_GAME_ZOOM`): a tan band ran down the robe's and cape's lit edges. It
  was the rim light, 0.42 wide, painting a material instead of a light edge (and it also lit linings).
- Changed: rim width 0.22, warmer and stronger, masked off by baked occlusion (linings, the robe under the cape).
- Added `game/tests/test_wanderer.gd`: clip and chain names, clip lengths against the rig's cycle metres and the
  rules speeds, finite poses through every action.

### Loop 6: the face
- Critique: from the front the head was still a flat black disc; image 02 shows a dark face with a few stars and
  image 03 a dark face that still reads brow and nose.
- Changed: the void is a deep navy (still faceless), bigger stars (emissive), one more front lock (12 hair chains).
- Determinism: two clean builds give identical sha256 for the .glb and the .png.

### Restart (2026-10-20)
- The container restarted after loop 6; the renders were never committed. From here on the deliverable images are
  committed under `docs/art/wanderer/` as they are made.

### Loop 7: the poncho is a poncho, not a capelet
- Re-read mood-board 01, 02, 06, 09 and 12 next to a fresh turnaround. Critique: ours was a capelet over a dress.
  The mood board's poncho is the figure: it falls over the arms to the wrists and, at the back, to the knees,
  with the robe showing only below it; the back carries a gem and a zigzag (01). The orange was neon next to the
  burnt orange of the paintings, the scarf lemon instead of ochre, the hair a short cap instead of streaming locks.
- Changed: the hem is a Fourier curve (back z 0.62, front 0.78, sides 0.90 so the hands show below it, sharper
  front and back points), 19 rows instead of 13 and 3 bones per cape chain instead of 2 (124 bones); the cape's
  UV v runs by arc length up from the hem so the band keeps one width around a hem of varying length; scarf tails
  re-fitted to the longer back; the robe darkens under the cape down to z 0.8. Palette: ORANGE 0.74/0.30/0.09,
  RUST, GOLD and SCARF all deeper. Hair locks 1.3x longer, more downwind drift.
- Rig: a `skirt` collision group (thighs 0.24 m, hips 0.26 m) so the long back panel rides over the legs and the
  robe instead of through them; cape air drag 2.0 -> 1.0 (at 5 m/s the long panel stood out like a board).

### Loop 8: in-game captures (default zoom and 4 m close-up: walk, sprint, dodge, attack while walking, idle)
- At the default zoom (~80 px) it reads as the mood-board figure from behind: a dark diamond of poncho with an
  orange band, a gold collar, black hair streaming downwind.
- Critique: during the attack a whole cape panel turned cream (the rim light fills a flat panel seen edge-on, not
  just a silhouette edge); the attack arc sat at 0.5..1.45 m, i.e. on top of the now wider poncho, and read as a
  filled cream disc; one front lock flicked straight up when the attack snapped the facing.
- Changed: rim width 0.22 -> 0.15, strength 0.8 -> 0.7; arc a thin tilted crescent (1.2..1.65 m, 22 deg roll)
  in deeper gold; front lock rise 0.75 -> 0.42 and hair bend limit 80 -> 65 deg.

### Loop 9: wool, folds and hair from behind
- Critique (studio turnaround and a new low-angle dusk `portrait` mode, backlit like the paintings): the scarf's
  stitch pattern was a regular high-contrast braid that read as rope coils; the long poncho hung as a smooth
  lampshade; from behind the hair was a cluster of end-on stubs (the locks swept straight back at the camera)
  that the warm rim turned into brown knobs. The game camera sits behind the wanderer most of the time, so the
  back view matters most.
- Changed: soft knit (stitch contrast halved, large tonal variation, long fibre strokes along the scarf); deeper
  cape folds and an uneven hem; hair roots darkened in the baked occlusion (the mass reads as one shape and the
  rim stays off its bumps, the tips still catch light); locks a little thinner and flatter (ribbons); downwind
  drift 0.34 -> 0.62; locks from the back of the head hang and stream sideways instead of straight back.
- Rejected: masking the rim off the hair entirely. The paintings light the hair's edge; only the roots go dark.

### Loop 10: horns
- Critique (in-game close-up, attack while walking): one or two thin locks stood straight up from the crown like
  horns. A probe that runs the real main scene with `--autopilot` and prints every hair segment pointing up
  (`d.y > 0.6`) showed segments pinned at the 65 deg bend limit, 0.8 to 0.93 up, while their rest direction was
  0.1 up. Turning the hair's head collision off made them go away: the head capsules (radius 0.13 and 0.125, the
  top one reaching 2.5 cm above the crown) stuck out of the narrow skull and pushed the crown and side locks
  out, i.e. up. The crown locks also left the scalp at a steep angle in the rest mesh.
- Changed: head capsules 0.085 m, ending at the head centre (inside the skull everywhere); a `max_rise` cloth rule
  for hair (a segment may lift at most 0.3 above its rest direction's y: wind can still lift the hair, a snap
  turn can't flip it up); crown locks leave the scalp flat; hair gravity 0.35 -> 0.7 g, air 3.2 -> 2.6.
  Probe after: no segment above its rest + 0.3 through ticks 195..230; the capture shows no horns.

## State at the end of the lab (2026-10-20)
- **Counts:** 28,842 triangles, 15,279 vertices, one mesh, one material, one 1024x1024 atlas. 124 bones: 20 body
  (root, hips, spine, chest, neck, head, and per side shoulder, upper arm, forearm, hand, thigh, shin, foot) and
  104 cloth bones in 34 chains (robe 12 x 3, poncho 8 x 3, hair 12 x 3, scarf tails 2 x 4). Clips: idle, walk,
  run, sprint, dodge, attack.
- **Determinism:** `bash art/blender/build.sh` run twice gives `wanderer.glb` sha256 13aaeb01...a6482 and
  `wanderer_albedo.png` 64949b29...4ece65 both times, the same as the committed files (`git status` clean).
- **Checks:** `tools/godot/test.sh` 56 passed; `tools/check-credits.sh` ok (no third-party files);
  `tools/godot/export.sh` both builds; the CI smoke capture on the exported Linux build writes its PNG.
- **Images** (all in this folder): `turnaround.jpg`, `contact-sheet.jpg` (idle, walk, run, sprint, dodge, attack
  over a run), `closeup.jpg`, `ingame-default.jpg` and `ingame-default-walk-full.jpg` (default play zoom),
  `ingame-closeup.jpg`, `ingame-closeup-dodge.jpg`, `ingame-closeup-attack-walking.jpg` (camera at 4 m),
  `vs-moodboard-01.jpg`, `vs-moodboard-02.jpg`, `vs-moodboard-09.jpg` (studio `portrait` mode, the game shader).
- **How to re-render:** `tools/godot/test.sh` once (import), then `tools/godot/wanderer_studio.sh turnaround|sheet|
  closeup|portrait AZ OUT.png`; in-game close-ups with `WANDERER_GAME_ZOOM=4 tools/godot/wanderer_studio.sh
  --capture OUT.png --autopilot --capture-tick N` (60 walk, 150 sprint, 190 dodge, 212 attack while walking,
  400 idle).

## Next (not done)
- The poncho's front still reads as a bell from straight ahead; a real cloth bake (Blender cloth sim baked to
  the rest shape, then frozen) would give it the paintings' heavy vertical folds.
- Hands are mittens; at 80 px nobody sees them, in the vista they are the weakest part.
- The attack is one palm sweep; a combo needs 2-3 variants and a weapon decision (the GDD has none yet).
- Wind is a constant in `OgWandererView.WIND`; when ART-027 exposes the world's wind, read it there (one line).
- Cloth chains don't collide with each other: the scarf tails can pass into the poncho in a hard turn.
- A painterly outline (inverted hull) was left out to keep the silhouette soft; worth a try against ART-027's
  final post stack.
