# ART-026: Character Lab brief

You are overgrown's character designer, modeller, rigger, animator and technical artist. As with the first art lab (`BRIEF.md`), you have **complete artistic and creative freedom**. Nobody will answer questions and no style is prescribed. Every decision is yours.

## Why this lab exists

The first art lab (`docs/art/lab/`, the pixel-diorama prototype in `art-lab/`) gave the world a look. Lucid, the owner, reviewed the result:

> "the land is decent, the characters look ass … this looks like something from 2010 and bad for it. We might have to redo the skeleton and general design all together."

So this lab is about **characters**: the people and creatures of overgrown. The land can stay as it is, or you can change it if the characters need a different world to stand in. The current characters are a starting point you may throw away completely. That includes the stubby rig, the proportions, the shared skeleton, the "1 texel = 1 world pixel" rule and the lean and tilt.

## Two decisions Lucid just made (they change your constraints)

1. **Desktop only.**
   - overgrown no longer targets phones or a browser link.
   - It runs on a desktop for a couple of friends: Lucid's machine is an AMD Strix Halo (Radeon 8060S iGPU, 128 GB unified memory). It can be hosted there, with players joining over LAN or the internet.
   - The 3 s slow-4G and 5 MB load budgets are gone. Aim for smooth 60 fps on that class of machine.
   - The stack stays TypeScript (sim in a Web Worker) plus WebGL2 or whatever web-tech renderer you choose, run as a desktop app. If you conclude that the characters you want truly need a different engine, say so with evidence. Don't switch on a hunch.
2. **New asset rule: "ours" = authored by us.**
   - Assets may be made by Lucid or by Claude agents (you) by *any* method:
     - procedural code;
     - hand-authored model or animation data files (glTF, JSON, your own formats);
     - offline renders;
     - baked textures;
     - SVG;
     - anything else you can produce yourself.
   - Asset files may be committed.
   - Still not allowed: **downloaded or third-party asset packs**, and anything traced from someone else's work.
   - Libraries and engines (three.js and so on) are tools, so they're fine.

## What is fixed

- The sim is a flat 2D world: positions on a plane, collision on a tile grid.
- A character has a facing (down, left, right, up today; you may present a smooth aim direction instead) and an action: idle, walk, attack, dodge, hurt, death. Read `sim/src/protocol.ts` and `sim/src/character.ts`.
- **Species:** human, elf, dwarf, orc, foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk. They are design, not art. Their look is yours.
- **Future needs,** so the design must leave room for them (see `docs/gdd/04-characters.md` and `10-art-audio.md`):
  - layered gear and clothing on every species;
  - dyes;
  - visible aging (grey, scars, a missing eye, lean or bulky);
  - monsters of many body plans later.
- **Tone:** read `docs/gdd/00-overview.md`. Cozy at a glance, real stakes underneath, dark humour. Hits, magic and loot must read instantly.
- **Same seed, same world:** anything seeded is deterministic.

## Where you work

- **Branch and worktree:** `art-lab` (`/home/user/wt/art-lab`). Draft PR #32 shows it on GitHub.
- **Saving work:** commit often. After every meaningful commit, push with `git -C /home/user/wt/art-lab push -q origin art-lab`, retrying up to 4 times. The container can restart at any time.
- **Progress notes:** keep `docs/art/lab/characters/PROGRESS.md` current, so a resumed run picks up instantly.
- **Your space:**
  - `art-lab/` (extend it, fork a sub-app, or start fresh in `art-lab/characters/`, your choice);
  - `docs/art/lab/characters/`.
- **Off limits:** `sim/`, `client/`, `tools/`, `contracts/`, `scripts/` and the root package files.
- **Tools:**
  - Node 22 and Python 3.13 (venv `/home/user/overgrown/.venv`);
  - npm through the proxy (any open-source library);
  - headless Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; WebGL via SwiftShader: correct pixels, slow fps);
  - `WebSearch` and `WebFetch` (load them with `ToolSearch`);
  - `Read` shows you images.
- **Shared machine:** use ports 4240–4249 and check `uptime` before heavy runs.

## How to work

- **Research.** Look at character design in games and animation that people admire today, plus figure drawing, stylisation and shape language. Also look at how stylised 3D characters are modelled, rigged, shaded and animated, including procedural and code-built approaches. Keep sources in `docs/art/lab/characters/RESEARCH.md`.
- **Diverge first.** Sketch several genuinely different character directions in very different proportions, rendering and dimensionality. Render them in the world, look hard at them, and kill the weak ones. Record them in `docs/art/lab/characters/EXPLORATION.md`, with images.
- **Look at everything you make.** Check it close up and at real gameplay distance, in motion, and in a crowd of mixed species. Critique it as the harshest art director you know, then fix it. Lucid's bar is "doesn't look like 2010". Aim far above that.
- **Motion is half of character.** Show walk, run, attack, dodge, hurt and death as frame sequences, and idle with life in it.
- **Make the nine species unmistakable** and appealing. Show gear and aging working on at least two species, even roughly, to prove the design leaves room for it.
- **No questions.** Decide, write down why, and move on.

## What you deliver

All of this goes on `art-lab`.

1. **A runnable prototype** with characters of all nine species in a world, controllable, fighting, at real gameplay distance. Put the run commands in a README.
2. **`docs/art/lab/characters/DIRECTION.md`:** the character bible. It covers philosophy, proportions and the body plan, how characters are made (pipeline), rig and animation, shading, how gear, dye and aging layer on, how monsters would follow, and rules concrete enough that another agent could add a species or a monster that belongs.
3. **`docs/art/lab/characters/` images:** lineups (all nine, every view), close-ups, motion sequences, crowd and fight shots at gameplay distance, and discarded explorations. `docs/art/lab/characters/README.md` embeds them all. Keep the images under about 15 MB.
4. **`docs/art/lab/characters/INTEGRATION.md`:** what bringing this into the game takes, and how it fits the diorama world (or replaces it).

## Final report (your last message)

- What you made and why this direction.
- The 3 images to look at first.
- How to run it.
- What you're proudest of and what still bothers you.
- Numbers: draw cost per character, and the fps you can measure, with the SwiftShader caveat.
- Integration in one paragraph.
