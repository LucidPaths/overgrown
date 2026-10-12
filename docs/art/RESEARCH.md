# Art research (ART-024)

What the best open-source game-art and design knowledge says, read for overgrown's 32 px actors, 16 px dual-grid ground and code-drawn pipeline. Every claim below comes from a page or repo I opened during this task (2026-10-12). Where a fetch failed or only a search summary was available, the entry says so. Anything that is my own judgement is marked **(ours)**.

Licence column: only code and instruction text can be copied from, and we copy none of it. We learn techniques and write our own code (CLAUDE.md, "Everything is ours"). Where the code in `tools/art/` closely follows a published algorithm it credits it in a comment; the only one is Oklab (public domain / MIT), used offline to design the colour ramps in `tools/art/palettes/` and not in any generator.

## 1. Skill and agent-instruction repositories (read in full)

| # | Repo | Licence | What I read | Verdict |
|---|------|---------|-------------|---------|
| S1 | https://github.com/omer-metin/skills-for-antigravity (`skills/pixel-art/`) | Apache-2.0 | `SKILL.md` + `references/patterns.md` (22 KB), `sharp_edges.md` (19 KB), `validations.md` | **Best pixel-art skill found.** Concrete rules, not vibes: hue-shifted ramps with numbers, selective outlining recipe, pillow shading and banding as named anti-patterns, "minimum 2 px wide for any appendage", "4 great frames beat 12 mediocre ones", silhouette test, one pixel scale per project. Weak spot: states rules as opinions with no sources, and Aseprite-centric. |
| S2 | https://github.com/anthropics/skills (`canvas-design`, `algorithmic-art`, `frontend-design`) | Apache-2.0 (`LICENSE.txt` in each skill) | The three SKILL.md files | Not pixel art, but the best *process* instructions: write a named visual philosophy first, express it second ("canvas-design", "algorithmic-art"); brainstorm a token system, then review the plan against the brief and revise whatever reads as a default before building; "spend your boldness in one place"; look at screenshots of your own work ("frontend-design"). We follow that order: research, bible, redraw, look, critique. |
| S3 | https://github.com/opusgamelabs/game-creator (`skills/game-assets/`) | MIT (SKILL.md front matter and README; `package.json` says ISC) | `SKILL.md`, listed companion files | The closest match to our setting: sprites as code, one shared palette per game, "differentiate enemies by which palette colours they use, not by adding new colours", "silhouette first", "test at the actual rendered size", "never rotate small pixel sprites". Weak spot: aimed at 16x16 matrices and quick prototypes, hostile-vs-friendly silhouette advice only. |
| S4 | https://github.com/Yoliani/skills (`pixel-art-professional`, `pixel-art-animator`) | MIT per `package.json` (no LICENSE file in the repo root) | Both `SKILL.md` | Solid summaries (cel shading vs dither shading, hue-shift workflow, 4-frame walk, idle 2-4 frames, hold frames) but tied to Aseprite MCP calls and says its own tool syntax is stale. Useful as a second opinion only. |
| S5 | https://github.com/sickn33/antigravity-awesome-skills (`skills/game-development/game-art/`) | MIT | `game-art/SKILL.md` | Generic checklist (style decision tree, 12 animation principles, "Art serves gameplay"). Nothing pixel-specific; its frame-count table (walk 6-12, death 8-16) is too generous for our budget. Read, little taken. |

