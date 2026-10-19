# 01 — Tech & Multiplayer

## Goals and constraints

- **A desktop game for Lucid and a few friends** (typically 2, up to ~4), hosted on one machine. There is no phone or public-link target, so download size and slow networks are not metrics (OQ-029).
- **A Godot 4 game, shipped as an exe:** a native desktop build, downloaded from GitHub Releases (`overgrown-windows.exe`, plus a Linux build) and run by double-clicking it. CI builds and publishes it; nothing else is installed (OQ-031, OQ-032).
- **All development happens in the cloud.** Lucid's machine only plays builds and gives feedback on feel, real fps and co-op (OQ-033).
- **A fast start and 60 fps on the reference machine,** Lucid's AMD Strix Halo (see Performance budgets).
- **No signaling or other mandatory backend service.** One machine hosts the world and friends join over LAN or the internet (OQ-029).
- **Assets follow the D8 rule:** anything we make, plus third-party files under compatible licences, each listed in `game/assets/third_party/CREDITS.md` (OQ-038). Seeded output stays deterministic: the same seed gives the same world on every machine.

## Stack

The TypeScript sim, the Pixi client and the Python art pipeline (M0–M1) were retired in OVR-010; they stay in git history, and `CLAUDE.md` names the commit to read them from. Worldgen and RNG are checked against the shared fixtures in GDScript; walkability is a mirrored rules table (collision comes with GOD-006). See the contracts in `CLAUDE.md`.

| Layer | Choice | Why |
|-------|--------|-----|
| Engine | Godot 4.7, Forward+ (Vulkan), native desktop | Text-based project files, headless import and tests, and a first-class exporter for Windows and Linux (OQ-031) |
| Language | GDScript | Agent-friendly, the strongest skills coverage. Hot paths such as worldgen can move to a C++ GDExtension later if profiling says so |
| Game rules | Plain GDScript classes and resources in `game/src/` | One rule set for players and NPCs; rules never touch the scene tree or rendering |
| Rendering | 3D: a heightfield terrain mesh with biome materials, props instanced per chunk (`MultiMeshInstance3D`), a painterly post-process stack | The look is in `10-art-audio.md` (OQ-034, OQ-035) |
| Netcode | Host-authoritative, Godot's ENet multiplayer | Solo is a local host with one player; co-op adds remote players to the same host |
| Signaling | not required (OQ-029) | Friends join the host directly over LAN or the internet |
| Storage | Local files (worlds, characters), export/import as files; the format is decided in TEC-006 and TEC-007 | Valheim-style local ownership (OQ-029). IndexedDB went with the web client |
| Assets | Blender headless scripts → glTF, imported by Godot; third-party files under `game/assets/third_party/` | See `10-art-audio.md` (OQ-037, OQ-038) |
| Auth | local profile name (OQ-029) | Identity label only; no accounts. Sign in with X is dropped (OQ-029, supersedes OQ-004). |
| Dedicated host | The engine is re-decided in TEC-018 (a headless Godot run of the same rules is the obvious candidate); the old plan was the same sim in Node.js | Always-on worlds on a server (OQ-003) |
| Release | GitHub Releases: a rolling `latest` pre-release from `main`, `v*` tags for versions | CI exports both builds (OQ-032) |

## Architecture

```
game/ (Godot project)
 ├─ rules   (game/src/, plain GDScript)  ◀── host: local, or remote players over ENet
 │    world chunks · characters · actions · combat · AI
 ├─ views   (nodes: terrain, props, characters, camera, post stack) ── read rules state
 ├─ input   (keyboard / mouse / gamepad) ── becomes intents for the rules
 └─ UI, audio
```

- **The game rules don't touch nodes.** Rules classes never read the scene tree or rendering; views read rules state and never change it. Players and NPCs run through the same rules code.
- **Host-authoritative from day one.** Solo play is a local host with one player. Networking is never bolted on later.
- **Infinite world.** Seeded chunks of 32×32 tiles are streamed around every player, with **1 tile = 1 m**. Terrain is a 3D heightfield mesh with biome materials; props (trees, rocks) are seeded per chunk and instanced.
- **Look.** Forward+ with a painterly post stack (brush and Kuwahara-style filtering, canvas grain, palette grading, glow and volumetric fog), animated cosmic skies and wind shaders. Details in `10-art-audio.md`.
- **Determinism in GDScript.** Seeded code uses only the exactly rounded float operations and the 32-bit integer hashing proven against the shared fixtures. GDScript has no `Math.imul`, so integer hashing is split into 16-bit halves (see the traps in `CLAUDE.md`).
- The TS sim used an ECS-style typed-array layout (TEC-004). How the GDScript rules store entities is decided as the rules are ported (GOD-006 onwards); it is not decided yet.

