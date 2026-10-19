# overgrown — instructions for every agent

An open-source, real-time sandbox hack-and-slash RPG for Lucid and a few friends (OQ-029). It is a **Godot 4 desktop game** (GDScript, in `game/`), shipped as an exe from GitHub Releases (OQ-031, OQ-032) and developed entirely in the cloud (OQ-033). Assets follow the D8 rule: we make them by any method, or take them under a compatible licence with a CREDITS entry (OQ-038). It's **not** an MMO, not a survival game, and not a roguelite. See `docs/gdd/00-overview.md`.

**Current milestone: G0** (`docs/agents/MILESTONES.md`). The overhaul decisions D1 to D8 are in `docs/overhaul/PLAN.md` and OQ-031 to OQ-038.

## Read first

| You are | Read |
|---|---|
| A new or post-compaction session | `WORKING_STATE.md` → `docs/agents/PIPELINE.md` → `docs/agents/ORCHESTRATOR.md` |
| A worker | `docs/agents/WORKER.md` + your spec in `docs/specs/<ID>.md` |
| The critic | `docs/agents/CRITIC.md` |
| The Fable gate | `docs/agents/FABLE_GATE.md` (and nothing from the conversation) |
| The E2E agent | `docs/agents/E2E.md` + `docs/agents/MILESTONES.md` |

## Sources of truth

