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
game/          the Godot 4 project (GDScript). src/ = game rules (world/, core/, later rules/: plain classes, no nodes) plus input/ and render/ (nodes that only read rules state), scenes/, tests/ (headless runner), assets/
game/assets/third_party/  third-party assets + CREDITS.md (checked by tools/check-credits.sh)
tools/godot/   setup, test, export and capture scripts (bash)
tools/check-credits.sh  the third-party credits check (CI)
art/blender/   (planned, G1; OQ-037) headless Blender Python scripts → glTF
contracts/     frozen cross-language fixtures (RNG and worldgen vectors) checked by the GDScript tests; see `contracts/README.md`
services/      (later) dedicated host and other services (TEC-018)
.claude/skills/ discipline skills copied from LucidPaths/claude.md-workflow (goal-loop, adversarial-review, …); docs/agents/ wins where they differ
docs/          gdd/, agents/, specs/, e2e/, PRINCIPLE_LATTICE.md
```

The TypeScript/Pixi/Python stack (M0–M1) was retired in OVR-010. Read it with `git show e6eaee3:sim/src/…` (or `client/`, `tools/art/`, `scripts/`).

## Commands

```
bash tools/godot/setup.sh             install Godot 4.7.2 (+ Blender 4.5 LTS, Mesa software rendering, Xvfb); idempotent. Flags: --no-blender, --templates
bash tools/godot/test.sh              import the project, run the GDScript tests (game/tests/test_*.gd); non-zero on a failing test, a script error or a timeout
bash tools/godot/export.sh            export the Windows and Linux builds into game/export/ (installs export templates if missing); non-zero on any export problem
bash tools/godot/capture.sh <out.png> render the main scene under Xvfb (software) and save a PNG; non-zero on a Godot failure or a missing PNG
bash tools/check-credits.sh           check game/assets/third_party/ against CREDITS.md (allow-listed licences only)
```

Cloud sessions install Godot through the SessionStart hook; `godot` is on the PATH afterwards.
CI (`.github/workflows/ci.yml`) runs the `godot` job on every push to main and every PR: credits check, GDScript tests, both exports, a smoke test of the Linux build. `.github/workflows/release.yml` publishes the exes on every push to main and on `v*` tags.

## Hard rules

- **No claims without evidence:** write "Ran X → Y" from the same response. "Should work" is forbidden.
- **Determinism:** seeded paths (worldgen, RNG) produce identical output for identical input, frozen by `contracts/*-vectors.json`. Never use `randf()`/`randi()`/`randomize()` or wall-clock time in seeded code.
- **Assets: ours or credited (OQ-038, D8).**
  - *Allowed:* anything we make by any method (including Lucid's ChatGPT images, AI 3D generators and Blender scripts); third-party assets under licences compatible with an MIT repo (CC0 or public domain, MIT, Apache-2.0, BSD, CC-BY with attribution, OFL for fonts); inspiration from anything. Share-alike (CC-BY-SA, GPL art) only if the file keeps and is marked with its licence.
  - *Not allowed:* no licence or an unknown one, personal-use-only, NonCommercial, NoDerivatives, and ripped or traced work from commercial games or artists.
  - *CREDITS:* every third-party file goes under `game/assets/third_party/` with a row in `game/assets/third_party/CREDITS.md` (path, source URL, licence, author, changes). `tools/check-credits.sh` runs in CI and fails on a missing row, a missing file or a licence outside the allow-list.
- **Rules/view boundary:** the view only reads rules state; it never mutates game state.
- **One rule set:** players and NPCs use the same systems. No player-only code paths in the rules.
- **The game rules don't touch nodes:** rules classes in `game/src/` never read the scene tree or rendering; views read rules state and never change it.
- **Tests guard real breakage only.** No ceremonial tests. Milestone E2E covers the rest.
- **Mention it, don't do it:** out-of-scope findings go in your report, not your diff.
- **Never commit to `main` directly**, except the orchestrator's GDD ticks and WORKING_STATE updates.
- **Three failed fixes → stop and escalate.**

## Cross-file contracts

One source of truth each. Add to this table when a new one appears.

| Contract | Source of truth | Consumers |
|---|---|---|
| Seeded RNG algorithm | `contracts/rng-vectors.json` (checked by `game/tests/test_rng.gd`); impl `game/src/core/rng.gd` | GDScript worldgen |
| World tiles and chunk layout (`Tile` ids, `TILE_PX`, `CHUNK_TILES`, y-down, floor division, local index `ly*CHUNK_TILES+lx`) | `game/src/world/tile.gd`, `biome.gd`, `world_constants.gd`; shared check `contracts/worldgen-vectors.json` (chunk digests) | worldgen, `game/src/world/chunk_store.gd`, `game/src/world/walkability.gd` |
| Worldgen noise (`create_fbm`; lattice = `derive_seed(octaveSeed, ix, iy)`; only `imul32`, `floor`, `abs`, `min`, `max` and `+ - * /`) | `game/src/world/noise.gd`; shared check `contracts/worldgen-vectors.json` (`noise`: float64 bit patterns) | `game/src/world/chunk_gen.gd` |
| Biome map (seeded fields, `sample_biome`/`classify_biome`, the per-tile `biomes` layer of `ChunkData`; ids in `biome.gd` under "World tiles and chunk layout") | `game/src/world/biome_map.gd`, `game/src/world/chunk_gen.gd`; shared check `contracts/worldgen-vectors.json` (chunk digests) | `game/src/world/chunk_store.gd`, `game/src/world/spawn.gd` |
| Tile walkability, speed factor and water depth (one `TILE_RULES` table); foot-box collision (GOD-006): half-open box, x then y with sliding, only newly entered tiles checked, speed from the tile under the box centre, same for every character and action | `game/src/world/walkability.gd` (`TILE_RULES`; the rules table only, collision is GOD-006) | `game/src/world/spawn.gd`; later GOD-006 movement, NPC pathing, WLD-017 swimming |
| Spawn point: nearest walkable Grassland to tile (0,0) by Chebyshev ring, ties (d², ty, tx), throws beyond `SPAWN_SEARCH_RADIUS` | `game/src/world/spawn.gd`; shared check `contracts/worldgen-vectors.json` (`spawn`) | `game/scenes/main.gd`; later respawn, TEC-011 joins |
| Release: exe names `overgrown-windows.exe` and `overgrown-linux.x86_64`, the rolling `latest` pre-release from `main`, and the `v*` tag = `"v"+GameVersion.VERSION` | Names: `tools/godot/export.sh` (`BUILDS`, which also passes each path to `--export-release`). Tag/version: `game/version.gd` (`GameVersion.VERSION`), checked by `.github/workflows/release.yml` | Copies that must change with the names: `game/export_presets.cfg` (`export_path`), `.github/workflows/ci.yml` (smoke test, upload-artifact), `.github/workflows/release.yml` (upload lists, release notes), README (root) |
| Units (Godot): 1 tile = 1 m (`TILE_M`); tile (tx, ty) covers x ∈ [tx, tx+1), z ∈ [ty, ty+1); tile y-down = Godot +z, +y up; `TILE_PX` only for `find_spawn` px → m | `game/src/world/world_constants.gd` | chunk store, terrain, mesher, `game/scenes/main.gd`; later GOD-006 rules |
| Chunk store / streaming (Godot): anchors in world m (x, z); load radius 3, unload beyond 4 (Chebyshev, chunks), order (d², cy, cx), LRU `RECENT_CHUNKS` 64, ≤ 4 WorkerThreadPool jobs collected in `step()` once per physics tick; `chunk_loaded`/`chunk_unloaded` on the main thread; `tile_at`/`biome_at`/`height_at`/`chunk` never fail and wait for an in-flight chunk; chunk arrays never change after load | `game/src/world/chunk_store.gd` (`OgChunkStore`) | `game/src/render/terrain_view.gd`, `game/scenes/main.gd`; later GOD-006 (`tile_at`, `height_at`) |
| Terrain heights: 33×33 corner grid per chunk, corner = mean of the 4 touching tiles' heights sampled at world coords; quad split along the smaller-difference diagonal (`split_tl_br`) shared by `height_at` and the mesh; water surface: sea level 0 next to ocean water, else bank mean − `RIVER_SURFACE_DROP_M` next to river water, else NaN | `game/src/world/terrain.gd` (`OgTerrain`) | `game/src/world/chunk_store.gd`, `game/src/render/terrain_mesher.gd`; later GOD-006 feet |
| Third-party asset credits: every file under `game/assets/third_party/` has one row (Path, Source URL, Licence, Author, Changes) in `CREDITS.md`; allow-listed licences, share-alike only with "share-alike kept" | `game/assets/third_party/CREDITS.md` (rows), `tools/check-credits.sh` (allow-list and checks) | `.github/workflows/ci.yml` (`godot` job), `docs/gdd/10-art-audio.md`; every task that adds a third-party file |

## Project traps

- **RNG inputs must be safe integers** (|v| ≤ 2^53−1). `game/src/core/rng.gd` rejects anything else, as the retired TS and Python versions did, so the output can't diverge from the vectors.
- **Cloud sessions (claude.ai/code):** `gh` has no valid token there and the git proxy refuses branch deletion. Use the GitHub connector tools for PRs, comments and merges; Lucid deletes branches in the GitHub UI. Locally, `gh` works normally.
- **Engine-dependent float math.** `sin/cos/pow/exp/log`, `**` and friends can differ between engines and platforms; only `+ - * /` (and `sqrt`) are exactly rounded. Seeded world code must avoid them. Nothing enforces this: it's on you.
- **Godot's JSON and `String.to_float` parsing isn't correctly rounded** (GOD-003 found a value one ulp off). Floats in shared fixtures travel as IEEE-754 hex bits (`contracts/worldgen-vectors.json` `noise.bits`), and tests compare `PackedByteArray.encode_double` bits, never decimals.
- **`/` between two ints is integer division in GDScript.** Use `float(a) / b` or `floori(a / float(b))` deliberately, never by accident.
- **int × int wraps at 64 bits in GDScript**, not 32. `imul32` in `game/src/core/rng.gd` splits into 16-bit halves; any new 32-bit hashing goes through it and is checked against the vectors.
- **`.uid` sidecar files are committed with their scripts.** Godot writes one next to every `.gd` (and some resources); commit them together or other scripts' references break.
- **`godot --headless` can't render.** Captures need xvfb (`tools/godot/capture.sh`), and software rendering runs at about 4 fps, so a capture proves how the game looks, not its fps. Real fps and feel come from Lucid's playtest.
- **The GDScript test runner is strict.** `tools/godot/test.sh` fails a test on any `SCRIPT ERROR` or `ERROR:` output, on a non-null return (including a stray `await`), and on a test file with zero tests.
- **Cloud sessions install Godot through the SessionStart hook.** If `godot` is missing, read `/tmp/godot-setup.log` (or run `bash tools/godot/setup.sh`).
- **WorkerThreadPool tasks run only pure static code** and write only their own job object: never a Node, a signal, the store or shared mutable state. Every `add_task` needs exactly one `wait_for_task_completion` on every path (collect, lookup, unload, exit); a second wait is an error. Low-priority tasks (`add_task(…, false)`) are capped by `low_priority_thread_ratio` (1 thread on 4 cores), so chunk jobs run at high priority.
- **GDScript doesn't scale across worker threads in debug/editor builds** (4 parallel tasks each ran ~4× slower). Judge threading throughput only on the release export (`tools/godot/export.sh`).
- **A typed `Array[int]` assigned from a ternary of array literals** fails at runtime ("Trying to assign an array of type Array"); on a worker thread it doesn't stop a capture, only `test.sh`'s log scan catches it.
- **Depth fog vs sky:** with `fog_aerial_perspective` > 0 the fully fogged colour no longer matches the sky and silhouettes show at the streaming edge. Keep it 0, set `fog_light_color` to the sky's horizon colour, `fog_sky_affect` 0, and the procedural sky's ground colours to the horizon colour.
