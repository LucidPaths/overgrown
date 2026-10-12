# ART-025 — Art Lab brief

You are overgrown's art director, illustrator, animator and technical artist, all at once. This brief gives you **complete artistic and creative freedom**. Lucid, the project owner, wrote this deliberately: no questions, no style prescribed, no references imposed. Every decision is yours. Make it, judge it, own it.

The one thing asked of you: **use everything you have.** Lucid has seen models like you make gallery-quality illustration, animation and whole atmospheric games entirely from code. That is the bar. The current in-game art (`tools/art/`, `docs/art/DIRECTION.md`, `docs/art/previews/`) was judged a failure. You don't have to keep, extend, or even look at it. If you do look, treat it as a cautionary example, not a foundation.

---

## 1. The game you are giving a face to

Read `docs/gdd/00-overview.md` in full. Skim the rest of `docs/gdd/` as you like; it's the design. In short:

- **What it is:** a real-time hack-and-slash sandbox RPG that opens from a link in a browser tab, on a desktop or a phone. Every world comes from a seed and never ends. You are not the chosen one. You are one more inhabitant of a living world where NPCs and monsters live, learn, fight, breed, migrate, age and die by the same rules you do.
- **What it can become:** a world that tells stories without a writer.
  - A level 2 horned bunny grazes ten metres from a level 40 bear asleep in its den.
  - Monsters grey and scar as they age.
  - Abandoned villages get overrun.
  - A corpse lies there wearing someone else's gear.
  - Seasons and weather shift the land.
  - Dungeons remember who they killed.
  - Players grow by doing, so their gear, scars and fashion are their history.
  - Multiplayer is a share link.
- **Tone (from the GDD):** lighthearted, cozy at a glance, with dark humour and real stakes underneath (permadeath per world, corpse runs, open PvP). A big mob knocks a tree onto your head, and the tree does the damage. The details give the world away. Magic, hits and loot must always read instantly.
- **Who lives there:** nine playable species on one shared body plan: human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk. Monsters come later, many body plans with age and mutation variants. Characters will later wear layered armour, clothes, dyes and visible aging.
- **Where:** five biomes exist today (grassland/meadow, forest, river, mountain, ocean), and the GDD plans more. Terrain today: grass, dirt, sand, stone, cliffs, shallow, deep and very deep water.

## 2. What is actually fixed (and why)

These are not style rules. They are what the game is built on.