- **Design:** `docs/gdd/`. Task IDs, checkboxes and workflow are in `docs/gdd/README.md`.
- **The Godot overhaul:** `docs/overhaul/PLAN.md` (the decision record; don't edit it).
- **Undecided things:** `docs/gdd/13-open-questions.md`. Follow the stated default; never guess.
- **Review standard:** `docs/PRINCIPLE_LATTICE.md` (5 principles: Modularity · Simplicity Wins · Errors Are Answers · Fix The Pattern · Secrets Stay Secret).

## Layout

```
game/          the Godot 4 project (GDScript). src/ = game rules (plain classes, no nodes), scenes/, tests/ (headless runner), assets/
game/assets/third_party/  third-party assets + CREDITS.md (checked by tools/check-credits.sh)
tools/godot/   setup, test, export and capture scripts (bash)
tools/check-credits.sh  the third-party credits check (CI)
art/blender/   (planned, G1; OQ-037) headless Blender Python scripts → glTF
contracts/     cross-language fixtures (RNG and worldgen vectors, …) shared by the GDScript and TS (and Python) tests
sim/           (retired in OVR-010; reference only) @overgrown/sim — pure TS simulation. Sees NO browser APIs (lib ES2022, types []).
client/        (retired in OVR-010; reference only) @overgrown/client — Vite + PixiJS app
tools/art/     (retired in OVR-010; reference only) Python pixel asset pipeline → client/public/generated/ (gitignored build output)
scripts/       (retired in OVR-010; reference only) dev tools run with node (check-page.mjs: headless page check)
services/      (later) dedicated host and other services (TEC-018)
.claude/skills/ discipline skills copied from LucidPaths/claude.md-workflow (goal-loop, adversarial-review, …); docs/agents/ wins where they differ
docs/          gdd/, agents/, specs/, e2e/, PRINCIPLE_LATTICE.md
```

No barrel files (TS): import modules by path (`@overgrown/sim/version`), never through an `index.ts`.

## Commands

```
bash tools/godot/setup.sh             install Godot 4.7.2 (+ Blender 4.5 LTS, Mesa software rendering, Xvfb); idempotent. Flags: --no-blender, --templates
bash tools/godot/test.sh              import the project, run the GDScript tests (game/tests/test_*.gd); non-zero on a failing test, a script error or a timeout
bash tools/godot/export.sh            export the Windows and Linux builds into game/export/ (installs export templates if missing); non-zero on any export problem
bash tools/godot/capture.sh <out.png> render the main scene under Xvfb (software) and save a PNG; non-zero on a Godot failure or a missing PNG
bash tools/check-credits.sh           check game/assets/third_party/ against CREDITS.md (allow-listed licences only)
```

Cloud sessions install Godot through the SessionStart hook; `godot` is on the PATH afterwards.

**Until OVR-010** the TypeScript and Python side still builds and tests. Activate a Python 3.13 venv with `tools/art/requirements-dev.txt` installed first. Convention: `.venv/` at the repo root (gitignored): `python3.13 -m venv .venv && .venv/bin/pip install -r tools/art/requirements-dev.txt`, then `source .venv/bin/activate`.

```
npm ci              install (lockfile committed)                                   (until OVR-010)
npm run check       typecheck sim + client, eslint, ruff check, ruff format --check (until OVR-010)
npm test            vitest (TS) + pytest (tools/art)                               (until OVR-010)
npm run build       art pipeline, then client production build → client/dist/      (until OVR-010)
npm run dev         Vite dev server                                                (until OVR-010)
node scripts/check-page.mjs <url> [shot.png] [waitMs]   headless page check of the old web client (until OVR-010)
```

CI (`.github/workflows/ci.yml`) runs two jobs on every push to main and every PR: `ci` (the TS and Python check, test and build, until OVR-010) and `godot` (credits check, GDScript tests, both exports, a smoke test of the Linux build). `.github/workflows/release.yml` publishes the exes on every push to main and on `v*` tags; `deploy.yml` (the old web deploy) goes in OVR-010.

## Hard rules

- **No claims without evidence:** write "Ran X → Y" from the same response. "Should work" is forbidden.
- **Determinism:** seeded paths (worldgen, RNG, asset pipeline) produce identical output for identical input, in TypeScript and in GDScript. Never use `Math.random()`, `randf()`/`randi()`/`randomize()` or wall-clock time in seeded code.
- **Assets: ours or credited (OQ-038, D8).**
  - *Allowed:* anything we make by any method (including Lucid's ChatGPT images, AI 3D generators and Blender scripts); third-party assets under licences compatible with an MIT repo (CC0 or public domain, MIT, Apache-2.0, BSD, CC-BY with attribution, OFL for fonts); inspiration from anything. Share-alike (CC-BY-SA, GPL art) only if the file keeps and is marked with its licence.
  - *Not allowed:* no licence or an unknown one, personal-use-only, NonCommercial, NoDerivatives, and ripped or traced work from commercial games or artists.
  - *CREDITS:* every third-party file goes under `game/assets/third_party/` with a row in `game/assets/third_party/CREDITS.md` (path, source URL, licence, author, changes). `tools/check-credits.sh` runs in CI and fails on a missing row, a missing file or a licence outside the allow-list.
- **Rules/view boundary:** the view only reads rules state; it never mutates game state. (For the retired TS code this is the sim/renderer snapshot boundary.)
- **One rule set:** players and NPCs use the same systems. No player-only code paths in the rules.
- **The game rules don't touch nodes:** rules classes in `game/src/` never read the scene tree or rendering; views read rules state and never change it.
- **Tests guard real breakage only.** No ceremonial tests. Milestone E2E covers the rest.
- **Mention it, don't do it:** out-of-scope findings go in your report, not your diff.
- **Never commit to `main` directly**, except the orchestrator's GDD ticks and WORKING_STATE updates.
- **Three failed fixes → stop and escalate.**

## Cross-file contracts

One source of truth each. Add to this table when a new one appears. Rows whose files are only under `sim/`, `client/`, `tools/art/` or `scripts/` are retired with those packages in OVR-010, which removes them.

| Contract | Source of truth | Consumers |
|---|---|---|
| Seeded RNG algorithm | `contracts/rng-vectors.json` (checked by both test suites); impls `sim/src/rng.ts` ↔ `tools/art/lib/rng.py` ↔ `game/src/core/rng.gd` (checked by `game/tests/test_rng.gd`) | sim, Python pipeline, GDScript worldgen |
| Entity IDs / component columns | `sim/src/ecs.ts` | every sim system, snapshot protocol |
| Atlas: JSON schema (TexturePacker JSON Hash, Pixi-native) + image `<atlas>.webp`, lossless WebP (OQ-028; name from `image_name()`) | `tools/art/lib/atlas.py::write_atlas` | `client/src/assets.ts` (Pixi `Spritesheet`), `scripts/measure-startup.mjs` (byte classes) |
| Kind → atlas frame name, per entity row of an interpolated Frame | `client/src/render/kind-frames.ts` (`Record<KindValue, (frame, i) => string>`, tsc-enforced; Character → `actorFrame`) | `client/src/render/snapshot-view.ts` |
| Palette file format | `tools/art/lib/palette.py` (validated on every build) | all generators via `ctx.palette()` |
| Host ↔ sim messages, Snapshot (incl. facing/action/actionStart/species; `you` = local player's EntityId or -1), Kind/Facing/Action/Species enums | `sim/src/protocol.ts` | `client/src/sim-worker.ts`, `client/src/main.ts`, renderer |
| Character components, `spawnCharacter`, Position = feet point, collider box | `sim/src/character.ts` | `sim/src/movement.ts`, `sim/src/sim.ts`; later CMB-001 (Intent), WLD-004 (Collider), NPC-001 |
| Tick rate | `sim/src/constants.ts` (`TICK_HZ`) | sim, worker adapter, render interpolation |
| Input semantics: held move/aim/sprint + u32 attack/dodge press counters (a changed counter = one press), posted on change, latched at tick start into the `you` character's Intent; the TEC-010 input shape | `sim/src/protocol.ts` (`InputMessage`), latch `sim/src/input.ts` | `client/src/input/host-input.ts` (the only counters and poster), `client/src/sim-worker.ts`, `sim/src/sim.ts`; later TEC-010 |
| Intent.buttons bits (held Sprint + one-tick press edges; stepActions consumes or drops presses) | `sim/src/character.ts` (`IntentButton`) | `sim/src/input.ts`, `sim/src/actions.ts`, `sim/src/movement.ts`; later NPC-001 |
| Camera: integer device-px scale (OQ-024), whole-art-px snapping, follows `you` | `client/src/render/camera.ts` | `client/src/main.ts`, `client/src/render/snapshot-view.ts`, `client/src/input/keyboard-mouse.ts` (aim), `client/src/render/chunk-layer.ts` (ground layer in `world`) |
| Render resolution: `dpr / ceil(dpr / MAX_RENDER_DPR)` (≤ 2, an integer divisor of the DPR, so the browser upscales by a whole number), recomputed when the DPR changes; `?maxdpr=1..4` overrides the cap | `client/src/render/resolution.ts` | `client/src/main.ts`; the camera reads the real backing size |
| Perf measuring: emulation profiles (phone 390×844 DPR 3 touch + 4× CPU, desktop, slow 4G), the first-frame mark `overgrown:first-frame` (first frame with a snapshot and ≥ 1 baked ground chunk) | `scripts/perf-profiles.mjs`; mark in `client/src/main.ts` | `scripts/measure-fps.mjs`, `scripts/measure-startup.mjs`, `docs/perf.md`; later TEC-021, the M1 E2E |
| Host input merge: every input adapter reports to one `HostInput` (shared u32 press counters; held fields from the source with the latest user activity = the device in use) | `client/src/input/host-input.ts` | `client/src/input/keyboard-mouse.ts`, `client/src/input/touch.ts`, `client/src/main.ts`; `client/src/ui/touch-overlay.ts` via `main.ts` (overlay visibility) |
| Touch control geometry (CSS client px, safe-area aware hit circles, left-half stick zone, stick mapping) | `client/src/input/touch-controls.ts` | `client/src/input/touch.ts`; `client/src/ui/touch-overlay.ts` |
| World tiles and chunk layout (`Tile` ids, `TILE_PX`, `CHUNK_TILES`, y-down, floor division, local index `ly*CHUNK_TILES+lx`) | `sim/src/world/tile.ts`, `sim/src/constants.ts` ↔ `game/src/world/tile.gd`, `biome.gd`, `world_constants.gd`; shared check `contracts/worldgen-vectors.json` (chunk digests) | worldgen (WLD-002/004), chunk messages (WLD-003), ART-004 tile frames |
| Worldgen noise (`createFbm`; lattice = `deriveSeed(octaveSeed, ix, iy)`; only `Math.imul/floor/abs/min/max`, lint-enforced in `sim/src/world/`) | `sim/src/world/noise.ts` ↔ `game/src/world/noise.gd`; shared check `contracts/worldgen-vectors.json` (`noise`: float64 bit patterns) | `sim/src/world/chunk-gen.ts`, `game/src/world/chunk_gen.gd`, WLD-002 fields |
| Biome map (seeded fields, `sampleBiome`/`classifyBiome`, the per-tile `biomes` layer of `ChunkData`; ids in `biome.ts` under "World tiles and chunk layout") | `sim/src/world/biome-map.ts`, `sim/src/world/chunk-gen.ts` ↔ `game/src/world/biome_map.gd`, `game/src/world/chunk_gen.gd`; shared check `contracts/worldgen-vectors.json` (chunk digests) | chunk messages (WLD-003), per-biome tile palettes (ART-004), spawn search (WLD-004) |
| Actor skeleton joints, l/r = character's own side, `SOLE_Y` | `tools/art/lib/skeleton.py` | `gen/actor.py` (ART-005/006), weapons (ART-009), paper doll (ART-010) |
| Species body table (dimensions, ramps) + head/tail templates and the template LEGEND (features) | `tools/art/lib/species.py`, `tools/art/gen/heads.py` | `gen/actor.py`; later ART-008, ART-010 |
| Actor frame names `actor/<species>/<anim>/<dir>/<i>`; anim ∈ `idle, walk, attack_blade, attack_unarmed, dodge, hurt, death` | `tools/art/gen/actor.py::frame_name` | `client/src/render/actor-frames.ts` |
| Ground tile frames `tile/<palette>/<terrain>/<mask>/<variant>`, mask bits TL1 TR2 BL4 BR8, terrain precedence, variant counts, Biome→palette, dual-grid cell = TL tile's biome | `contracts/tile-frames.json` (checked by both suites); impls `client/src/render/tile-frames.ts` ↔ `tools/art/gen/tiles.py` | WLD-003 chunk baking |
| Actor animation frame counts per anim (plus the species and dir key lists); display timing `ticksPerFrame`/`loop` lives only in TS | `contracts/actor-anims.json` (checked by both suites); impls `tools/art/lib/anims.py` (`ANIMS`) ↔ `client/src/render/actor-anims.ts` (`ACTOR_ANIMS`) | `client/src/render/actor-frames.ts` |
| Actor state → frame: species/facing key tables, Action → anim (M1: Attack → `attack_unarmed`), elapsed = `Frame.tick` (curr snapshot tick) − `actionStart`, loops wrap, one-shots hold the last frame | `client/src/render/actor-frames.ts` (`actorFrame`, `ACTION_ANIMS`) | `client/src/render/kind-frames.ts`, `client/src/main.ts` (load check via `actorFrameNames`); later ART-009/CMB-007 (attack anim per weapon family) |
| Actor poses: per-frame joint offsets on `base_skeleton` (only head, hands and feet move in x; `tail_root` never moves), `pose_skeleton`, main-hand anchor `hand_anchor` | `tools/art/lib/anims.py` | `gen/actor.py`, weapons (ART-009), paper doll (ART-010) |
| Chunk streaming: `chunk`/`unchunk` messages (fresh copies, buffers transferred; the sim keeps its own), `ChunkAnchor` tag = characters a host input channel drives, load radius 2 / unload beyond 3 (Chebyshev, chunks), at most `GEN_PER_TICK` generations per tick, `tileAt` generates on demand (never undefined) | `sim/src/world/chunk-store.ts`, `sim/src/protocol.ts` (`ChunkMessage`, `UnchunkMessage`, `chunkBuffers`) | `sim/src/sim.ts`, `client/src/sim-worker.ts`, `client/src/main.ts`, `client/src/render/chunk-layer.ts`; later WLD-004 (`tileAt`), TEC-011 (anchors) |
| Ground rendering: one 512×512 RenderTexture per held chunk at world px (cx*512+8, cy*512+8) (dual grid); missing east/south/south-east corners use the chunk's own clamped edge tile until that neighbour arrives, then the chunk is re-baked | `client/src/render/chunk-layer.ts` | `client/src/main.ts`; later props, lighting |
| Tile walkability, speed factor and water depth (one `Record<TileValue, TileRule>`); foot-box collision: half-open box, x then y with sliding, only newly entered tiles checked, speed from the tile under the box centre, same for every character and action | `sim/src/world/walkability.ts` (`TILE_RULES`), `sim/src/world/collision.ts` ↔ `game/src/world/walkability.gd` (`TILE_RULES`; the rules table only, collision is GOD-006) | `sim/src/movement.ts`, `sim/src/world/spawn.ts`; later NPC pathing, WLD-017 swimming |
| Spawn point: nearest walkable Grassland to tile (0,0) by Chebyshev ring, ties (d², ty, tx), throws beyond `SPAWN_SEARCH_RADIUS` | `sim/src/world/spawn.ts` ↔ `game/src/world/spawn.gd`; shared check `contracts/worldgen-vectors.json` (`spawn`) | `sim/src/sim.ts`; later respawn, TEC-011 joins |
| Release: exe names `overgrown-windows.exe` and `overgrown-linux.x86_64`, the rolling `latest` pre-release from `main`, and the `v*` tag = `"v"+GameVersion.VERSION` | Names: `tools/godot/export.sh` (`BUILDS`, which also passes each path to `--export-release`). Tag/version: `game/version.gd` (`GameVersion.VERSION`), checked by `.github/workflows/release.yml` | Copies that must change with the names: `game/export_presets.cfg` (`export_path`), `.github/workflows/ci.yml` (smoke test, upload-artifact), `.github/workflows/release.yml` (upload lists, release notes), README (root) |
| Third-party asset credits: every file under `game/assets/third_party/` has one row (Path, Source URL, Licence, Author, Changes) in `CREDITS.md`; allow-listed licences, share-alike only with "share-alike kept" | `game/assets/third_party/CREDITS.md` (rows), `tools/check-credits.sh` (allow-list and checks) | `.github/workflows/ci.yml` (`godot` job), `docs/gdd/10-art-audio.md`; every task that adds a third-party file |

## Project traps

Add each one here as it's discovered. Traps marked "(TS, until OVR-010)" or "(Python, until OVR-010)" are about the retired packages.

- *(TS, until OVR-010)* **TypeScript is pinned to 6.x** because typescript-eslint doesn't support TS 7 yet (Oct 2026). Don't bump TS alone; bump both together.
- *(TS, until OVR-010)* **EntityId generations wrap at 4096.** After 4096 destroy/create cycles of one slot, an old ID becomes valid again. Never store EntityIds long-term (saves, network, quest targets) without a separate stable identity.
- **RNG inputs must be safe integers** (|v| ≤ 2^53−1). Both languages reject anything else, so they can't diverge.
- *(TS, until OVR-010)* **`npm run dev` builds the art first.** Pass Vite args after `--` (`npm run dev -- --port 4183`).
- *(TS, until OVR-010)* **Chunk buffers are transferred to the main thread.** Never post an array the sim still uses: `chunk` messages carry `slice()` copies. A posted cache array is detached in the sim and reads as length 0.
- *(TS, until OVR-010)* **Snapshot x/y are f32 absolute world px** (sim positions are f64). Resolution is 1/8 px at ±2^20 px (~2048 chunks) and 2 px at ±2^24. Make snapshot coordinates relative to an origin before anything lets players go past ~2^20 px.
- **Cloud sessions (claude.ai/code):** `gh` has no valid token there and the git proxy refuses branch deletion. Use the GitHub connector tools for PRs, comments and merges; Lucid deletes branches in the GitHub UI. Locally, `gh` works normally.
- **Engine-dependent float math.** `Math.sin/cos/pow/exp/log`, `**` and friends can differ between JS engines; only `+ - * /` (and `sqrt`) are exactly rounded. Seeded sim code must avoid them. ESLint enforces this in `sim/src/world/`; elsewhere it's on you.
- *(TS, until OVR-010)* **Sprites snap to whole art pixels.** A frame's anchor × size must be a whole number (e.g. even sizes with anchor 0.5), or it is drawn half an art pixel off.
- *(TS, until OVR-010)* **Render resolution is not devicePixelRatio.** It is the DPR divided by a whole number (`renderResolution`), and it changes when the DPR does. Size and position from `app.canvas.width/height` and `app.renderer.resolution`, never from `window.devicePixelRatio`.
- *(TS, until OVR-010)* **Headless fps is software-rendered** (SwiftShader). It compares fill costs; it is not a phone fps. Real-phone numbers come from the manual check in `docs/perf.md`.
- *(TS, until OVR-010)* **Collision only checks tiles a box newly enters.** A character placed overlapping a blocked tile can walk out but is never pushed out. Anything that places or teleports a character must put its foot box on walkable ground (`findSpawn` does).
- *(Python, until OVR-010)* **Hand-authored head and tail templates use shade letters, not "base" letters.** In `tools/art/gen/heads.py` `A`/`a` is the *darkest* shade of the accent/hair ramp and `C`/`c` the base (digits `1`-`5` for the body ramp). Index 0 of an actor ramp is the outline colour and is added by the outline pass and is never written in a template, except through the legend letter `k` (the body line colour, used inside a shape). A template pixel off the cell raises; rows hanging below the sole line are cut there.
- *(Python, until OVR-010)* **A feature unique to one tile variant repeats on a lattice.** Every instance of a tile frame is identical, so a flower that exists only in variant 5 shows up at the same offset in every tile that draws variant 5. Keep such features rare, or put them in several variants.
- *(TS, until OVR-010)* **A touch tap also fires compatibility `mousedown`/`mousemove`**, but never a `pointerType: "mouse"` pointer event. Detect mouse use only through Pointer Events filtered by `pointerType`; a `mouse*` listener sees every tap as a mouse.
- *(TS, until OVR-010)* **Sim messages can arrive before the renderer exists.** The worker starts first; `main.ts` queues `chunk`/`unchunk` until the ChunkLayer exists, then replays them in order. A new message kind the renderer needs must be queued the same way: chunks are sent once, so a dropped one is a hole in the ground until it unloads.
- *(Python, until OVR-010)* **Atlas bytes depend on Pillow's bundled libwebp.** Rebuilds are byte-identical with the pinned Pillow (12.3.0, libwebp 1.6.0). Bumping Pillow may change `core.webp` bytes once (pixels stay identical: lossless); re-run the byte-identity test after a bump. A stale `core.png` from an older build may sit in `client/public/generated/` and get copied to `dist`; nothing requests it, so delete it.
- **Godot's JSON and `String.to_float` parsing isn't correctly rounded** (GOD-003 found a value one ulp off). Floats in shared fixtures travel as IEEE-754 hex bits (`contracts/worldgen-vectors.json` `noise.bits`), and tests compare `PackedByteArray.encode_double` bits, never decimals.
- **`/` between two ints is integer division in GDScript.** Use `float(a) / b` or `floori(a / float(b))` deliberately, never by accident.
- **int × int wraps at 64 bits in GDScript**, not 32. `imul32` in `game/src/core/rng.gd` splits into 16-bit halves; any new 32-bit hashing goes through it and is checked against the vectors.
- **`.uid` sidecar files are committed with their scripts.** Godot writes one next to every `.gd` (and some resources); commit them together or other scripts' references break.
- **`godot --headless` can't render.** Captures need xvfb (`tools/godot/capture.sh`), and software rendering runs at about 4 fps, so a capture proves how the game looks, not its fps. Real fps and feel come from Lucid's playtest.
- **The GDScript test runner is strict.** `tools/godot/test.sh` fails a test on any `SCRIPT ERROR` or `ERROR:` output, on a non-null return (including a stray `await`), and on a test file with zero tests.
- **Cloud sessions install Godot through the SessionStart hook.** If `godot` is missing, read `/tmp/godot-setup.log` (or run `bash tools/godot/setup.sh`).
