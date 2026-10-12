# M1 shared contracts (orchestrator-locked, 2026-10-12)

Every M1 spec must use these exactly. A spec may add detail, but must not contradict anything here. Design decisions: `docs/gdd/13-open-questions.md` OQ-018 to OQ-027. Research digest: `scratchpad/m1-digest.md`; its numbered items are cited below as A-n.

## Coordinates and constants (owner: WLD-001)
- y-down. World pixel (0,0) is the top-left of tile (0,0), and tile (0,0) is the top-left tile of chunk (0,0).
- `tile = Math.floor(px / TILE_PX)`, `chunk = Math.floor(tile / CHUNK_TILES)`. Floor division everywhere, so negative coordinates work without special cases.
- Local tile index inside a chunk: `ly * CHUNK_TILES + lx`.
- `sim/src/constants.ts` gains `TILE_PX = 16` and `CHUNK_TILES = 32`.

## Tile enum (owner: WLD-001; consumers: WLD-002, WLD-004, ART-004, WLD-003)
`sim/src/world/tile.ts` exports `Tile` as a `const` object plus a `TileValue` type, in the same style as `Kind` in `protocol.ts`. Values are u8:
`Grass 0, Dirt 1, Sand 2, Stone 3, Cliff 4, ShallowWater 5, DeepWater 6, VeryDeepWater 7`.
The "water depth layer" (WLD-004) is derived from these three water tiles: depth 1, 2 and 3; dry ground is 0. There is no second array.

## Chunk data (owner: WLD-001, extended by WLD-002)
- `sim/src/world/chunk-gen.ts` exports `generateChunk(seed, cx, cy): ChunkData`.
- `ChunkData = { cx, cy, tiles: Uint8Array(1024) }`. WLD-002 adds `biomes: Uint8Array(1024)` and a `Biome` const (`Grassland 0, Forest 1, River 2, Mountain 3, Ocean 4`) in `sim/src/world/biome.ts`.
- Pure functions of the inputs. Noise is built only from integer hashing (`Math.imul`, bit ops) and `+ - * /`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`. **Never** use `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp`, `Math.log` or `Math.random`: those can differ across JS engines.
- A golden test pins the output: a hash of `tiles` for a few `(seed, cx, cy)`, including negative coordinates.

## Character entity (owner: CHR-001)
- One `spawnCharacter(world, opts)` path, used for players and NPCs alike. The sim only knows a player because a host input channel writes that character's Intent; nothing else differs.
- Sim positions become **f64**. The snapshot stays `Float32Array` for x/y (absolute world px). A trap entry in CLAUDE.md records the precision bound (about ±2^20 px).
- `Facing`: `Down 0, Left 1, Right 2, Up 3`.
- `Action`: `Idle 0, Walk 1, Attack 2, Dodge 3, Hurt 4, Death 5`.
- `Species`: `Human 0, Elf 1, Dwarf 2, Orc 3, Foxfolk 4, Bearfolk 5, Rabbitfolk 6, Birdfolk 7, Lizardfolk 8`.
  Species keys used in frame names: `human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk`.
- New snapshot columns:
  - `facing: Uint8Array`
  - `action: Uint8Array`
  - `actionStart: Uint32Array` (tick)
  - `species: Uint8Array`
  - snapshot field `you: number`: the local player's entity id, or -1 if none (EntityIds are never negative).
- `Kind.Character` replaces `Kind.DebugMover`. CHR-001 removes the debug movers, their backdrop and the `debug/mover32` frame. The `debug/checker16` frame stays until WLD-003 renders ground.

## Actor frame names (owners: ART-005 and ART-006; consumer: TEC-022)
- Format: `actor/<species>/<anim>/<dir>/<i>`
  - `dir` is one of `down`, `left`, `right`, `up`.
  - `i` is a 0-based frame index.
- `anim` is one of `idle`, `walk`, `attack_blade`, `attack_unarmed`, `dodge`, `hurt`, `death`.
- ART-005 emits only `idle/<dir>/0`, the base pose. ART-006 adds every other frame, including the remaining idle frames.
- Starting frame counts (tunable): idle 2, walk 4, attack_blade 4, attack_unarmed 4, dodge 4, hurt 2, death 4.
- Right-facing frames are emitted by the pipeline, not flipped at runtime.
- Hand and other anchors stay in the Python pipeline (paper-doll layering happens at build time). Nothing is added to the atlas JSON schema.
- Everything stays in the single `core` atlas for M1. The atlas cap is 2048².

## Input (owner: CMB-001)
- New `HostToSim` message `{ type: "input"; ... }` carrying the move vector, the aim vector (a world-px offset from the character's feet), a held `sprint` flag, and monotonically increasing press counters for attack and dodge. The host posts it on change; the sim latches it at tick start.
- Its shape is designed to become the net input message later (TEC-010).

## Chunk transport (owner: WLD-003)
- The sim generates chunks and posts `SimToHost` `{ type: "chunk"; cx; cy; tiles; biomes }` with transferable buffers, plus `{ type: "unchunk"; cx; cy }`.
- The sim generates synchronously on demand for collision, so collision is never undefined. Streaming is prefetch only.
- Load within Chebyshev radius 2 of each player's chunk, unload beyond 3. Starting values, tunable.
