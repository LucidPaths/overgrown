# ART-027 G1 world-look lab: progress log

Running log for `docs/specs/ART-027.md`. A restarted session resumes from the **Next** list at the bottom.
Captures live in `loops/` (JPEG, 1280×720, the iteration history) and `final/` (the deliverable set).
Capture helper used throughout: import first (`godot --headless --import`; captures don't import, and the
post stack's `.glsl` files only recompile on import), then `tools/godot/capture.sh <png> forward_plus [args]`.

## What exists (file map)

| File | What |
|---|---|
| `game/src/render/world_look.gd` (`OgWorldLook`) | sun, eye direction, environment, wind globals, `--post off|low|high`, `--shot` debug camera |
| `game/src/render/paint_post.gd` (`OgPaintPost`) + `game/src/render/post/*.glsl` | the compositor post stack (prep/fog/sky → tensor → blur → anisotropic Kuwahara → composite) |
| `game/src/render/shaders/og_noise.gdshaderinc` | pure noise/colour helpers shared by Godot shaders and the GLSL post |
| `game/src/render/shaders/og_sky.gdshaderinc` | the sky (eye, nebula, stars, clouds): one source for sky shader, water reflection and post |
| `game/src/render/shaders/og_common.gdshaderinc`, `og_light.gdshaderinc` | globals (`og_wind`, `og_eye_dir`, `og_sun_dir`, `og_focus`), gusts, cloud shadows, dither, painted light |
| `game/src/render/shaders/{terrain,grass,foliage,rock,water,sky}.gdshader` | materials |
| `game/src/render/prop_meshes.gd` (`OgPropMeshes`) | procedural grass, reed, pine, broadleaf, bush, rock meshes |
| `game/src/render/foliage.gd` (`OgFoliage`) | seeded per-chunk placement (worker thread) |
| `game/src/render/terrain_view.gd`, `terrain_mesher.gd` | materials, palette, multimesh props per chunk |
| `game/src/render/landmark.gd` (`OgLandmark`), `landmark_view.gd` (`OgLandmarkView`) | seeded landmark sites (one per 6×6 chunks) and their island, pillar, stones, lights |
| `game/src/render/shaders/og_landmark.gdshaderinc` | the geoglyph (the eye drawn on the ground), drawn by the terrain shader from the `og_landmark` global |
| `game/src/render/post/paint_exposure.glsl` | metering: geometric-mean luminance of the paint image, eased; the composite gains toward a key |

## Loop log

### Loop 0: baseline (G0)
`loops/l0-g0-before.jpg`. Flat vertex-coloured tiles, a procedural sky gradient, peach fog. Nothing of the
mood board: no strokes, no darks, no sky, no wind.

### Loop 1: sky, painted light, the compositor skeleton
Built the sky shader (eye, nebula, stars, clouds), the terrain shader (warm/cool patches, brush dabs,
strata), the painted light (two-tone ramp, warm terminator, drifting cloud shadows) and the compute post
stack. `loops/l1-first-post-off.jpg`.
- **Bug:** the first terrain dabs rotated world coordinates by a noise angle, which swirls into concentric
  rings far from the origin. Rejected; dabs now use fixed angles per layer plus a domain warp.
- **Bug:** depth reconstruction. `RenderSceneData.get_cam_projection()` is already the Vulkan-corrected
  matrix (reverse-Z, y flipped), so NDC is `(uv*2-1, depth)`, not the GL convention. Found by painting
  `fract(world.y)`: wrong y gave dense bands, right y gives height contours.
- **Trap:** edited `.glsl` files only recompile on `--import`; a capture alone keeps the old SPIR-V.
- Critique: neon lime greens, a blazing orange horizon band, no props, the eye invisible at the play pitch.

### Loop 2: props
Procedural meshes + seeded placement; grass, reeds, pines, broadleaf trees, bushes, rocks.
`loops/l2-props-play.jpg`, `loops/l2-props-vista.jpg`.
- First pass was a wall: 15 m pines at 1 per 9 m² hid the wanderer completely. Rejected. Forest thinned to
  ~1 pine per 30 m², pines slimmed (radius 0.22 of height) and 6–12.5 m; the occlusion dither now covers a
  cone around the camera→wanderer line that widens with distance, plus anything within 6 m of the camera.
- Critique: it is a world now and the vista has charm, but the palette is lime and orange, and grass reads
  as spikes.

### Loop 3: palette and the sky in the post
`loops/l3-grade-vista.jpg`.
- The fog colour is now the sky itself (the same `og_sky_base`, mirrored below the horizon), computed in the
  prep pass: distant ground dissolves into the sky, and the post repaints sky pixels with the identical
  function, so the streaming edge cannot show (the G0 fog-vs-sky trap, solved by construction).
- Grade: gradient map blue-black → teal → olive gold → burnt gold → gold → cream, local chroma kept at 55%,
  greens kept less (they fall into the teal-gold ramp). Lime is gone; the vista starts to read like 02/03.

### Loop 4–5: water, grass, the eye
`loops/l5-river.jpg`, `loops/l5-eye-postcard.jpg`.
- Water reflects `og_sky_base` (so the eye) with a painterly Fresnel (mostly mirror), turquoise shallows,
  blue-black depth, foam dabs from the depth buffer, gold glints.
- Grass: smaller, denser clumps whose colour comes from the ground under them: the field reads as strokes.
- Paint buffer capped at 540 px high (bigger strokes for the same cost) plus an unsharp mask on upsample.
- The eye seen with a low debug camera (`--shot 0,-22,5`) already answers mood-board 01/02: teal fibred
  iris, gold rim, orange nebula, stars, the wanderer's head in front of the pupil.
- Decision: the play camera looks 25° down and shows ~2° of sky, so the eye moves to 40° elevation: the
  water near the wanderer reflects it (looking down at water you look up at the eye).

### Restart (after loop 5)
The container restarted mid-change; the orchestrator committed the WIP (1af5afd). It held a first landmark
(floating island, ruins, waterfall, debris, a Decal rune circle, a post-drawn pillar volume). Merged
`origin/main` (GOD-008: orbit camera, attack while moving, dodge dash, `--yaw`/`--pitch`): one conflict in
`main.gd` (arg docs and the `_parse_args` dictionary), both sides kept. Tests 53/53.

### Loop 6: the grade, rebuilt (`loops/l6-teal-gold-river.jpg`)
Orchestrator's critique of loops 3/5, which I share: yellow-olive everywhere, a flat ochre far haze, no teal
or blue grounds, no real darks. Measured against the mood board (mean luminance 0.15–0.28, median
0.12–0.27, p10 ≈ 0.05): the loop-5 frames were olive mids with no darks below 0.1.
- **Why it was olive:** one gradient map keyed by luminance put every mid-value pixel on an olive stop, and
  the raw grass was yellow-green. The fix is to grade like the paintings are lit: **two ramps**, a cool one
  (blue-black → deep teal → teal-green → pale teal) and a warm one (blue-black → umber → burnt gold → gold →
  cream), chosen per pixel by its warmth (red over green and blue; yellow-greens count as cool) or by being
  bright. A gold sun and a teal sky already split the scene into warm light and cool shade; the grade pushes
  that split to the mood board's.
- **Broken colour instead of mud:** between the ramps the brush-stroke noise decides stroke by stroke, so a
  half-lit field is teal strokes and gold strokes side by side, never olive (impressionist broken colour).
- **Tuned offline:** I captured ungraded frames (`GRADE = 0`) and mirrored the GLSL grade in numpy to try
  ramps in seconds instead of 30 s captures; then ported. Rejected on the way: a pure luminance toe (too dark,
  muddy), full teal for every green (cyan, artificial), lemon gold (c4 too yellow).
- **Horizon:** the horizon band is now a misty blue-teal lighter than the land (aerial perspective, 02/03),
  with gold only in a narrow fan right under the eye; cloud banks are gold only on the eye's side. Grass and
  tree albedos cooled (grass 0.42,0.50,0.21 → 0.32,0.47,0.26).

### Loop 7: the landmark, redesigned for the vista camera (`loops/l8-landmark-vista.jpg`)
Critique of the WIP landmark: from the vista (55 m back, 38° down, no look raise) an island floating 15 m up
sits at the very top of the frame, and the play camera (25° down) never sees above ~7 m: the island was
invisible from both. The occlusion dither also ate it in the vista (the cone widened with camera distance:
10–19 m wide at 64 m).
- **The eye on the ground:** a 17 m geoglyph under the island, laid out like the cosmic eye (pupil, iris
  fibres, a band of 36 rune cells, a ticked rim), lines burnt dark into the ground and glowing gold from
  within, worn through by grass, a pulse running inward. Drawn by the terrain shader from one global
  (`og_landmark`), so it is crisp at any distance and costs one branch per ground fragment; the Decal and its
  CPU-drawn texture are gone. The eye in the sky looks down at its reflection: the landmark reads from the
  vista and from the play view.
- A ring of 11 rune-carved standing stones (some broken, some leaning) around it, placed once every chunk
  under the ring is loaded (no main-thread chunk generation). They have no collision (like trees in G1).
- The island is smaller (r 8.5, depth 8), two clustered omni lights (no shadows) light it and the stones
  gold from the glyph and the pillar's foot.
- **Occluder dither rewritten in screen space:** a fragment dithers when it is in front of the wanderer
  and within 2.4 m of the wanderer's chest *as seen from the camera* (view-space comparison). Right for every
  pose (play, orbit, vista); the island no longer vanishes.

### Loop 8: exposure (`loops/l8-spawn.jpg`)
Shaded scenes (the forest edge, the spawn under the island's shadow) measured mean 0.08 against the mood
board's 0.15–0.28; the open river bank was on target. A painter keys every canvas, so the post now meters:
`paint_exposure.glsl`, one 16×16 workgroup, 1024 centre-weighted taps of the paint image, geometric mean of
display luminance, eased at 1.5/s; the composite gains toward a key of 0.27 (0.8–2.2×) with a curve that
keeps white at white. The grade ramps were rebalanced so each stop's luminance stays near its key (they
change hue, not exposure). Ambient raised 1.0 → 1.7 (teal shade should be mid-teal, not black; the near-black
darks belong to crevices and silhouettes). Now: spawn 0.12, vista 0.13, river 0.27, landmark play 0.14.

### Loop 9: readability (`loops/l9-readability-cliff.jpg`)
Autopilot attack captures (tick 207) at the spawn walked straight into the landmark: the wanderer, gold on
gold, vanished in the geoglyph. And a placeholder orange body reads as "light" to a grade that turns warm
into gold. Fixes, all in the post or materials (character_view.gd untouched):
- **Focal outline:** inside the focal region, a thin blue-black line on the near side of depth edges within
  1–2 m of the wanderer's depth (focus distance passed in `eye_dir.w`); grass at its feet is too shallow a
  depth step to be outlined. Mood boards 01–03 draw the figure dark against the light; this is that.
- Focal clarity 0.45 → 0.6; geoglyph emission halved (it is a landmark, not the focal point).
- Near-camera foliage fade 3–5.5 m → 4–8 m.
- The attack arc (character_view, ART-028/GOD territory) reads against teal but loses contrast against gold
  surfaces; noted for the report (an additive arc with a dark under-stroke would fix it there).
- Found: at some orbit yaws a hill sits between camera and wanderer (camera has no terrain collision);
  noted for the report, not mine to change.

### Loop 10: strokes and gold
1:1 crops against 02 showed big soft blobs where the painting has dense short strokes, and lemon gold.
Hair noise now has a 24/m octave faded out by 18–45 m (no aliasing far away), LIC half-length 9 → 13 px,
stroke strength 0.6 → 0.85. Warm pixels take their colour from the ramp (ochre) unless truly red/orange
(flowers, the wanderer's borders keep theirs); teal mids desaturated toward 02's grey-teal.

### Loop 11: forest (`loops/l11-forest-canopy-cut.jpg`)
Forest play view was a wall of low-poly crowns at camera height. Added a **canopy cut-away** (crowns above
the wanderer's head, in front of it and within 5 m of it on screen dither away; trunks stay) and **leafy
silhouettes** (canopy fragments whose normals turn from the view break into world-anchored leaf clumps;
pines at 0.45 strength so they keep their cones). Rejected: full-strength breakup on pines (they turned
into bare poles). Forest stays the cool, dark biome; grassland is the gold one (03 vs 02).

### Loop 12: landmark framing (`loops/l12-landmark-vista-west.jpg`, `loops/l12-landmark-play-west.jpg`)
Tried four vista framings around the site (from S, W, E, N): from the west the glyph, island and pillar
stack into one diagonal. Island enlarged (r 11, depth 9), the tree-free glade widened 16 → 24 m so the stone
ring stands in open grass, metering centre weight lowered (the glyph's glow was darkening the frame) and the
exposure key raised 0.27 → 0.31.

### Finals (`final/`)
- Final set: `play-grassland`, `play-forest`, `play-river`, `play-spawn-landmark`, `landmark-vista`
  (`--vista --at -55.5,-70.5 --yaw -90`), `landmark-play`, `readability-attack` (`--autopilot
  --capture-tick 206 --at -170.5,-2.5 --yaw -40`), `post-off`, `post-low`, `post-high`, `eye-debug-shot`
  (`--shot 0,-22,5`, debug camera), the triptych `post-off-low-high`, side-by-sides `side-*-vs-NN`
  (02, 03, 05, 06, 10, 01) and before/after pairs (`before-after-g0-vs-final`,
  `before-after-river-l5-vs-final`).
- **Capture trap:** cloud shadows drift with the shader TIME (wall clock), so two captures of one spot
  differ by where the clouds are. The river, off and low finals use `--frames 40` so they match; compare
  quality levels only with matched timing.
- Last fix in the finals: the island casts no sun shadow (its 22 m shadow put the seed-1 spawn view in
  murk).
- `docs/art/BIBLE.md` written (principles, palette values, layer construction, rules for future art,
  trait → technique map, GPU cost per pass); `DIRECTION.md`'s header points to it.
- Checks at the end: `test.sh` 55/55, `export.sh` both builds, the CI smoke capture of the Linux export
  renders, `check-credits.sh` ok.

## Status: done (ART-027 deliverables complete)

## Next (after ART-027; for a future task, not this lab)
- Measure on Lucid's machine (HUD fps, `--post off|low|high`); first knob if slow: composite LIC taps 5 → 3.
- Camera (GOD/rig, not changed here): a vista look-raise of ~12–15° would put the eye and the pillar in the
  vista; terrain between camera and wanderer at some orbit yaws hides the wanderer (no camera collision).
- Attack arc (character_view, ART-028/GOD): additive and brighter with a dark under-stroke so it reads on gold.
- Forest: broadleaf crowns still read low-poly up close (leaf cards or a Blender-made crown); forest floor
  could take dappled gold.
- The geoglyph draws only for the nearest landmark (one global); two in view would need a second slot.
- Freeze shader time in capture mode (an `og_time` global from the sim tick) for repeatable captures.
- Focal outline for more characters (a list of focus points) when NPCs arrive (G2).