## Multiplayer model (being ported)

The rules below were written for the TS sim and are engine-neutral design. They stay until each is re-decided in G3. The transport is ENet (OQ-031).

- **Solo is just a world with one player.** The same code path runs either way.
- **Open to friends** makes the world joinable. One machine hosts it (Lucid's machine, a server, or the dedicated host from TEC-018), and friends join over LAN or the internet (VPN or direct). There is no share link and no signaling service (OQ-029).
- **Split-by-area authority** (Valheim-style zone ownership): each chunk region is simulated by one peer, normally the player nearest to it. Ownership transfers as players move. The world host owns persistence and anything nobody is near. G0 to G3 are host-authoritative (the host simulates everything); zone ownership (TEC-011) is not yet re-decided for Godot.
- **Trust model: Valheim-style.** Characters are local files and cheating is possible. We accept this and don't build anti-cheat. Worlds can kick and ban.
- **Player cap: 10 per world.**
- **The world only exists while someone hosts it.** When the host stops, the world closes; there's no peer-to-peer host migration (OQ-005). Always-on worlds run on a **dedicated host**, which friends join the same way as any other host (OQ-029).

## Persistence (being ported)

- **World save:** seed + diffs from generated state + sim state of visited regions, as local files (the format is decided in TEC-006). Exportable as a file. Chunks without lasting changes aren't stored; they're regenerated from the seed (WLD-022).
- **Character save:** local, exportable, tagged with the local profile name that created it (OQ-029). Valheim-style: it carries inventory between worlds.
- **Corpses live in the world save**, not the character save.

## Performance budgets (starting targets, to be measured)

- **Reference machine:** Lucid's AMD Strix Halo (Radeon 8060S iGPU, 128 GB unified memory). Target **60 fps at 1080p–1440p** with ~300 on-screen entities (OQ-029).
- **Who measures:** cloud sessions render in software at about 4 fps, so captures prove how the game looks, not how fast it runs. **Lucid's playtest of the exe is the gate for feel and fps** at every milestone.
- The old browser budgets (≤ 3 s slow-4G first frame, ≤ 5 MB download, DPR caps) are gone (OQ-029, OQ-031).
- Full simulation within ~2 screens of each player. Coarse simulation beyond that, ticked at ≤ 1 Hz per region.

## Tasks

- [x] **TEC-001** `[proto]` Vite + TS strict + PixiJS client boots a blank scene, with a deploy to static hosting. — #3
- [x] **TEC-002** `[proto]` Sim runs in a Web Worker; snapshot message protocol to the renderer. — #6
- [x] **TEC-003** `[proto]` Fixed-timestep sim loop (20 Hz); render interpolates between snapshots. — #8
- [x] **TEC-004** `[proto]` ECS-style entity storage on typed arrays. — #4
- [x] **TEC-005** `[proto]` Asset loader for pipeline atlases + JSON metadata. — #11
- [ ] **TEC-006** World save/load as local files (seed + diffs + sim state); picks the file format (IndexedDB went with the web client, OQ-031).
- [ ] **TEC-007** Character save/load, export/import as file.
- [ ] ~~**TEC-008** Signaling service (WebSocket, rooms by share code), with a Dockerfile.~~ (dropped: OQ-029)
- [ ] **TEC-009** Host/join session flow: a friend joins a host over LAN or the internet. No share-link flow, and the transport is TEC-010's call (OQ-029).
- [ ] **TEC-010** Input-replication netcode: clients send inputs, owners send state; snapshot interpolation for remote entities. Also picks how LAN/internet joins connect (OQ-029); the transport is Godot's ENet (OQ-031).
- [ ] **TEC-011** Zone ownership: assign, transfer and hand off chunk regions between peers.
- [ ] ~~**TEC-012** Asset streaming: core atlas in the initial load, biome atlases loaded on demand. Target first frame ≤ 2 s on emulated slow 4G + 4× CPU (moved from TEC-021). (OQ-028)~~ (dropped: OQ-029)
- [ ] ~~**TEC-013** Optional Sign in with X (OAuth 2.0 PKCE) and character identity tagging; the game is fully playable without it.~~ (dropped: OQ-029)
- [ ] **TEC-014** Kick/ban list per world.
- [ ] **TEC-015** Performance HUD (fps, entity counts, sim tick cost) behind a debug flag.
- [ ] ~~**TEC-016** Load-time CI check: fail if the initial bundle exceeds budget.~~ (dropped: OQ-029)
- [ ] ~~**TEC-017** Open Graph/X card meta tags so shared links render a preview image (summary card, not a player card).~~ (dropped: OQ-029)
- [ ] **TEC-018** Dedicated host: run the game rules headless, with storage and network adapters (the engine is re-decided here: headless Godot is the obvious candidate, replacing the Node.js plan, OQ-031), so a server can host an always-on world that friends join over LAN or the internet (OQ-029).
- [x] **TEC-019** `[proto]` CI guard: the sim package builds with no DOM/browser types available, so browser API use in the sim fails the build. — #1
- [x] **TEC-020** `[proto]` Cap the render device-pixel-ratio (e.g. ≤ 2) and measure fps on a real mid-range phone GPU; record the numbers (found in M0 E2E: software-GL fps fell to 15 at DPR 3). (OQ-023) — #27
- [x] **TEC-021** `[proto]` Cut the startup waterfall: start the sim worker in parallel with the atlas load (Pixi's chunk fan-out was measured off the critical path), and ship the atlas as lossless WebP; target first frame ≤ 3 s on emulated slow 4G + 4× CPU (found in M0 E2E: 2.65–2.79 s). (OQ-023, OQ-028) — #28
- [x] **TEC-022** `[proto]` Animated actor rendering: map each character's species, facing and action from the snapshot to atlas frames, replacing the one-frame-per-Kind lookup for characters (→ CHR-001, ART-006). (OQ-023) — #24
- [ ] ~~**TEC-023** Desktop shell: choose and set up how overgrown runs as a desktop app (local browser, Tauri or Electron), with a one-command launch for host and joiners. (OQ-029)~~ (dropped: Godot overhaul, OQ-031; the exe from GOD-002 is the desktop app)
- [x] **GOD-001** Godot project scaffold in `game/`, plus a cloud setup script and a SessionStart hook so every fresh container has Godot and Blender installed and cached. Includes a headless GDScript test runner in CI. (OQ-031, OQ-033) — #36
- [x] **GOD-002** Release pipeline: CI exports Windows and Linux builds and publishes them to GitHub Releases on every milestone merge, with a rolling "latest" pre-release from main. (OQ-032) — #37
- [x] **GOD-003** Seeded RNG in GDScript, checked against `contracts/rng-vectors.json`. — #38
- [x] **GOD-004** Worldgen port (noise, biomes, chunk generation, spawn search), with golden digests equal to the TypeScript output. — #39
- [x] **GOD-005** Chunk streaming plus 3D terrain (heightfield and biome materials), and the tilted ARPG camera with a vista zoom. (OQ-034) — #41
- [x] **GOD-006** Character rules (move, sprint, dodge, attack, collision on walkability) as a shared rule set, plus input for keyboard, mouse and gamepad. — #43
- [ ] **GOD-007** G0: `--capture-tick 0` never captures. `main.gd` sets `_frozen` at scene start instead of at world ready, so `sim.step()` (and with it chunk streaming) never runs, world ready never comes, and the run ends at the 90 s watchdog with exit 2. Freeze at world ready, as the flag's help says ("freeze the rules after N ticks counted from world ready"). (found in G0 E2E: `docs/e2e/G0.md`)
- [ ] **GOD-008** G0 playtest round 1: hold the right mouse button (or Q/E, the D-pad) to orbit the camera with movement staying camera-relative, attack while moving (OQ-039), and a full-size dodge dash instead of the shrinking roll; folds in GOD-007. (`docs/specs/GOD-008.md`)
