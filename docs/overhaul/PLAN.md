# The overhaul: overgrown on Godot 4

Status: **draft for Lucid's sign-off** (2026-10-19). When Lucid approves it, task OVR-009 records the decisions as OQ rows and rewrites the GDD sections they touch.

## Decisions so far (Lucid, 2026-10-13 to 2026-10-19)

| # | Decision | Notes |
|---|---|---|
| D1 | **Engine: Godot 4**, native desktop, Vulkan (Forward+). | Replaces the "same stack" part of OQ-029. The spike below proved it works in the cloud. |
| D2 | **Delivery: a standalone `overgrown.exe` from GitHub Releases.** Download, double-click, play. Linux builds too. | CI builds and publishes it. Lucid installs nothing else. |
| D3 | **All development happens in the cloud.** Lucid's machine only plays builds and gives feedback (feel, real fps, co-op). | No Godot or Blender on Lucid's side. |
| D4 | **Camera: a tilted action-RPG camera with vista moments.** It is low enough to see the horizon and sky during play, and pulls out to wide vistas at landmarks. | Replaces the strict top-down view. |
| D5 | **Art direction: Lucid's mood board** (`docs/art/moodboard/`): painted (oil and impasto) look, teal against orange and gold, cosmic skies, wind, small figures in huge worlds. | The images are Lucid's own and may also ship in-game (title, loading art), under D8. |
| D6 | **The wanderer** (faceless, poncho with orange geometric borders, gold scarf, wind-blown hair) is the north star for character design and for the game's identity. | Details are decided later. |
| D7 | **Characters are modelled, rigged and animated by agents through headless Blender Python scripts**, exported as glTF. Agents may start from CC0 or other permissively licensed bases (for example the Quaternius characters and animation library) or from AI-generated meshes, then rework them into the wanderer style. | Blender MCP is optional for Lucid locally. Its asset integrations may be used only for sources D8 allows. |
| D8 | **Asset rule, loosened (replaces OQ-030's strict wording).** Allowed: anything we make by any method, including Lucid's ChatGPT images and AI 3D generators; third-party assets under licences compatible with an MIT repo (CC0 or public domain, MIT, Apache-2.0, BSD, CC-BY with attribution, OFL for fonts); and inspiration from anything. Share-alike (CC-BY-SA, GPL art) is allowed only if the file keeps and is marked with its licence. Not allowed: no licence or an unknown one, personal-use-only, NonCommercial, NoDerivatives, and ripped or traced work from commercial games or artists. | Every third-party file gets an entry in `assets/CREDITS` (path, source URL, licence, author). CI fails if a file under `assets/third_party/` has no entry. |
| — | Kept: OQ-029 (a game for Lucid and a few friends; one machine hosts). OQ-030 is superseded by D8. | |

## What we keep, port and retire

| Item | What happens |
|---|---|
| GDD design | **Kept:** world, ecology, combat, characters, NPCs, items, and the open questions. |
| Process | **Kept:** pipeline docs, the 5 lattice principles, and spec → worker → critic → Fable gate → merge, with an E2E run per milestone. |
| Determinism rules and the cross-language test-vector idea | **Kept.** The RNG vectors become the oracle for the GDScript port. |
| Seeded RNG, noise, biome map, chunk generation, spawn search, walkability rules | **Ported** to GDScript. The golden digests must match the TypeScript versions exactly before the TypeScript is deleted. |
| `client/` (PixiJS), `tools/art/` (Python pixel pipeline), `sim/` (TypeScript), `scripts/` (browser perf tools) | **Retired** once the G0 ports are proven. They stay in git history. |
| Art labs (`art-lab` branch, PR #32) | Parked as reference. Their research and lessons feed the G1 art bible. |

## Architecture (Godot)

- **Language: GDScript.**
  - It is agent-friendly, uses text files and has the strongest skills coverage.
  - Hot paths such as worldgen can move to a C++ GDExtension later if profiling says so.
  - Integer hashing ports by masking to 32 bits (`Math.imul` → `(a * b) & 0xFFFFFFFF`, with sign handling), proven against the vectors.
- **One rule set:**
  - Game rules (movement, actions, combat, stats, AI) live in plain GDScript classes and resources, not in rendering code.
  - The same code drives players and NPCs.
  - Rendering nodes only read state.
- **Host-authoritative from day one:**
  - Solo play is a local host with one player. Co-op adds remote players to the same host through Godot's ENet multiplayer.
  - Networking is never bolted on later.
- **Infinite world:**
  - Seeded chunks (32×32 tiles, as today) are streamed around every player.
  - Terrain becomes a 3D heightfield mesh with biome materials. Props (trees, rocks) are seeded per chunk and instanced (`MultiMeshInstance3D`).
- **Look:**
  - Forward+ with a painterly post-process stack: brush and Kuwahara-style filtering, canvas grain, palette grading to the mood board, glow and volumetric fog.
  - Animated cosmic skies as a sky shader.
  - Wind shaders on foliage, cloth and hair.
- **Repo layout:**
  - `game/`: the Godot project.
  - `art/blender/`: character and prop build scripts. Their `.glb` outputs are built in CI or committed as authored assets.
  - `tools/`: setup, build and capture scripts, taken from the spike.
  - `docs/`: unchanged.

## Milestones

### G0: Foundation and the first exe
Goal: Lucid downloads `overgrown.exe`, opens it, and a placeholder wanderer walks, sprints and dodges across a seeded, streamed 3D world under the tilted camera. Keyboard, mouse and gamepad all work.
- **GOD-001** Godot project scaffold in `game/`, plus a cloud setup script and a SessionStart hook so every fresh container has Godot and Blender installed and cached. Includes a headless GDScript test runner in CI.
- **GOD-002** Release pipeline: CI exports Windows and Linux builds and publishes them to GitHub Releases on every milestone merge, with a rolling "latest" pre-release from main.
- **GOD-003** Seeded RNG in GDScript, checked against `contracts/rng-vectors.json`.
- **GOD-004** Worldgen port (noise, biomes, chunk generation, spawn search), with golden digests equal to the TypeScript output.
- **GOD-005** Chunk streaming plus 3D terrain (heightfield and biome materials), and the tilted ARPG camera with a vista zoom.
- **GOD-006** Character rules (move, sprint, dodge, attack, collision on walkability) as a shared rule set, plus input for keyboard, mouse and gamepad.
- **OVR-009** Record D1–D8 as OQ rows (D8 supersedes OQ-030), add the `assets/CREDITS` manifest and its CI check, rewrite the affected GDD sections (01-tech, 10-art-audio, 11-ui-ux, MILESTONES), update CLAUDE.md, and retire the TypeScript, Pixi and Python packages once GOD-003 and GOD-004 are proven.
- G0 E2E: a scripted playthrough in the cloud, plus **Lucid's playtest of the exe**.

### G1: Painted vertical slice
Goal: one biome and one vista that look like the mood board, with the wanderer in motion.
- An art bible built from the mood board, with full creative freedom (an Opus art lab, as before, now in Godot and Blender), free to start from D8-allowed CC0 bases and from Lucid's images.
- The painterly post stack, palette grading and cosmic sky shader.
- Wind on everything.
- The wanderer: Blender-built, rigged, with walk, run, dodge, attack and idle, and cloth and hair motion.
- Props for one biome (trees, rocks, grass) and one landmark vista.
- G1 E2E plus Lucid's playtest.

### G2: First fight
The old M2 content, replanned on Godot:
- monsters that spawn and age;
- stamina, i-frames, hit feel (flash, hitstop, knockback);
- weapons and mastery;
- stats, XP and levels;
- items and inventory;
- a HUD;
- the first sound effects.

### G3: Co-op
Lucid hosts from the game menu and a friend joins over the internet. The ENet host/join flow, reconnects, and a shared world save.

Then the rest of the GDD: NPCs, dungeons, ecology and so on.

Order: G0 comes first because it delivers the exe. G1 is deliberately small: the look is decided early, because changing the look after features exist is what cost us twice. Then features (G2 and G3).

## Spike results (2026-10-19, branch `spike-godot`, orchestrator summary)

| Check | Result |
|---|---|
| Blender headless (4.5.14 LTS) | **Works.** A script models a character with Skin modifier, Subdivision Surface and bmesh "brushes", rigs it (20 bones, auto weights), adds walk and idle actions and exports a `.glb` in **1.8 s**. Rebuilds are byte-identical once five non-determinism workarounds are applied. Cycles CPU preview: about 7 s per frame. |
| Godot headless (4.7.2) | **Works.** Import takes 4–8 s, and GDScript tests return real exit codes. |
| Godot rendering in the cloud | **Forward+ (Vulkan via lavapipe) and Compatibility both work.** Shadows, SSAO, fog, glow and sky all render, at about 4 fps with software rendering, which is enough for agents to see their work. The **Mobile** renderer looks wrong (too dark) in software, so it needs a check on real hardware. |
| Round trip | **One command** (`spike/tools/rebuild.sh`, 86 s) runs Blender → Godot import → test → screenshots. A colour change propagated end to end. |
| Multiplayer | **ENet works:** two Godot processes synced a moving node. |

Known gotchas carry over into G0:
- Blender determinism rules.
- `godot --headless` can't render, so captures need xvfb.
- A watchdog for capture runs.
- Shader caches.
- `--audio-driver Dummy`.
- The proxy blocks the GitHub API, so downloads use direct release URLs.

## Risks
- **Software rendering in the cloud is slow (about 4 fps).** Agents can judge how things look, but not how they feel or how fast they run. Lucid's playtests are the gate for feel and performance.
- **Unsigned exe:** Windows SmartScreen warns on first run ("Run anyway").
- **Painterly post-processing:** it has to stay readable in fights, so gameplay readability is a G1 acceptance criterion.
- **The GDScript port must match the TypeScript bit for bit.** The test vectors and golden digests make that provable.