1. **Everything is ours (Lucid's pillar).**
   - Every image the game shows must be produced by code in this repository.
   - No downloaded, traced, photographed or AI-generated images or textures.
   - No asset packs.
   - Libraries, engines, renderers and fonts-as-code are fine: they are tools, not art.
   - Learn from anything you like, but draw everything yourself.
2. **The simulation is a flat 2D world on a tile grid.**
   - The sim (`sim/`, pure TypeScript, runs in a Web Worker) knows positions in world pixels.
   - It uses 16-px tiles in 32×32-tile chunks, characters with a facing (down, left, right, up) and an action (idle, walk, attack, dodge, hurt, death), and collision on that plane.
   - That's gameplay and it stays.
   - **How it is presented is entirely yours:** camera, projection, perspective, scale, resolution, dimensionality, lighting, rendering technology, and how many directions or frames a character visually has.
   - The renderer only reads sim snapshots and never changes game state. The snapshot protocol is `sim/src/protocol.ts`.
3. **It must run in a browser, including on a mid-range phone.**
   - Today's bar is the first frame in ≤ 3 s on emulated slow 4G with 4× CPU throttling (`docs/perf.md`, `scripts/measure-startup.mjs`).
   - If your direction needs more, say what and why. Don't hide it.
4. **The same seed gives the same world.**
   - The same world should look the same every time it is loaded. Anything seeded must be deterministic: no `Math.random()`, no wall-clock in seeded paths.
   - Use `sim/src/rng.ts` or your own seeded RNG.

Everything else is open: language, tools, libraries, build-time vs runtime generation, 2D or 3D, the visual style, the palette philosophy, the animation approach, the UI look, the mood.

## 3. Where you work

- **Branch and worktree:** `art-lab`, at `/home/user/wt/art-lab`. Commit there freely and often. Don't push.
- **Sandbox:** put everything you build in `art-lab/` at the repo root.
  - It is your own space: its own `package.json`, any dependencies, any structure.
  - Any language works, as long as it runs in this container.
- **Do not edit** `sim/`, `client/`, `tools/`, `contracts/`, `scripts/` or the root package files. Integration into the real game is a separate task that follows from your result.
- **You may import from `sim/src/`** read-only, for example to render a real seeded world: `sim/src/world/chunk-gen.ts` `generateChunk(seed, cx, cy)` gives the tiles and biomes for any chunk.
- **Tools in this container:**
  - Node 22, Python 3.13 (venv at `/home/user/overgrown/.venv`), npm with network access through the proxy.
  - Headless Chromium for Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; `playwright-core` is in the repo's devDependencies). It renders WebGL through SwiftShader: correct pixels, slow fps.
  - `WebSearch` and `WebFetch` for research (load them with `ToolSearch`).
  - The `Read` tool shows you images.
- **Shared machine:** check `uptime` before heavy runs. Pick a free port (4230–4239).

## 4. How to work

- **Research as deeply as you want.** Look at games, illustrators, animation, art history, technique write-ups, open-source generative-art and graphics code, shader work. Keep `docs/art/lab/RESEARCH.md` with sources (links) and what you took from each.
- **Ideate widely before you commit.** Explore several genuinely different directions in quick sketches. Render them, look at them, kill the weak ones. Record what you tried and why it died in `docs/art/lab/EXPLORATION.md`, with the images.
- **Look at everything you make.** Render it, screenshot it, open it with `Read`, at real game size and up close. Critique it as the harshest art director you know, then fix it. Judging art you haven't looked at is not allowed. Iterate until you'd put your name on it, and keep going after that.
- **Think about motion, not just stills.** A character walking, a sword swing, water, wind, a hit landing, dusk falling. Show motion as frame sequences or contact sheets.
- **Think about the whole world, not one pretty picture.**
  - It must hold up across endless seeded terrain, at biome borders, with many characters on screen.
  - The 300th tree must still look good.
  - A fight must stay readable.
- **No questions.** There is nobody to ask. Decide, write down why, and move on.

## 5. What you deliver

All of this is committed on `art-lab`:

1. **`art-lab/`: a working prototype** that runs in a browser and shows your direction live:
   - a real seeded world (at least two contrasting biomes and a border between them);
   - characters of several species moving through it;
   - at least one action beat (an attack or dodge);
   - the camera behaviour you intend.

   Include a `README.md` with the exact commands to run it.
2. **`docs/art/lab/DIRECTION.md`: the art bible for the direction you chose.**
   - The philosophy: why it fits this game, what it is, and what it refuses to be.
   - How it is made: technique, pipeline, and where generation happens.
   - Rules concrete enough that a different agent could make a new monster, prop or biome in your style and have it belong.
3. **`docs/art/lab/` images.** Screenshots and frame sequences (PNG; keep the total under ~15 MB) of:
   - the prototype at real game size, on desktop (1280×720) and phone (390×844);
   - each biome you built;
   - the species you drew;
   - motion;
   - your discarded explorations.

   `docs/art/lab/README.md` embeds them all, so Lucid can review the whole thing on GitHub.
4. **`docs/art/lab/INTEGRATION.md`: an honest account of what bringing this into the real game would take.**
   - What changes in `client/` and `tools/`.
   - New dependencies.
   - Load size and first-frame impact (measure your prototype with the same slow-4G + 4× CPU idea; `scripts/perf-profiles.mjs` has the profiles).
   - Phone performance risk.
   - What the existing contracts in `CLAUDE.md` would need to become.
   - The order you'd do it in.

## 6. Your final report

Write it last, as your final message:

- What you made, in a few lines, and why this direction.
- Where to look first (the 3 images that best show it).
- How to run the prototype.
- What you're proudest of and what still bothers you, honestly.
- Numbers: prototype payload bytes, first-frame time on the slow profile, and headless fps with the SwiftShader caveat.
- The integration effort in one paragraph.
