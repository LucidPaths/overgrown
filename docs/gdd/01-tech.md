# 01 — Tech & Multiplayer

## Goals and constraints

- **A desktop game for Lucid and a few friends** (typically 2, up to ~4), hosted on one machine. There is no phone, browser-link or viral-X target, so first-load size and slow networks are not metrics (OQ-029).
- **The stack stays web-tech:** the TypeScript sim in a Web Worker plus a web-tech client (Vite, WebGL), run as a desktop app. Which desktop shell (a local browser, Tauri or Electron) is a later task; until then the dev server or `vite preview` in a desktop browser is the way to play (OQ-029).
- **A fast start on the reference machine,** Lucid's AMD Strix Halo (see Performance budgets).
- **No backend services.** One machine hosts the world and friends join over LAN or the internet; no signaling service is needed (OQ-029).
- **Every asset is authored by us** (Lucid or overgrown's Claude agents) by any method, never downloaded or third-party. Seeded output stays deterministic (OQ-030).

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | One language for client, sim and the dedicated host |
| Rendering | web-tech renderer (PixiJS today; the renderer choice is open, see the art lab exploration) | Fast batched 2D sprites; a small fraction of a full engine's web export |
| Build | Vite | Fast dev loop, code splitting |
| Simulation | Plain TS, in a Web Worker | Keeps the render thread smooth; the worker is the "server" when hosting |
| Netcode | host + joiners over LAN/internet; transport decided in TEC-010 | One machine hosts the world (OQ-029) |
| Signaling | not required (OQ-029) | Friends join the host directly over LAN or the internet |
| Storage | IndexedDB (worlds, characters), export/import as files | Valheim-style local ownership |
| Assets | Python 3 pipeline (Pillow, NumPy) producing atlases + JSON | Deterministic seeded output; assets are authored by us (OQ-030) |
| Auth | local profile name (OQ-029) | Identity label only; no accounts. Sign in with X is dropped (OQ-029, supersedes OQ-004). |
| Dedicated host | The same sim code in Node.js (planned) | Always-on worlds on a server (OQ-003) |

## Architecture

```
client (main thread)            sim worker                    joiners
 ├─ input (kb/mouse/gamepad) ─▶ ├─ world state (chunks)  ◀──▶ network
 ├─ renderer (Pixi)       ◀──   ├─ entity systems (ECS)
 ├─ UI                          ├─ sim LOD scheduler
 └─ audio (WebAudio)            └─ save/load (IndexedDB)
```

- The simulation is an ECS-style data layout (typed arrays), so thousands of coarse entities stay cheap.
- The renderer only reads snapshots from the sim. It never mutates game state.
- **The sim never touches browser APIs** (DOM, Pixi, WebAudio, `window`). It has to run unchanged in a Web Worker *and* in Node.js for dedicated hosts. Storage and networking reach the sim through small adapter interfaces.

## Multiplayer model

- **Solo is just a world with one player.** The same code path runs either way.
- **Open to friends** makes the world joinable. One machine hosts it (Lucid's machine, a server, or the dedicated host from TEC-018), and friends join over LAN or the internet (VPN or direct). There is no share link and no signaling service; the transport is TEC-010's call (OQ-029).
- **Split-by-area authority** (Valheim-style zone ownership): each chunk region is simulated by one peer, normally the player nearest to it. Ownership transfers as players move. The world host owns persistence and anything nobody is near.
- **Trust model: Valheim-style.** Characters are local files and cheating is possible. We accept this and don't build anti-cheat. Worlds can kick and ban.
- **Player cap: 10 per world.**
- **The world only exists while someone hosts it.** When the host stops, the world closes; there's no peer-to-peer host migration (OQ-005). Always-on worlds run on a **dedicated host**: the same sim in Node.js on a server, which friends join the same way as any other host (OQ-029).

## Persistence

- **World save:** seed + diffs from generated state + sim state of visited regions, in IndexedDB. Exportable as a file. Chunks without lasting changes aren't stored; they're regenerated from the seed (WLD-022).
- **Character save:** local, exportable, tagged with the local profile name that created it (OQ-029). Valheim-style: it carries inventory between worlds.
- **Corpses live in the world save**, not the character save.

## Performance budgets (starting targets, to be measured)

- **Reference machine:** Lucid's AMD Strix Halo (Radeon 8060S iGPU, 128 GB unified memory). Target **60 fps at 1080p–1440p** with ~300 on-screen entities (OQ-029).
- A fast start matters, but there are **no download-size or slow-network budgets**: the old ≤ 3 s slow-4G first frame and ≤ 5 MB initial download are retired (OQ-029).
- Full simulation within ~2 screens of each player. Coarse simulation beyond that, ticked at ≤ 1 Hz per region.

## Tasks

- [x] **TEC-001** `[proto]` Vite + TS strict + PixiJS client boots a blank scene, with a deploy to static hosting. — #3
- [x] **TEC-002** `[proto]` Sim runs in a Web Worker; snapshot message protocol to the renderer. — #6
- [x] **TEC-003** `[proto]` Fixed-timestep sim loop (20 Hz); render interpolates between snapshots. — #8
- [x] **TEC-004** `[proto]` ECS-style entity storage on typed arrays. — #4
- [x] **TEC-005** `[proto]` Asset loader for pipeline atlases + JSON metadata. — #11
- [ ] **TEC-006** World save/load to IndexedDB (seed + diffs + sim state).
- [ ] **TEC-007** Character save/load, export/import as file.
- [ ] ~~**TEC-008** Signaling service (WebSocket, rooms by share code), with a Dockerfile.~~ (dropped: OQ-029)
- [ ] **TEC-009** Host/join session flow: a friend joins a host over LAN or the internet. No share-link flow, and the transport is TEC-010's call (OQ-029).
- [ ] **TEC-010** Input-replication netcode: clients send inputs, owners send state; snapshot interpolation for remote entities. Also picks the transport for LAN/internet joins (OQ-029).
- [ ] **TEC-011** Zone ownership: assign, transfer and hand off chunk regions between peers.
- [ ] ~~**TEC-012** Asset streaming: core atlas in the initial load, biome atlases loaded on demand. Target first frame ≤ 2 s on emulated slow 4G + 4× CPU (moved from TEC-021). (OQ-028)~~ (dropped: OQ-029)
- [ ] ~~**TEC-013** Optional Sign in with X (OAuth 2.0 PKCE) and character identity tagging; the game is fully playable without it.~~ (dropped: OQ-029)
- [ ] **TEC-014** Kick/ban list per world.
- [ ] **TEC-015** Performance HUD (fps, entity counts, sim tick cost) behind a debug flag.
- [ ] ~~**TEC-016** Load-time CI check: fail if the initial bundle exceeds budget.~~ (dropped: OQ-029)
- [ ] ~~**TEC-017** Open Graph/X card meta tags so shared links render a preview image (summary card, not a player card).~~ (dropped: OQ-029)
- [ ] **TEC-018** Dedicated host: run the sim worker code in Node.js with storage and network adapters, so a server can host an always-on world that friends join over LAN or the internet (OQ-029).
- [x] **TEC-019** `[proto]` CI guard: the sim package builds with no DOM/browser types available, so browser API use in the sim fails the build. — #1
- [x] **TEC-020** `[proto]` Cap the render device-pixel-ratio (e.g. ≤ 2) and measure fps on a real mid-range phone GPU; record the numbers (found in M0 E2E: software-GL fps fell to 15 at DPR 3). (OQ-023) — #27
- [x] **TEC-021** `[proto]` Cut the startup waterfall: start the sim worker in parallel with the atlas load (Pixi's chunk fan-out was measured off the critical path), and ship the atlas as lossless WebP; target first frame ≤ 3 s on emulated slow 4G + 4× CPU (found in M0 E2E: 2.65–2.79 s). (OQ-023, OQ-028) — #28
- [x] **TEC-022** `[proto]` Animated actor rendering: map each character's species, facing and action from the snapshot to atlas frames, replacing the one-frame-per-Kind lookup for characters (→ CHR-001, ART-006). (OQ-023) — #24
- [ ] **TEC-023** Desktop shell: choose and set up how overgrown runs as a desktop app (local browser, Tauri or Electron), with a one-command launch for host and joiners. (OQ-029)
