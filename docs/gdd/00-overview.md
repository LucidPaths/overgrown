# 00 — Overview

## Pitch

A top-down, real-time hack-and-slash sandbox RPG in a saturated, cozy pixel world that you play on a desktop with a few friends, hosted on one machine. Worlds are generated from a seed and never end. You are not the chosen one. You are one more inhabitant of a living world, where NPCs and monsters live, learn, fight, breed, migrate and die by the same rules you do.

It looks lovely, but it isn't safe. A level 2 horned bunny grazes ten meters from a level 40 bear asleep in its den. Leave an area alone long enough and the monsters there grow older, stronger and more numerous until even the villages give up and leave.

## Pillars

1. **You are just another one.** Players and NPCs share one rule set: same traits, same learning by doing, same death. The world doesn't revolve around the player and doesn't wait for them.
2. **The world keeps living.** Monsters age, breed, compete and spread. Cities grow, starve, migrate and die. Every system changes world state, and that state is what the player reads.
3. **You grow by doing.** No classes, no attributes. Swing a sword and you get better with swords. Fight an ogre often enough and you learn its heavy swing. Your build is your history.
4. **Cozy surface, brutal depth.** Saturated, lighthearted visuals and humor sit on top of permadeath (per world), corpse runs, open PvP and dungeons that remember who they killed.
5. **Friends at the table.** A desktop game for you and a few friends (OQ-029). One machine hosts the world, friends join over LAN or the internet, and nobody needs an account.
6. **Everything is ours.** Every pixel and every sound is authored by us (Lucid or overgrown's Claude agents), by any method: code, hand-authored data files, offline renders. Nothing is downloaded, traced or taken from outside services (OQ-030).

## Tone

Lighthearted and saturated, with dark humor. A big mob knocks a tree onto your head and the tree does the damage. Each biome has its own palette, while magic, hits and loot always pop. The world is cozy at a glance, but the details give it away: scars, grey fur, abandoned villages, a corpse with someone else's gear on it.

## References (what we take, and from where)

| Game | Take | Avoid |
|------|------|-------|
| Valheim | Seeded worlds, characters that travel between worlds, host-run sessions, corpse runs, stamina combat, zone-split simulation | Rigid biome rings where difficulty equals biome |
| Metin2 | Real-time hack-and-slash feel, XP loss on death, player shops, karma | Grind for its own sake, pay-to-win |
| Minecraft | Infinite chunk worlds, day/night with sleep skipping, share-and-join simplicity | Empty procedural sameness |
| Risk of Rain | Time as the difficulty clock | Run-only structure |
| Cube World | Infinite world with RPG loot | Progression that doesn't mean anything (it lost the point of exploring) |
| STALKER (A-Life) | NPCs and monsters that live off-screen at reduced detail | — |
| Dwarf Fortress / Kenshi | Emergent stories, you're nobody special, factions with memory | Impenetrable UI |
| Skyrim / Oblivion | Witness-based crime and bounties, skills that grow by use | Leveled world that scales with the player |
| Zelda (top-down) | 3/4 perspective readability, shadow telegraphs for things in the air | — |

## Glossary

- **World**: one seed-generated, infinite map with its own simulation state. Hosted on one machine.
- **Character**: portable across worlds. Holds level, traits, abilities, teachings and inventory.
- **Trait**: a passive competence grown by repeated use (sword mastery, dodging, haggling).
- **Ability**: an active power learned from an Ability Book. Costs level points to learn and to rank up.
- **Teaching** (also "skill"): a transferable technique, such as an attack pattern or movement trick, learned from NPCs or from fighting monsters that use it.
- **Level points**: one per character level. Spent on learning and ranking up abilities.
- **Dungeon**: a city-bound, multi-floor instance. Its upper floors are stable and may contain shops.
- **Rift**: the wild version of a dungeon. Appears in the overworld, grows, leaks monsters, can be sealed.
- **Sim LOD**: simulation level of detail. Full simulation near players, coarse statistics far away.
- **Shadow telegraph**: a flying enemy shown only as its ground shadow until it dives.
- **Witness system**: a crime only counts if an NPC saw it and lived long enough to report it.

## Scope tasks

- [x] **OVR-001** `[proto]` Repo scaffold: TS client, Python asset pipeline, CI that builds both and fails on lint or type errors. — #1
- [x] **OVR-002** `[proto]` Seeded RNG utility shared by client and pipeline (same seed gives the same output in TS and Python where needed). — #5
- [x] **OVR-003** Add the MIT `LICENSE` file (decided in OQ-001: MIT for code and generated assets). — #2
- [ ] **OVR-004** Write overgrown-specific instantiations for the five lattice principles in `docs/PRINCIPLE_LATTICE.md` (replace the `[ADAPT]` markers); Lucid approves.
- [ ] **OVR-005** README quick start: prerequisites (Node 22, Python 3.13), the build/dev/test commands, and the `?seed=` URL parameter (found in M0 E2E).
- [x] **OVR-006** Committed headless page checker `scripts/check-page.mjs` (`playwright-core` devDependency): loads a URL, prints canvas info and console errors, saves an optional screenshot, exits 1 on errors. Agent role files reference it (replaces M0's container-only checker). — #12
- [x] **OVR-007** Dev-environment housekeeping: repo-root `.venv/` convention (ignored by git and eslint), replace the old container's paths and the stale proxy trap in `CLAUDE.md`, and copy the discipline skills from `LucidPaths/claude.md-workflow` into `.claude/skills/`. — #13
- [x] **OVR-008** Retarget to a desktop game for a few friends and redefine 'everything is ours' as 'authored by us' (OQ-029, OQ-030). — #33
