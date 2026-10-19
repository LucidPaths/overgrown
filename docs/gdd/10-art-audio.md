# 10 — Art & Audio Pipeline

**Rule (OQ-038, D8): everything in the game is ours or credited.**
- **Allowed:** anything we make by any method, including Lucid's ChatGPT images and AI 3D generators; third-party assets under licences compatible with an MIT repo (CC0 or public domain, MIT, Apache-2.0, BSD, CC-BY with attribution, OFL for fonts); and inspiration from anything. Share-alike (CC-BY-SA, GPL art) is allowed only if the file keeps and is marked with its licence.
- **Not allowed:** no licence or an unknown one, personal-use-only, NonCommercial, NoDerivatives, and ripped or traced work from commercial games or artists.
- **Credits:** every third-party file lives under `game/assets/third_party/` and has a row in `game/assets/third_party/CREDITS.md` (path, source URL, licence, author, changes). CI runs `tools/check-credits.sh` and fails on an unlisted file, a row without a file, or a licence outside the allow-list.

Seeded generation stays deterministic: same code + same seed = identical output. That keeps the art reviewable in PRs and regenerable.

## Visual spec

- **Camera (OQ-034, D4):** a tilted action-RPG camera. It is low enough to see the horizon and sky during play, and pulls out to wide vistas at landmarks. The world is 3D (a heightfield terrain with biome materials), and 1 tile = 1 m. The tilt angle and the vista zoom are tuned in GOD-005 and G1.
- **Direction (OQ-035, D5): Lucid's mood board** (`docs/art/moodboard/`). A painted look (oil and impasto), teal against orange and gold, cosmic skies, wind, and small figures in huge worlds. The images are Lucid's own and may also ship in-game (title and loading art). The G1 art bible turns the board into rules; the ART-024 art bible (`docs/art/DIRECTION.md`) was written for the pixel pipeline and is reference only until then.
- **The wanderer (OQ-036, D6):** faceless, a poncho with orange geometric borders, a gold scarf, wind-blown hair. It is the north star for character design and for the game's identity. The details are decided in G1.
- **Look stack:** Forward+ with a painterly post-process (brush and Kuwahara-style filtering, canvas grain, palette grading to the mood board, glow, volumetric fog), animated cosmic skies as a sky shader, and wind shaders on foliage, cloth and hair.
- **Readability in fights:** the painted look must never hide a telegraph or a hit. This is a G1 acceptance criterion.
- **Palette:** the old rule carries over as a goal: each biome has its own mood, and a global **pop** colour set for magic, hits, loot glints, rarity and UI stays readable in every biome (OQ-027). How that maps to materials and grading is decided in the G1 art bible. The overall vibe is saturated, cozy and lighthearted.

## Pipeline

```
art/blender/              (planned, G1) headless Blender Python: model, rig, animate → .glb
game/assets/              authored assets Godot imports (.glb, textures, audio)
game/assets/third_party/  third-party files + CREDITS.md (checked in CI)
```

- **Characters and props are built by agents through headless Blender Python scripts** and exported as glTF (OQ-037, D7). Agents may start from CC0 or other permissively licensed bases (for example the Quaternius characters and animation library) or from AI-generated meshes, then rework them into the wanderer style. Blender MCP is optional for Lucid locally; its asset integrations may be used only for sources the D8 rule allows.
- **Outputs:** `.glb` files are built in CI or committed as authored assets. Godot imports them; nothing is converted by hand.
- **Parametric builds:** variants (size, age, mutation, palette) are parameters of a script, not new files.
- **Determinism:** Blender rebuilds are byte-identical once the spike's non-determinism workarounds are applied; they carry into the build scripts.
- **Review:** `tools/godot/capture.sh` renders an image of the work under xvfb for PR review. Software rendering runs at about 4 fps, so a capture proves how it looks, not how it performs.
- **Retired:** the pixel atlas pipeline (`tools/art/`: 32×32 actors, 16×16 tiles, 4 directions, nearest-neighbour WebP atlases). OVR-010 deletes it; it stays in git history.

## Paper doll

Characters are layered: body → underwear/base clothes → legs → feet → chest → hands → head/hair → helmet → back → weapon/off hand. Each layer is generated against the same skeleton anchor points so every armor piece fits every species body plan. Fashion matters: dye channels, a cosmetic override slot per armor piece. How the layers work on Blender-built, glTF characters (meshes on the shared skeleton) is decided in G1.

## Living visuals

