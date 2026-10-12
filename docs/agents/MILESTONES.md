# Milestones (M1 signed off by Lucid; M2+ still draft)

A milestone is a batch of GDD tasks that together make something you can play-test end to end. The E2E agent runs once per milestone ([E2E.md](E2E.md)). Only `[proto]` tasks are scheduled so far.

## M0 — Foundations

Nothing playable yet. This is the plumbing every later task stands on, so it's opus-heavy.

OVR-001 · OVR-002 · OVR-003 · TEC-001 · TEC-002 · TEC-003 · TEC-004 · TEC-005 · TEC-019 · ART-001 · ART-002 · ART-003

**E2E checklist**
- A clean clone builds client + asset pipeline with documented commands.
- The deployed page boots a Pixi scene, with no console errors.
- The same seed gives identical RNG sequences in TS and Python.
- A pipeline-built atlas loads in the client; rebuilding gives byte-identical output.
- The sim runs in a worker at 20 Hz and the renderer interpolates.
- The sim package builds without DOM types (it's ready for a Node dedicated host).

## M1 — Walk the world

WLD-001 · WLD-002 · WLD-003 · WLD-004 · ART-004 · ART-005 · ART-006 · CHR-001 · CMB-001 · CMB-002 · UIX-002 · TEC-020 · TEC-021 · TEC-022

Design locked by OQ-018 to OQ-027 (2026-10-12).

**E2E checklist**
- Create a world from a seed and walk with the keyboard, then with touch emulation.
- Chunks stream in and out; walking 10 chunks in any direction doesn't stall.
- Deep water and cliffs block movement, shallow water slows; biomes are visibly distinct.
- The same seed gives the same world after a reload.
- Load size and first-frame time are within budget.

## M2 — First fight

ECO-001 · ECO-002 · CHR-002 · CHR-004 · CHR-005 · CMB-003 · CMB-004 · CMB-005 · CMB-007 · CMB-008 · CMB-009 · ITM-001 · ITM-002 · UIX-001 · AUD-001

**E2E checklist**
- Find and fight monsters with a sword on desktop and touch.
- Stamina drains and regens; dodge gives i-frames; hits have flash, hitstop and knockback.
- Over many hits, the damage distribution shifts upward as mastery rises.
- Kills grant XP and level-ups; monster stats follow their age.
- Equip a different weapon from the inventory; attack sounds play.

## M3 — Prototype complete

NPC-001 · DNG-001 · DNG-002

**E2E checklist**
- NPCs exist on the shared character core and stand around their homes.
- Enter a dungeon, descend procedural floors and return to the overworld.
- A full session (spawn → fight → level → dungeon → back) has no errors.

## After M3

Lucid reviews the prototype, then the `[mvp]` tags get assigned and M4+ are planned.
