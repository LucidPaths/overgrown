# overgrown art bible (G1): "Teal shade, gold light, an eye in the sky"

The source of truth for overgrown's look from G1 on. It replaces the pixel-era `docs/art/DIRECTION.md`
(kept as history). It is built from Lucid's mood board (`docs/art/moodboard/`, 13 images and their
`README.md`) and from what the G1 lab (ART-027, `docs/art/g1-lab/PROGRESS.md`) proved in the real game.
Where this file and the code disagree, fix whichever is wrong in the same change.

## 0. The direction in one line

**A dusk painting you can walk through.** Deep teal and blue-black grounds, gold light that lands in
strokes, darks that are nearly black, and a cosmic eye that watches from the sky and from every pool of
water. The figure is small and dark; the world is huge and painted.

Five promises every asset keeps:

1. **Light is gold, shade is teal.** Nothing is lit by a neutral white or shaded by a neutral grey. The
   grade enforces it, but assets that fight it (lime greens, neutral greys, pure white) turn to mud.
2. **Darks are dark.** The 10th luminance percentile of a frame sits near 0.03–0.06 (the mood board's).
   Silhouettes and crevices go blue-black; don't lift them with ambient.
3. **Detail lives in the brushwork, not in the geometry.** Low-poly shapes, painterly shading, the post
   stack's strokes. A prop with fine geometric detail will be smeared by the paint pass anyway.
4. **The wanderer always reads.** Dark figure, light outline-free surroundings, focal clarity in the post.
   Nothing may take the wanderer's place as the focal point in play view.
5. **Everything moves in the wind.** Grass, crowns, clouds, cloud shadows, water, hair and cloth.

## 1. Mood-board traits and what serves them

| Trait (moodboard `README.md`) | Techniques | Where |
|---|---|---|
| Painted look: oil/impasto strokes, canvas grain, soft edges | anisotropic Kuwahara on a capped paint buffer; brush hairs (LIC of world-anchored noise along the stroke field); impasto crest light; unsharp upsample; canvas weave and tooth; terrain brush dabs | `post/paint_kuwahara.glsl`, `post/paint_composite.glsl`, `shaders/terrain.gdshader` |
| Teal and blue grounds against burnt orange and gold | the two-ramp grade (shade ramp, light ramp) chosen per pixel by warmth; broken colour between them; gold sun + teal ambient; cool horizon with a narrow gold fan | `paint_composite.glsl` `grade()`, `world_look.gd`, `og_sky.gdshaderinc` `og_horizon` |
| Very dark darks, lights that glow | toe in the grade; exposure metering to the mood board's key; HDR emissives (eye, geoglyph, pillar) above the tonemap shoulder; glow levels 2–5 | `paint_exposure.glsl`, `paint_composite.glsl`, `world_look.gd` |
| Each scene tinted by its sky | the fog colour *is* the sky (mirrored below the horizon), so distance dissolves into the sky's hue | `paint_prep.glsl`, `og_sky_base` |
| The sky is a character: cosmic eyes, spirals | the eye (fibred teal iris, gold rim, burnt-orange spiral nebula, a star in the pupil), nebula veils, stars, cloud banks; reflected in all water; the landmark pillar runs to it; the geoglyph repeats it on the ground | `og_sky.gdshaderinc`, `water.gdshader`, `landmark_view.gd`, `og_landmark.gdshaderinc` |
| Wind everywhere | one wind vector (`og_wind`) with a slow wander; travelling gusts; grass, reeds, crowns, vines sway; clouds and cloud shadows drift downwind; water ripples | `og_common.gdshaderinc`, `grass.gdshader`, `foliage.gdshader`, `world_look.gd` |
| Small figure, huge world | camera fog distances tuned to hide the streaming edge into the sky; vista pose; a landmark that reads from far away (glyph, pillar) | `camera_rig.gd` (GOD), `paint_prep.glsl`, `landmark_view.gd` |
| "Overgrown" floating ruins (04, 08, 10), the pillar of light (05), glyphs (12) | the landmark: floating island, rune-carved ruins and standing stones, vines and waterfall, pillar, geoglyph | `landmark.gd`, `landmark_view.gd`, `ruin.gdshader`, `light_pillar.gdshader` |

## 2. Palette (values)

All colours below are sRGB 0–1 unless marked linear. Shaders author in sRGB and convert with `og_lin`.

### 2.1 The grade ramps (`paint_composite.glsl`, gamma space, keyed by toned luminance)

Stops at luminance ≈ 0, 0.18, 0.27, 0.46, 0.67, 0.9 (smoothstep blends). Each stop's luminance sits near
its key, so the ramps change hue, not exposure.

| Stop | Shade ramp (cool) | Light ramp (warm) |
|---|---|---|
| c0 | `#020408` blue-black (0.006, 0.014, 0.03) | `#030408` (0.01, 0.016, 0.03) |
| c1 | `#04141C` (0.016, 0.08, 0.11) | `#121A14` umber-teal (0.07, 0.10, 0.08) |
| c2 | `#0D3840` deep teal (0.05, 0.22, 0.25) | `#454021` olive umber (0.27, 0.25, 0.13) |
| c3 | `#2B6361` teal (0.17, 0.39, 0.38) | `#B8752B` burnt gold (0.72, 0.46, 0.17) |
| c4 | `#7AA391` pale teal (0.48, 0.64, 0.57) | `#F2AD4D` gold (0.95, 0.68, 0.30) |
| c5 | `#E0EBD6` (0.88, 0.92, 0.84) | `#FFE8B3` cream (1.0, 0.91, 0.70) |

Warmth = `r − 0.85 g − 0.15 b` (yellow-greens count as cool) or brightness above 0.5–0.85 unless blue.
Chroma kept: 45 %, less for greens (×0.2) and for warm pixels (the ramp supplies ochre), except true
reds/oranges (flowers, the wanderer's borders) which keep theirs.

### 2.2 Light and sky

| What | Value |
|---|---|
| Sun | colour (1.0, 0.80, 0.52), energy 2.3, azimuth −38°, elevation 34° |
| Ambient (shade) | teal (0.28, 0.52, 0.58), energy 1.7 |
| Cosmic eye | north (azimuth 4°), elevation 40°; iris (0.10, 0.42, 0.62) → (0.20, 0.68, 0.78), rim gold (0.98, 0.78, 0.36), pupil (0.02, 0.05, 0.11), nebula (0.55, 0.16, 0.07) → (0.98, 0.50, 0.18) → (1.0, 0.80, 0.42) |
| Sky | zenith (0.01, 0.025, 0.05), high (0.025, 0.07, 0.11), low (0.07, 0.25, 0.30) |
| Horizon / fog | cool (0.20, 0.36, 0.43), toward the eye (0.30, 0.46, 0.47), gold fan (0.86, 0.62, 0.30) only within ~±15° under the eye |
| Glow emissive gold | (1.0, 0.70, 0.32) geoglyph; (1.0, 0.76, 0.38) pillar |

### 2.3 World albedos (`terrain_mesher.gd`, `prop_meshes.gd`)

Grass (0.32, 0.47, 0.26); dirt (0.50, 0.32, 0.17) (the warm accent of every meadow); sand (0.80, 0.64,
0.40); stone (0.42, 0.42, 0.47); rock strata (0.42, 0.30, 0.24) / (0.22, 0.20, 0.27). Pines (0.03, 0.09,
0.09) → (0.13, 0.27, 0.19); broadleaf (0.05, 0.13, 0.12) → (0.26, 0.38, 0.22). Biome tints: Grassland warm
(1.04, 1.0, 0.88), Forest cool (0.50, 0.78, 0.80).

## 3. How each layer is built

### 3.1 Light (`og_light.gdshaderinc`)
One light model for every world surface: a two-tone ramp (lit/shade in a few values, not a gradient), a
burnt-orange band at the terminator, drifting cloud shadows (wind in the light itself), teal ambient in the
shade. Every new world shader calls `og_paint_light` from `light()`.

### 3.2 Sky (`og_sky.gdshaderinc`, `sky.gdshader`)
One function, `og_sky_base(dir, t, detail, eye, wind)`, used by the sky shader (post off), the water
reflection and the post stack. Below the horizon it mirrors itself under a haze, so fogged ground and sky
are the same colour and the streaming edge cannot show. With the post on, the sky shader draws black and
the post paints the sky (additive effects over it survive).

### 3.3 Terrain (`terrain.gdshader`, `terrain_mesher.gd`)
Vertex colour = tile colour (sRGB), alpha = surface kind. The shader lays in warm/cool patches (10–40 m),
brush dabs at two scales along fixed angles with a domain warp (never a rotation field: it rings),
gold-tipped grass specks, dark dirt crevices and horizontal strata on rock walls, then the landmark's
geoglyph (§3.7).

### 3.4 Props (`prop_meshes.gd`, `foliage.gd`, `grass.gdshader`, `foliage.gdshader`, `rock.gdshader`)
Procedural low-poly meshes built once from a fixed seed; per-chunk placement on a worker thread from
`OgRng.derive_seed(seed, [cx, cy, SALT])` in a fixed tile order (`test_foliage.gd` guards determinism and
dry-land placement). Grass takes the ground colour under it so the field reads as strokes; blades shrink
away by distance instead of popping. Crowns use "cloud" normals, a gold back-rim and leafy silhouettes
(edges break into world-anchored leaf clumps). Visual only: no collision (rules task later).

### 3.5 Water (`water.gdshader`)
Mostly mirror: reflects `og_sky_base` (so the eye) with a painterly Fresnel; turquoise shallows,
blue-black depth, foam dabs from the depth buffer, gold glints. Looking down at water you look up at the
eye: it is where the sky is seen in play view.

### 3.6 Wind (`og_common.gdshaderinc`, `world_look.gd`)
`og_wind` = (direction x, z, strength, 0), toward 62° with an 18° wander. `og_gust` gives travelling bands
(0.4–1.4). Every moving thing samples these two; never invent a second wind.

### 3.7 Landmark (`landmark.gd`, `landmark_view.gd`, `og_landmark.gdshaderinc`)
One seeded site per 6×6 chunks (`OgLandmark.site`, margin 1 chunk). At each: a floating island (r 11 m,
strata body, gold-grass cap, ruin ring with lintels and a shrine, vines, a waterfall into mist, orbiting
debris), a pillar of light toward the eye (drawn as a volume by the post when on, a mesh when off), two
clustered gold lights, a ring of 11 rune-carved standing stones, and a 17 m geoglyph of the eye drawn by
the terrain shader from the `og_landmark` global (nearest site). A tree-free glade of 24 m around it.
Built to read from the vista camera; from the play camera the glyph and stones carry it.

### 3.8 Post stack (`paint_post.gd`, `post/*.glsl`; `--post off|low|high`, default high)

| Pass | Res (high) | What | Expected cost on Radeon 8060S, 1440p (1080p) |
|---|---|---|---|
| 1 prep | paint (≤ 960×540) | 4 full-res taps + depth per paint px, painted fog/mist, sky repaint (`og_sky_base`, ~20 noise evals where fogged), pillar volume, tonemap | 0.35–0.5 ms (same) |
| 1b exposure | 1 workgroup | 1024 taps, log-average, eased | < 0.01 ms |
| 2 tensor | paint | Sobel structure tensor | 0.05 ms |
| 3 blur ×2 | paint | separable Gaussian σ 2 (high only) | 0.1 ms |
| 4 Kuwahara | paint | anisotropic, radius 5, 8 sectors (low: isotropic radius 3 on ≤ 711×400) | 0.6–1.0 ms (low 0.2–0.3) |
| 5 composite | full | unsharp upsample, 11-tap LIC of 3-octave world noise, focal clarity + outline (focal region only), stars (sky only), exposure, grade, canvas, vignette | 1.5–2.5 ms (0.9–1.4) |
| **total** | | | **≈ 2.6–4.2 ms high (≈ 1.8–2.8 at 1080p); low ≈ 1.5–2.5** |

The paint buffer is capped (540 px high on high, 400 on low), so the heavy pass doesn't grow with the
screen. Software rendering in the cloud can't measure fps; these are estimates from tap counts and must be
confirmed on Lucid's machine (the HUD shows fps). The first knob if it's slow: the composite's LIC taps
(`TAPS` 5 → 3) and the finest hair octave.

## 4. Rules for future art

**Props and buildings**
- Low poly, rounded or chunky silhouettes; no detail smaller than ~10 cm (the paint eats it).
- Use the shared shaders (`foliage`, `rock`, `ruin`, `terrain`) or call `og_paint_light`; never
  StandardMaterial3D in the world (it ignores the painted light and the wind).
- Albedo: mid-value, slightly cool for organic matter, warm only for earth, wood, flowers and gold.
  No pure white, no pure black, no lime.
- Anything that can stand between the camera and the wanderer dithers with `og_occluder` (and crowns with
  `og_canopy_cut`).
- Seeded placement only through `OgRng.derive_seed`, on a worker thread, chunk-local, with a test.

**Characters and monsters**
- Dark bodies (blue-black to deep teal cloth/skin) with warm geometric accents (burnt orange, gold): the
  wanderer's language (moodboard 01–03, 06). A monster's danger reads through a warm/hot accent or an
  emissive (eyes, runes), not through a bright body.
- The focal outline is drawn by the post around the wanderer only; other characters get it later through
  the same pass (a list of focus points) rather than per-material outlines.
- Wind on hair and cloth, from `og_wind`.

**VFX**
- Emissive, additive, gold (1.0, 0.70–0.76, 0.32–0.40) or teal (0.35, 0.95, 0.85); never pure white.
  Bright enough (linear > 1.5) to glow through the grade.
- Hits and magic must stay legible over gold ground: give them a dark under-stroke or a teal core.
  (The current attack arc loses contrast against gold surfaces; see the G1 report.)

**Sky and landmarks**
- The eye is unique. Other sky features (galaxies, spirals) stay smaller and dimmer than it.
- Landmarks are read from far away by light (glyphs, pillars, emissive runes), not by height alone: the
  play camera rarely sees above ~7 m.

**Never**
- `randf()`/`randi()` or wall-clock time in placement; TIME is fine for animation only.
- A second fog, a second wind, a second sky function.
- Fog that doesn't match the sky at the streaming edge (the G0 trap: fog colour must be the sky).