Also looked at but not read in depth: the NousResearch `hermes-agent` skills tree has no pixel-art skill in the directory I could list (https://github.com/NousResearch/hermes-agent/tree/main/skills/creative: architecture-diagram, claude-design, design-md, p5js...). Not counted.

**The 3 best for overgrown:** S1 for craft rules, S2 for process discipline, S3 for the code-only-sprite workflow. Recommendations are in the report; none is vendored.

## 2. Pixel-art craft

### Colour ramps and palettes

- **Slynyrd, Pixelblog 1 (colour palettes)**: https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes . Positive hue shift of about 20 degrees per step ("20 is about as high as I go"), saturation peaks in the middle and never reaches 0 or 100, steps are larger at the ends and smaller in the middle, avoid high saturation together with high brightness ("the biggest mistake"), ramps of 9 for a 128-colour palette, 45 degree spacing between ramps, neutrals made by desaturating the middle columns.
- **Pixnote, shading**: https://pixnote.net/en/learn/shading . 32x32 wants three stages (highlight, base, one shadow); shadows darker, a touch more saturated and cooler; check the pillow-shading test "can you say where the light comes from?"; top-centre light for outdoor sun; hue shifts pay off from three steps up; sel-out is most effective at 32 px and above.
- **androidarts pixel-art tutorial**: https://androidarts.com/pixtut/pixelart.htm . Do not mix black or white into ramp ends, shift hue instead; skin shadows grey-warm-purple, mids orange, lights nearly yellow; outdoors add cool grey to shadows and yellow to lights; avoid pure local colours (green grass, blue water, grey rock); use less saturated colours to play against a few saturated accents; avoid long ramps of fully saturated colours; dither sparingly and make it do double duty.
- **Resurrect 64 (Lospec)**: https://lospec.com/palette-list/resurrect-64 . Ramps sit side by side, about five steps for the main hues and two for the rare ones; the author answers "Absolutely!" to commercial use in the comments (no licence text on the page). We use it as a structure reference only; no colour is copied.
- **Oklab, Bjorn Ottosson**: https://bottosson.github.io/posts/oklab/ . Lightness, chroma and hue are close to perceptually independent and blending does not drift toward purple. The post gives the sRGB to Oklab matrices and says the code is public domain (MIT also offered). **(ours)** We design each ramp as `L` and `hue` curves in Oklab in a throw-away script, then freeze the hex values into the palette JSON, so nothing at build time depends on floating-point colour maths.

### Outlines and internal lines

- **Lospec, pixel-art outlines part 2**: https://lospec.com/articles/pixel-art-outlines-part-2-using-color . An outline must increase contrast; make it darker than both the object and the background; selective outlining (darker where in shadow, lighter where lit) keeps contrast constant; internal lines: one step darker than the section, in the colour of the part nearer the viewer; light outline shades fail against dark backgrounds, so for changing backgrounds prefer dark shades. A reader comment notes extra shades can add single-pixel noise (a trade-off we watch).
- **LPC style guide**: https://lpc.opengameart.org/static/LPC-Style-Guide/build/styleguide.html . Outlines are a darker version of the object's colour, not black; characters are 2.5 heads tall, squashed and roundish; top-down at about 60 degrees; light from above with a small bias to the left; shadows shift toward purple, highlights toward yellow; ramps must not share one hue; drop shadow is `#322125` at 60 %; "detail more at tile edges, centre tile one colour or a very subtle pattern"; sheets ordered back, left, front, right. The fetched page states no licence for the guide text; we reuse none of it.
- **androidarts** (above): black lines are subtractive and muddy colours; remove outlines under objects that touch the ground so they do not float; use internal black lines only where separation is needed.

### Clusters, curves and cleanup

- **Saint11, article 2 (cluster sketching)**: https://saint11.art/pixel_art_articles/article2/ . A cluster is a group of pixels of one colour; keep the number of clusters low; avoid one-pixel clusters except for texture, anti-aliasing and eyes; curves are staircases and step lengths must progress logically (grow toward horizontal, shrink toward vertical); start from big blobs and refine to smaller clusters.
- **Tiny Warrior Games, line-art cleanup**: https://tinywarriorgames.com/2018/12/07/game-development-pixel-line-art-cleanup/ . Keep lines one pixel thick (no doubles); change the run length gradually along a curve (5, 4, 3, 2, 1, 2, 1, 1).
- **androidarts** (above): curve step patterns like 1,1,2,3 or 2,1,2 instead of uneven jaggies; two or more versions of a repeating tile, one busy and one quiet.
- **Saint11 tutorial index**: https://saint11.art/blog/pixel-art-tutorials/ . Titles only (TopDownWalkCycle, TopDownAttack, Subpixel, Outlines, Vegetation, Sand, Rock...); the page carries GIFs without text, so I took no rules from it, only the confirmation that Medeiros' top-down set exists. His quoted principle, via S1: "see how little the silhouettes move; it's the colours of existing pixels that change the most".

### Animation at low frame counts

- **Slynyrd, Pixelblog 56 (top-down attack)**: https://www.slynyrd.com/blog/2025/5/23/pixelblog-56-top-down-character-attack-animation . Six frames per direction; phases are anticipation (one frame), smear (several brief frames, the only phase with smear), follow-through (one frame at full extension, about one pixel into the target, held longer), recover; sword timing 100, 50, 50, 50, 100, 50 ms; do not smear anticipation or recovery.
- **Slynyrd, Pixelblog 9 (melee)**: https://slynyrd.com/blog/2018/9/8/pixelblog-9-melee-attacks . One smear frame is often enough, shaped along the arc; too much anticipation reads as input lag; hold the follow-through; recovery short; add a one-pixel overshoot after recovery.
- **sprite-ai.art, animation principles**: https://www.sprite-ai.art/guides/animation-principles . Marketing site, treat the numbers as rough. Squash and stretch on a 16 px sprite is about two pixels held a frame or two; anticipation is one frame of opposite movement; at 32 px let hair, capes and tails lag one to two frames; arcs, not pistons; a 4-frame walk with contacts slightly longer than passings.

### Top-down tiles and the dual grid

- **Slynyrd, Pixelblog 20 (top-down tiles)**: https://www.slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles . 16x16 tiles, mix flat and textured grass with occasional flowers, keep visual weight even across the tile, clusters wrap across tile edges, few colours (many blur the texture), repeat a few key clusters, keep two busy textures apart and use negative space between them, check seams zoomed out.
- **Excalibur.js, dual tilemap technique**: https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique . A logic map plus a graphics map offset by half a tile; each graphics tile reads four corner cells; 5 overlay tiles instead of 47; credits Oskar Stalberg (*Beyond Townscapers*) and Jess::Codes ("Draw Fewer Tiles"). No licence stated on the article.
- **Red Blob Games autotile comparison**: https://www.redblobgames.com/articles/autotile/claude/ . 4-bit (16 edge tiles), 8-bit blob (47), dual grid (16, corner based), Wang tiles (aperiodic), priority levels for several terrains with overlays drawn lowest first. This is exactly our model; no licence stated.
- **TileMapDual (Godot)**: https://github.com/pablogila/TileMapDual . Seen in search results only, I did not open it; listed for the 47-to-15 claim and its credit to Stalberg.

### Games with the target vibe (words only)

- **A Short Hike**: https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/ . Developer: "flat cohesive shading and no anti-aliasing", a soft outline so objects stay legible at very low pixel counts, a calm, meditative mood. Its palette came from colours sampled off autumn photos (from search summaries of his GDC talk, not on this page). **(ours)**: it shows that low contrast ground plus a few saturated focal objects is what makes "cozy" legible.
- **Eastward**: https://www.gamedeveloper.com/disciplines/road-to-the-igf-pixpil-s-i-eastward-i- . "Strong colors, various buildings and objects, rich and subtle details", "play like an animated movie"; a decayed world that still feels alive because people live in it. **(ours)**: this is the closest tonal sibling to "cozy surface, brutal depth".
- **Hyper Light Drifter**: https://www.gameinformer.com/games/hyper_light_drifter/b/wii_u/archive/2014/03/14/developer-covers-key-aspects-hyper-light-drifter.aspx . "Each environment uses a striking and specific palette to highlight landmarks." The same article does not discuss readability; our claim that its characters stay readable because they hold the highest value contrast on screen is **(ours)** from play, not from the source.
- **Stardew Valley**: https://en.wikipedia.org/wiki/Stardew_Valley . Only fact used: one developer drew all of it; everything else about its look (warm, earthy, saturated mid-values; chunky 16x32 characters with 1 px dark outlines; a darker outline than any ground colour) is **(ours)**, from play. I found no primary source on its palette.
- **Zelda top-down and Cube World** were named in the brief; I did not find open sources on their palettes and make no sourced claims about them.

## 3. Procedural generation, and what makes it look hand-made

- **zfedoran/pixel-sprite-generator**: https://github.com/zfedoran/pixel-sprite-generator (MIT). Random mask, mirrored, rendered, from Dave Bollinger's write-up. Lesson **(ours)**: pure mirroring of a random mask gives "generated" sprites (spaceship blobs); the hand-made look needs authored structure plus deliberate asymmetry.
- **KilledByAPixel/ZzSprite**: https://github.com/KilledByAPixel/ZzSprite (MIT). Symmetric sprites, mutation of shape and colour, 4-colour and mono modes. Same lesson; also confirms that seed plus mutation is a good variation interface, which is how we will do ageing and mutations later (ART-012/013).
- **mxgmn/WaveFunctionCollapse**: https://github.com/mxgmn/WaveFunctionCollapse . Local similarity to a sample, minimum entropy heuristic ("removes the directional bias"); simple tilesets "don't produce interesting global arrangements", so correlations die with distance. **(ours)**: for a ground with only per-cell variant picks, break up grid feel with calmer, lower-contrast tiles and larger features rather than more randomness. Licence: not shown on the fetched page.
- **ClusterSweep (search result only, not opened)**: https://gregorigin.itch.io/clustersweep . A despeckler that merges isolated 1x1 pixels into the dominant neighbour. **(ours)**: our generators run the same cleanup on shapes (no orphan pixels, no doubles in outlines) as the last step, and put texture back deliberately.

**What makes procedural art look hand-made, as I take it from the sources above (ours, synthesis):** (a) authored shape first, texture second; (b) few, deliberate clusters instead of per-pixel noise; (c) rhythm on curves; (d) a clear light direction and a hue-shifted ramp rather than a luminance gradient; (e) selective outlines; (f) detail concentrated where the eye goes (faces, hands, edges) and quiet elsewhere; (g) small, intentional asymmetry; (h) restraint on colour count.

## What we take

Numbered rules; DIRECTION.md turns each into a binding rule and lists the code that implements it.

1. **Process.** Philosophy first (a named visual direction), then a token plan, then pixels; review the plan against the brief and replace anything that is a default; always render, upscale and *look* before judging (S2).
2. **Silhouette first.** Every species must be identifiable as a solid shape at 1x; shapes, not colours, carry species identity (S1, S3, Pixnote).
3. **Chibi proportions.** About 2.5 to 3 heads tall on the 32 px cell; the head is where the detail budget goes (S1, LPC).
4. **One light, from above.** Top-centre light, so right (mirrored) frames stay consistent; shadows fall straight down; no side light baked into sprites (Pixnote, LPC, androidarts).
5. **Cel shading in three to four bands**: highlight, base, shadow, plus one deep shadow for occlusion. Shade by form (top lit, underside dark), never by edge distance; no Bayer-dither shading on bodies (Pixnote, S1 "pillow shading").
6. **Hue-shifted ramps designed in a perceptual space.** Five steps per ramp; shadows cooler and slightly more saturated, lights warmer and less saturated; no pure black or white in ramps; 15 to 25 degrees of hue travel (Slynyrd, androidarts, LPC, Oklab).
7. **Value structure decides readability.** Actors hold the widest value range on screen; ground is mid-value and low contrast; the outline is darker than any ground colour; pop colours are the only highest-chroma, highest-lightness pixels (Lospec outlines, A Short Hike, ours).
8. **Selective, coloured outlines.** 1 px, in a dark shade of the part's own ramp (never pure black); a lighter shade on lit top edges; no outline under a character's soles-line; internal lines one step darker, in the colour of the nearer part (Lospec, LPC, androidarts).
9. **Clusters, not noise.** No orphan pixels on shapes; texture is made of deliberate 2 to 4 pixel clusters; eyes and sparkles are the allowed 1 px exceptions; curves step with a smooth run-length progression (Saint11, Tiny Warrior, androidarts).
10. **No thin protrusions.** Limbs, tails and ears are at least 2 px wide, 3 px where they need a shade (S1).
11. **Faces get the detail budget.** 2 px eyes with a highlight, readable at 1x, species-specific muzzle, ear and hair shapes; hands and feet are simple blocks (S1, S3).
12. **Palette discipline.** One shared actor palette; species differ by which ramps they use plus shape, not by extra colours; biome palettes differ in mood by hue family and temperature, not by structure (S3, Hyper Light Drifter).
13. **Avoid pure local colours.** Grass is yellow-green in light and blue-green in shadow, never `#00ff00`; water is not `#0000ff` (androidarts).
14. **Saturation is spent in proportion.** The ground is moderately saturated, characters a little more, pop colours maximum; never a long ramp of fully saturated colours (Slynyrd, androidarts).
15. **Four strong frames beat twelve weak ones.** Spend frames on key poses and hold the impactful one; contact frames slightly longer than passing frames (S1, sprite-ai, Slynyrd).
16. **Attack = anticipation, smear, follow-through, short recovery**, with anticipation kept to one frame so it never reads as input lag, and no smear on anticipation or recovery (Slynyrd 9 and 56).
17. **Idle is colour, not position.** A breath of one pixel on the chest and head, plus a blink, are enough; long idles read as noise (S1, Saint11 via S1).
18. **Follow-through on soft parts.** Tails, ears and hair lag the body by one frame (sprite-ai).
19. **Never rotate or scale sprites at runtime**; every pose is drawn (S1, S3).
20. **Ground tiles are quiet.** Centre of a full tile is one tone or a very subtle pattern, features are a few clusters per tile, busy and quiet variants alternate, detail concentrates at transitions (LPC, Slynyrd 20, androidarts).
21. **Variation without grid feel.** Several variants per full tile, features kept clear of the tile edge so no cluster is cut at a seam, and low contrast so repetition is not seen (Slynyrd 20, WFC lesson).
22. **Dual-grid transitions drawn as organic, low-frequency shapes.** Smooth boundary curves with run-length rhythm, not per-pixel jitter; every edge pixel of a transition depends only on its two corners so neighbours meet exactly (Excalibur, Red Blob, Stalberg).
23. **Edge treatment by terrain class.** Land over land: lit top lip, dark bottom lip; shorelines: a pale foam or wet lip; shallow over deep: foam shelf; cliffs: a face with strata, in shadow (LPC, ours).
24. **Each biome has a specific, striking palette**, so a screenshot is recognisable at a glance (Hyper Light Drifter).
25. **Props and monsters must inherit rules 4 to 14 verbatim**; they differ by shape, not by shading system (LPC "compatibility", S3).
26. **Procedural does not mean random.** Randomness only varies authored structure: positions inside a clean region, which variant of a motif. Faces, ears, hair and species traits are authored (hand-drawn pixel templates in code), as authored shapes are what made the sources' results look handmade, and pure random-mask generators did not (zfedoran, ZzSprite).
27. **Frames are compact data.** Many quiet frames compress better than few noisy ones; per-pixel speckle costs bytes and hurts readability, so removing it is also a startup-time win (ours).
28. **Mirror carefully.** Mirrored right frames must not betray the flip: no baked directional light, no readable asymmetry that matters (a hand-held item is added later by weapon layers) (ours, from the A-24 constraint).
