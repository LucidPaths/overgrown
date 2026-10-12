# overgrown art bible: "Plum Shadow, Gold Light"

Written for ART-024 (Lucid's art direction pass, 2026-10-12). Grounded in `docs/art/RESEARCH.md` ("What we take", rule numbers in brackets such as `[R6]`). Every future art task (props, monsters, weapons, buildings, VFX, UI icons, paper-doll layers) inherits this file. Where this file and a generator disagree, fix whichever is wrong in the same change.

## 0. The one-line direction

**A sunlit diorama with a bruise-coloured heart.** At a glance it is warm, saturated and friendly: butter-gold light, rounded shapes, big readable faces. Look closer and every shadow is plum, every dark is a little too deep, every cheerful creature has teeth. The cozy surface and the brutal depth are the same palette: gold light and plum shadow, everywhere, in every biome.

Three promises that every asset must keep:

1. **Read first.** A character is identifiable as a solid silhouette at 1x, on any biome, in a fight.
2. **Light is gold, shadow is plum.** Lights drift warm, shadows drift cool and a little more saturated. Nothing is pure black, pure white or a pure local colour. [R6, R13]
3. **One thing pops.** The only highest-chroma, highest-lightness pixels in the game are magic, hits, loot and UI (the pop palette). Characters and world sit just under that line. [R7, R14]

## 1. Palette philosophy

### 1.1 Three palette families

| Family | File | Rule |
|---|---|---|
| **Biome** (ground and later foliage, props, buildings) | `palettes/{meadow,forest,river,mountain,ocean}.json` | Each biome has its own *mood* (hue family and temperature) but the same *structure* (the same ramp names, the same lightness bands), so any biome can be swapped under any prop. |
| **Actor** (skin, fur, feathers, scales, hair, cloth) | `palettes/actors.json` | Shared by every biome (OQ-027). Six steps per ramp. Wider value range than the ground, so characters always read against it. |
| **Pop** (magic, hits, loot, rarity, UI) | `palettes/pop.json` | Reserved. Nothing else may use these colours or exceed their chroma. |

### 1.2 How ramps are built (Oklab, designed offline)

Ramps are designed in Oklab (lightness L, chroma C, hue h in degrees) and frozen as hex in the JSON. The shipped files are the source of truth; any new ramp follows the recipe:

- **Hue drift.** Shadows drift toward plum-violet (h about 295), lights toward butter-gold (h about 95), by 20 to 40 degrees over the ramp. Greens shade toward teal-blue (never toward brown), blues light toward cyan (never through grey), yellows and skin shade toward orange-red then plum. [R6]
- **Chroma.** Peaks in the middle, falls toward both ends; the dark end keeps more chroma than the light end. Never a long ramp of fully saturated colour. [R14]
- **Lightness.** Biome ground ramps: 4 or 5 steps, dL about 0.09 (a compressed, quiet band). Actor ramps: 6 steps, dL about 0.12 to 0.14.
- **Actor ramp layout (index):** `0` line (the outline colour for that material, L about 0.15 to 0.22), `1` deep shadow (occlusion, under-chin, inside folds), `2` shadow (form shadow, undersides), `3` base, `4` light (top-lit planes), `5` highlight (1 to 2 px specular, never a region).
- **Biome ramp layout:** grass (5), grass_alt (3, a bluer tone, used for the cool root of grass tufts), dirt (5), sand (4), stone (5), cliff (5), shallow_water (5), deep_water (3), very_deep_water (3), detail (4: flowers, litter, pebbles, shells, blossoms, ordered dark to light).

### 1.3 Biome moods

| Biome | Mood | Hue family | Notes |
|---|---|---|---|
| **meadow** | Spring picnic. The hero palette and the most saturated. | Yellow-green grass (h 133), warm brown earth, sky-blue water, butter sand | What the first screenshot shows; flowers are red, orange, yellow, cream. |
| **forest** | Canopy shade. Cooler, darker, calmer. | Blue-green (h 155) with amber, rust and berry litter | Contrast comes from warm litter on cool ground. |
| **river** | Wet and lush. | Emerald (h 150), cyan-turquoise water, silty sand | Brightest water in the game. Reed, lime, straw, blossom detail. |
| **mountain** | Cold high country. The least saturated. | Sage-olive grass (h 118, C 0.075), slate and indigo stone, lilac-grey shadows, snow-pale lights | Characters pop hardest here; keep it that way. |
| **ocean** | Tropical coast. | Aqua sea (h 190), shell sand, warm terracotta cliffs, coral detail | The only biome with warm cliffs. |

Every biome keeps the plum shadow family, so a screenshot that crosses a biome border still looks like one world.

### 1.4 Actor palette

- One ramp per covering (skin, fur, feathers, scales) plus accent ramps (cream, beak, belly), hair ramps, base-cloth ramps, tusk.
- **Species differ by shape first, colour second, ramp use third.** No species may share a body ramp with another.
- **Base clothes are placeholders for the paper doll (ART-010).** Each species wears a plain tunic in its own dye (crimson, violet, sky, leather, teal, moss, rose, ochre, linen) so a crowd reads at once. Dyes stay at medium chroma, below the pop line.

## 2. Value structure: what stands out from what

Think in Oklab lightness L (0 black, 1 white). From most to least prominent:

| Layer | L range | Contrast rule |
|---|---|---|
| **Pop** (magic, hits, loot) | any, with the highest chroma in the game | May break every other rule; that is the point. |
| **Actors** | outline 0.15 to 0.22, fills 0.30 to 0.97 | Outline at least 0.25 L darker than the ground it sits on. Body base differs from ground by at least 0.10 L or 0.08 C. |
| **Props and monsters** (later) | outline as actors; fills 0.28 to 0.90 | Inherit the actor outline rules. |
| **Ground** | 0.28 to 0.93 (waters and cliff faces go darker), per-ramp steps about 0.09 | Texture contrast is at most one ramp step inside a surface. Edges carry the contrast, centres are quiet. [R20] |

Practical tests (use them in every review): (a) blur the screenshot, characters must still be the first thing you see; (b) fill every sprite with one flat colour, the species must still be identifiable; (c) view at 1x on the worst biome for that species (fox on forest litter, lizard on river water, bird on ocean). [R2]

## 3. Light

- **One light: straight above, a touch toward the camera.** Highlights sit on top planes (hair crown, shoulders, head top, tops of ears), shadows on undersides (under the chin, under hair fringes, under the tunic hem, bottoms of limbs, soles). Shadows fall straight down. [R4]
- **No side light is baked into sprites.** Right-facing frames are exact pixel mirrors of left-facing ones (A-24), so any left or right light would flip when a character turns. Ground shadows are drawn by the renderer (ART-018, LPC convention `#322125` at 60 %); sprites never contain their own cast shadow below the sole line.
- **Pillow-shading test.** Cover the outline; if you cannot say where the light comes from, redo it. Edge distance never picks a shade: form does (top lit, bottom shaded, overlaps occluded). [R5]
- **Ground light:** the same top light; raised edges (land over land) catch light on their top lip and shade on their bottom and side lips.

## 4. Outlines

- **1 px, outer silhouette only, never pure black.** The outline colour is index 0 of the ramp of the part it surrounds (selective outlining). [R8]
- **Sel-out:** where the outline sits above a part (a lit top edge) it uses index 1 instead of 0, one step lighter; sides and bottoms use index 0. Contrast between outline and fill stays about constant all the way round.
- **No outline under the sole line.** The bottom outline row of the feet is the contact edge and is the one place the outline is allowed on the ground.
- **Internal lines are one step darker than the part they sit on** (ramp index 1 or 2) and only where two parts must separate: chin over collar, arm over torso, hair over face. Elsewhere separate with value, not lines. [R8]
- **Ground tiles have no outlines.** Land edges use a lit top lip and a dark bottom lip inside the shape (section 8).

## 5. Proportions on the 32x32 actor cell

- The cell is 32x32. The sole row is 29 (`SOLE_Y`), the outline under the soles is row 30, rows 0 and 31 stay empty. Nothing touches columns 0 or 31.
- **About 2 to 2.8 heads tall (chibi), measured on the skull with ears and crests excluded** (dwarf 2.0, human 2.2, elf 2.5, rabbitfolk about 2.8). The head is the biggest shape and takes the detail budget. Faces at 1x need: two eyes of 2x2 px (shine pixel top-left) plus one species marker (muzzle, beak, tusks, beard, ears). [R3, R11]
- Torso 6 to 14 px wide at the shoulders (twice the shoulder half-span of 3 to 7 in the species table), arms 2 to 5 px (elf and rabbitfolk 2, bearfolk 5), legs 2 to 4 px (birdfolk 2, dwarf, orc and bearfolk 4) with a 0 to 4 px gap between them (elf and rabbitfolk touch, bearfolk 4), feet one px wider than the leg. No limb thinner than 2 px (3 when it needs a shade; the 2 px limbs are the slim species' and the bird's talons). [R10]
- **Leave room for gear:** torso 7 to 9 rows, legs 4 to 7 rows, arms hang straight in the base pose, and nothing important lives on the hip or shoulder rows that armour will cover.
- Per species (rows: leg / torso, widths: shoulder half-span / hip half-span) live in `lib/species.py`, and the heads, ears, tails and other features in `gen/heads.py`; together they are the single source for body shape.

## 6. Shape language

Silhouette is identity. Each species owns one dominant shape and one signature feature, visible in all three drawn views (front, side, back):

| Species | Dominant shape | Signature | Read-at-1x cue |
|---|---|---|---|
| **human** | Rounded square, neutral | Short tousled hair, crimson tunic | The reference body; every other species is measured from it. |
| **elf** | Vertical diamond, long and slim | Long ears swept up and out, long straw hair, violet tunic | Tall, narrow, ears wider than the head. |
| **dwarf** | Wide block, short legs | Square head under a huge beard, plaited, sky-blue tunic | Wider than tall; no neck, no legs to speak of. |
| **orc** | Inverted triangle (broad shoulders, small head) | Heavy jaw, two tusks, hunched stance, dark leather | Shoulders wider than any head. |
| **foxfolk** | Triangles | Tall pointed ears, white muzzle, bushy tail with a cream tip | Tail and ears break the silhouette on three sides. |
| **bearfolk** | Circles, the biggest body | Round ears, broad snout, thick arms | Largest area on the cell. |
| **rabbitfolk** | Tall ovals | Very tall ears, big feet, white puff tail | Ears reach row 1. |
| **birdfolk** | Teardrop plus a wedge | Crest, hooked beak, wing arms with long primaries, feather tail | Spiky top, pointed front. |
| **lizardfolk** | A long taper (S-curve) | Long snout, head spines, thick tapering tail, yellow belly | Tail is the longest single shape. |

Rules: shapes combine, they do not blur (a fox does not get round ears); the species marker is never covered by hair or gear; ears, tails and crests are at least 2 px wide at their narrowest and have a lit top edge.

### Biome shape language (for props and foliage, later)

| Biome | Shapes |
|---|---|
| meadow | Round, soft and clumped: fat bushes, round-topped trees, flower clusters. |
| forest | Tall and layered: columnar trunks, overlapping canopy discs, fern fans, mushrooms. |
| river | Long and curved: reeds, banks that bend, lily pads, stepping stones. |
| mountain | Angular and stacked: wedge rocks, slab strata, sharp pines, snow caps. |
| ocean | Smooth and flowing: dune ridges, shell spirals, palm fans, driftwood. |

## 7. Animation

Frame counts (locked by `contracts/actor-anims.json`): idle 2, walk 4, attack 4, dodge 4, hurt 2, death 4. Poses are joint offsets on the shared skeleton (`lib/anims.py`); drawing never rotates or scales a sprite. [R19]

- **Four strong frames.** Every frame is a key pose. [R15]
- **Walk:** contact, passing, contact, passing, with a 1 px body bob on the contacts, arms opposite the legs. In front and back views the lifting foot rises 2 px; in profile the feet travel 3 px either way. At least one foot stays on the sole line.
- **Attack:** anticipation (1 frame, the weapon hand pulled back and the body one px lower), strike (the widest, longest pose; the whole body leans in 1 px), follow-through (full extension, held), recover (short). No smear on anticipation or recover. M1 attacks have no weapon pixels (OQ-022); weapons add a smear frame later (ART-009). [R16]
- **Idle:** two frames: a rest pose, then the chest and head sink 1 px (a breath) while tails lag up 1 px. Keep it to that one pixel; anything bigger reads as bouncing, and long idles read as noise. [R17]
- **Dodge:** crouch, ball-tuck, deepest tuck, rise. The tuck must still carry the species silhouette.
- **Hurt/death:** hurt is a flinch and a sag; death ends in a heap that the renderer holds on its last frame.
- **Follow-through:** tails and long ears move one frame after the body. [R18]
- **Soles never leave the ground line**, except a lifted foot, and the head never rises above its base row (the cell's top rows belong to ears and crests).

## 8. Tiles: variation, transitions, no grid feel

Tiles are 16x16 render cells of the dual grid (corners on four world tiles, mask bits TL1 TR2 BL4 BR8). Contract: `contracts/tile-frames.json`.

- **Quiet centres.** A full tile is one base tone plus two to four deliberate clusters (blades, pebbles, ripples, flowers). Per-pixel speckle is forbidden. Features keep 1 px clear of the tile edge so no cluster is ever cut at a seam. [R9, R20, R21]
- **Variants.** Every full tile has ten variants (`contracts/tile-frames.json`) whose clusters differ in kind, count and position, so no feature repeats on a visible lattice; two variants per transition mask. More variants over less contrast beats more contrast. A feature that is unique to one variant (a flower) must be rare: it will recur at the same offset in every tile that draws that variant. [R21]
- **Transitions are shapes, not noise.** Boundaries are smooth, low-frequency curves with a gradual run-length progression; every edge pixel on a transition frame depends only on its two corners so neighbours meet exactly (the `tests/test_tiles.py` corner rule). [R22]
- **Edge treatment by terrain class** [R23]: land over land has a lit top lip and a dark bottom/side lip inside the shape; the shoreline lip is pale foam over wet sand; shallow water over deep gets a foam shelf; cliffs are a stratified face under the lit top, in shade; deep and very deep water stay calm (few ripples) so the shallows read as the edge of something.
- **Terrain character:** grass is clumped blades with rare flowers; dirt is flat with pebbles and cracks; sand is wind ripples and shell glints; stone is slab seams (a dark run with one step, lit along its lower edge) and lit chips; water is staggered horizontal ripple dashes, longer and lighter in the shallows.
- **Never** place a busy terrain beside a busy terrain: busy variants only appear in quiet-edged tiles. [R20]

## 9. Don't list

- No pure black (`#000`), pure white (`#fff`) or pure local colour (green grass, blue water) anywhere. [R13]
- No Bayer or random dither as shading. Dither is for texture only, one style per piece. [R5]
- No pillow shading, no uniform edge darkening, no banding (parallel same-width bands). [R5]
- No orphan pixels on a silhouette; no doubles on outlines (two-pixel-thick stair steps). Exceptions: eyes, glints, sparkles. [R9]
- No limb, ear, tail or horn under 2 px at its narrowest. [R10]
- No baked directional light, no baked cast shadow, no colour that only works on one biome. [R4, R28]
- No runtime rotation or scaling of pixel sprites. [R19]
- No new colour outside the palette files; if a shade is missing, add it to the ramp. [R12]
- No second pixel scale: art px are the only px; UI uses the same grid. [R14]
- No pop colours (fire, frost, rarity...) on anything that is not magic, a hit, loot or UI.
- No downloaded, traced or generated-by-model art, ever.

## 10. For future art tasks (they inherit all of the above)

How to extend each family without breaking the look.

- **Props (ART-007):** biome-palette ramps only; outline per the part's ramp (index 0, index 1 on lit tops); light straight above; a flat, readable base footprint that sits on the sole line; break states as separate frames, never rotations. Trees: one trunk shape, one canopy disc stack, a bluer deep-shadow underside so they read as rooted. Quiet interiors, busy edges (tufts, leaf clusters).
- **Monsters (ART-008):** use the actor palette ramps plus new ramps *in the same recipe* (hue drift, six steps, index 0 = line); every body plan gets one dominant shape from section 6's vocabulary, a face with a 2x2 eye plus a shine pixel, and a size class (32 px cell, 64 px for big). Palette discipline: differ by ramp use, not by adding colours. Danger reads through shape (spikes, teeth) and posture, never through pop colour.
- **Weapons (ART-009):** drawn from `hand_anchor`; 2 px minimum blade width; ramps per material (steel is a cool grey ramp with a pale highlight, wood warm); the smear frame is one frame between anticipation and follow-through. Pop colours only for enchant glows.
- **Paper-doll layers (ART-010):** each layer is drawn against the same skeleton and the same ramps, fills the same silhouette plus 1 px, and carries its own outline only on the edge it adds; helmets leave the species marker (ears, muzzle, crest) visible or replace it with a silhouette that still reads.
- **VFX (ART-014, 015):** pop palette only; hard-edged shapes, 1 to 2 frame holds, no soft glows in sprite art (glow is a renderer layer).
- **Buildings (ART-019):** the biome palette plus the same plum shade for all roofs' undersides; front faces visible (3/4); every wall has a dark base row and a lit top row.
- **UI icons (ART-020):** the same grid; actor outline rule; pop ramps for rarity.
- **Aging and mutation (ART-012, 013):** recolours and overlays through ramps, never new drawings: grey fur is the same ramp desaturated and lifted one step; scars are 1 px index-1 lines.
- **Seasons (ART-016):** a season is a palette file variant of the same structure, so the plum shadow family stays constant.

### Review checklist (paste into every art PR)

1. 1x silhouette test passed for every new shape?
2. Light from above, no baked side light, no baked ground shadow?
3. Outline from the part's ramp, lit tops one step lighter?
4. No orphan pixels, no thin protrusions, no dither shading?
5. Only palette colours; no pop colour outside pop things?
6. Rendered at real game scale on two biomes and looked at?

## 11. Where the rules live in code

| Rule | Code |
|---|---|
| Palette recipe (Oklab, hue drift, six-step actor ramps with index 0 = line) | `tools/art/palettes/*.json` (designed offline; the hex values are the source of truth) |
| Selective outline (own-ramp line colour, lit top edges one step lighter) | `gen/actor.py::Sheet.outline` |
| Light from above, form shading (top lit, bottom shaded, no side light) | `gen/actor.py::_shape_shade`, `Sheet.darken` |
| Shape language and species markers | `gen/heads.py` (`HEADS`, `TAILS`), dimensions in `lib/species.py::SPECIES` |
| Proportions on the 32 px cell, sole line, head overlap | `lib/skeleton.py::base_skeleton`, `HEAD_OVERLAP`, `SOLE_Y` |
| Fit-in-cell and feet-on-sole checks | `gen/actor.py::_cell_check`, `tests/test_actor.py` |
| Animation keys, lag of tails and ears | `lib/anims.py::ANIMS`, `Pose.tail` |
| Quiet tile centres, features off the seam | `gen/tiles.py::_scatter` and the per-terrain texture functions |
| Organic transitions, ring exactness | `gen/tiles.py::coverage`, `_despeckle` |
| Edge treatment by terrain class | `gen/tiles.py::_rims`, `_cliff_face` |
| No colour outside the palette | `tests/test_actor.py::test_actors_use_only_actor_palette_colours` |
| No orphan pixels | `tests/test_actor.py::test_silhouettes_have_no_orphan_pixels` |

### Template legend (heads and tails)

`1 2 3 4 5` body ramp shades, `A B C D E` accent, `a b c d e` hair, `F G H I J` extra (beak, inner ear). The letter is the shade, so **`A` and `a` are the *darkest*, `C`/`c` the base**; index 0, the line colour, is added by the outline pass. `X` eye, `W` eye shine, `P p` pink, `T t` tusk, `k` the body line colour used inside a shape. Rows may be written in groups of four columns separated by spaces; `sym` mirrors a left half, `raw` takes full rows.
