# Milestones (G0 is the current milestone)

A milestone is a batch of GDD tasks that together make something you can play-test end to end. The E2E agent runs once per milestone ([E2E.md](E2E.md)). From G0 on, **Lucid's playtest of the exe** is part of every milestone's E2E, because the cloud renders in software (about 4 fps): agents can judge how the game looks, but only Lucid can judge how it feels and how fast it runs. The decisions behind G0 to G3 are in `docs/overhaul/PLAN.md` and OQ-031 to OQ-038.

## G0 — Foundation and the first exe (current)

Goal: Lucid downloads `overgrown-windows.exe`, opens it, and a placeholder wanderer walks, sprints and dodges across a seeded, streamed 3D world under the tilted camera. Keyboard, mouse and gamepad all work.

GOD-001 · GOD-002 · GOD-003 · GOD-004 · GOD-005 · GOD-006 · OVR-009 · OVR-010

**E2E checklist**
- A clean clone runs `tools/godot/test.sh` and `tools/godot/export.sh` with the documented commands, and both pass.
- The latest release has both builds (`overgrown-windows.exe` and `overgrown-linux.x86_64`).
- A capture (`tools/godot/capture.sh`) shows streamed terrain under the tilted camera.
- A placeholder character walks, sprints, dodges and attacks with keyboard, mouse and gamepad.
- Cliffs and deep water block, and shallow water slows.
- The same seed gives the same world (the shared worldgen and RNG fixtures pass in GDScript; the same seed gives the same capture).
- **Lucid's playtest of the exe** (the Windows build from the release). This is the gate for feel and fps.

## G1 — Painted vertical slice

Goal: one biome and one vista that look like the mood board, with the wanderer in motion. Tasks are specced when G0 is done; the plan's scope is:
- An art bible built from the mood board, with full creative freedom (an art lab in Godot and Blender), free to start from D8-allowed CC0 bases and from Lucid's images. Replaces the pixel art bible.
- The painterly post stack, palette grading and the cosmic sky shader.
- Wind on everything.
- The wanderer: Blender-built, rigged, with walk, run, dodge, attack and idle, and cloth and hair motion.
- Props for one biome (trees, rocks, grass) and one landmark vista.

**E2E checklist**
- Captures of the biome and the vista, set beside the mood board.
- The wanderer plays walk, run, dodge, attack and idle, with moving cloth and hair, in a capture or clip.
- Wind moves foliage, cloth and hair.
- Gameplay stays readable in a fight with the post stack on (a G1 acceptance criterion).
- Every third-party file has a CREDITS row (`tools/check-credits.sh` passes).
- **Lucid's playtest of the exe.**

## G2 — First fight

The old M2 content, replanned on Godot.

ECO-001 · ECO-002 · CHR-002 · CHR-004 · CHR-005 · CMB-003 · CMB-004 · CMB-005 · CMB-007 · CMB-008 · CMB-009 · ITM-001 · ITM-002 · UIX-001 · the first sound effects (a subset of AUD-002)

**E2E checklist**
- Find and fight monsters with a sword; monsters spawn and age.
- Stamina drains and regens; dodge gives i-frames; hits have flash, hitstop and knockback.
- Over many hits, the damage distribution shifts upward as mastery rises.
- Kills grant XP and level-ups; monster stats follow their age.
- Equip a different weapon from the inventory; the HUD shows HP, stamina and mana; attack sounds play.
- **Lucid's playtest of the exe.**

## G3 — Co-op

Lucid hosts from the game menu and a friend joins over the internet: the ENet host/join flow, reconnects, and a shared world save. GDD tasks: TEC-006 · TEC-007 · TEC-009 · TEC-010 · UIX-008. The final list is set when G3 is planned.

**E2E checklist**
- Host a world from the game menu; a second client joins it over the network (two processes in the cloud).
- A joined player and the host see each other move, and the world is the same for both.
- A dropped client reconnects.
- The world save is shared: save, restart the host, and the world and characters are back.
- **Lucid's playtest with a friend.**

After G3 comes the rest of the GDD (NPCs, dungeons, ecology and so on), planned when G3 is done.

## Before the overhaul

M0 and M1 were built and signed off on the TypeScript, Pixi and Python stack. They stay here as history. Their checklists describe that stack and are not run again; the code is deleted by OVR-010.

### M0 — Foundations

Nothing playable yet. This is the plumbing every later task stands on, so it's opus-heavy.

OVR-001 · OVR-002 · OVR-003 · TEC-001 · TEC-002 · TEC-003 · TEC-004 · TEC-005 · TEC-019 · ART-001 · ART-002 · ART-003

**E2E checklist**
- A clean clone builds client + asset pipeline with documented commands.
- The deployed page boots a Pixi scene, with no console errors.
- The same seed gives identical RNG sequences in TS and Python.
- A pipeline-built atlas loads in the client; rebuilding gives byte-identical output.
- The sim runs in a worker at 20 Hz and the renderer interpolates.
- The sim package builds without DOM types (it's ready for a Node dedicated host).

### M1 — Walk the world

WLD-001 · WLD-002 · WLD-003 · WLD-004 · ART-004 · ART-005 · ART-006 · CHR-001 · CMB-001 · CMB-002 · UIX-002 · TEC-020 · TEC-021 · TEC-022

Design locked by OQ-018 to OQ-028 (2026-10-12); TEC-020, TEC-021 and TEC-022 joined M1 per OQ-023.

**E2E checklist**
- Create a world from a seed and walk with the keyboard, then with touch emulation.
- Chunks stream in and out; walking 10 chunks in any direction doesn't stall.
- Deep water and cliffs block movement, shallow water slows; biomes are visibly distinct.
- The same seed gives the same world after a reload.
- Load size and first-frame time are within budget (first frame ≤ 3 s on emulated slow 4G + 4× CPU, OQ-028).

## Parked (pre-overhaul)

The draft M2 (First fight) is replanned as G2 above. The draft M3 ("Prototype complete": NPC-001 · DNG-001 · DNG-002, with an E2E of NPCs standing around their homes and a full session spawn → fight → level → dungeon → back) does not match the plan and is parked; those tasks come back when G3 is done. Lucid then reviews, the `[mvp]` tags get assigned, and later milestones are planned.
