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

## Next
- Landmark + vista framing.
- Re-judge play views (grassland, forest, river), readability mid-attack, post off/low/high.
- Brush strokes stronger; nebula ring fluffier; pines more ragged.
- Tests: deterministic foliage placement. Bible. Final captures and side-by-sides.