- **Aging variants** for monsters and NPCs: grey fur or hair, scars, a missing eye, a limp, lean vs bulky builds. These are overlays and parameter shifts, not new species.
- **Mutations:** recolors, glows, extra features.
- **Weather and seasons:** rain, snow, fog, storm lighting, wind-driven foliage, seasonal palette shifts, snow cover, frozen rivers. This is where the world feel comes from, so it gets real budget.
- **Lighting:** day/night tint, light sources (torches, campfires, magic) with soft radial light.
- **Shadows:** every entity casts a ground shadow. Flyers in the air are shown only as their shadow (→ ECO-012).

## Audio

Audio follows the same D8 rule (OQ-038): we make it, or take CC0 or other allowed sounds with a CREDITS row.
- **SFX:** hits per material, footsteps per terrain, UI, creature calls and spells. Synthesised by script (sfxr-style: envelopes, oscillators, noise, filters) or taken from CC0 sound libraries.
- **Ambience:** per-biome beds (wind, birds, water, insects), modulated by weather and time of day.
- **Music:** procedural and generated at runtime. Pieces have layers per biome, a day/night variation and an intensity layer for combat.

## Tasks

- [x] **ART-001** `[proto]` Pipeline scaffold: `build.py` → atlas PNG + JSON, consumed by the client (→ TEC-005). — #7
- [x] **ART-002** `[proto]` Palette system: biome palettes + global pop palette. — #9
- [x] **ART-003** `[proto]` Primitive drawing library: shapes, outlines, shading ramps, dithering. — #10
- [x] **ART-004** `[proto]` Ground tiles: grass, dirt, sand, stone, cliff, water depths, with autotile transitions; one palette per biome (OQ-018, OQ-027). — #19
- [x] **ART-005** `[proto]` Character body generator per species, 4 directions. All 9 species share one humanoid skeleton and differ by parameters; new actor palette (OQ-020, OQ-027). — #17
- [x] **ART-006** `[proto]` Animation sets: idle, walk, attack per weapon family, dodge, hurt, death. M1 ships blades + unarmed attacks with no weapon pixels; frames carry a hand anchor (OQ-022). — #21
- [ ] **ART-007** Props: trees, rocks, bushes, fences, crates, with break states and topple frames.
- [ ] **ART-008** Monster generators per body plan (quadruped, biped, avian, insectoid, serpent, blob).
- [ ] **ART-009** Weapon sprites per family, drawn from parameters (length, head shape, material).
- [ ] **ART-010** Paper-doll layering: armor and clothing layers aligned to skeleton anchors per frame.
- [ ] **ART-011** Dye channels and cosmetic overrides.
- [ ] **ART-012** Aging variant overlays: grey, scars, missing eye, lean/bulky.
- [ ] **ART-013** Mutation recolors and glow layers.
- [ ] **ART-014** Combat VFX: hit sparks per material, element effects, ability effects.
- [ ] **ART-015** Weather VFX: rain, snow, fog, lightning, wind on foliage.
- [ ] **ART-016** Seasonal palette shifts and snow cover.
- [ ] **ART-017** Lighting: day/night tint, radial light sources.
- [ ] **ART-018** Entity ground shadows and flyer-only-shadow rendering.
- [ ] **ART-019** Buildings and settlement pieces (houses, walls, stalls, ruins).
- [ ] **ART-020** UI icon generator (items, traits, abilities, status effects).
- [ ] **ART-021** Determinism test in CI (byte-identical rebuilds).
- [ ] **ART-022** Contact-sheet preview output for PR review.
- [ ] ~~**ART-023** Harden `draw.py` validation and tests: validate `shade_sphere` light via `_finite`; test np.bool_ rejection, np.float64 in `ellipse_mask`, and the uint8-overflow guard (`int(v)` conversion) found by the ART-003 critic and Fable gate.~~ (dropped: Godot overhaul, OQ-031; `draw.py` is retired)
- [x] **ART-024** Art direction pass: research open-source game-art practice and design skills, write the art bible (`docs/art/`), and redraw actors, ground tiles and palettes to it (Lucid, 2026-10-12). — #30
- [ ] ~~**AUD-001** `[proto]` Python sfxr-style synth → audio files in the atlas build.~~ (dropped: Godot overhaul, OQ-031; the Python atlas build is retired)
- [ ] **AUD-002** SFX set: hits per material, footsteps per terrain, UI, creature calls, spells.
- [ ] **AUD-003** Runtime audio mixer with spatial panning and volume buses.
- [ ] **AUD-004** Biome ambience beds modulated by weather and time.
- [ ] **AUD-005** Procedural runtime music: biome layers, day/night variation, combat intensity layer.
