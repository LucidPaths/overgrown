# 00 — Overview

## Pitch

A real-time hack-and-slash sandbox RPG in a saturated, cozy, painted 3D world, seen through a tilted action-RPG camera. You play it on a desktop with a few friends, hosted on one machine, from a Godot exe you download (OQ-031, OQ-034, OQ-035). Worlds are generated from a seed and never end. You are not the chosen one. You are one more inhabitant of a living world, where NPCs and monsters live, learn, fight, breed, migrate and die by the same rules you do.

It looks lovely, but it isn't safe. A level 2 horned bunny grazes ten meters from a level 40 bear asleep in its den. Leave an area alone long enough and the monsters there grow older, stronger and more numerous until even the villages give up and leave.

The play loop runs between the **frontier** and the dungeons: the overworld is a real-time horde slayer that gets wilder the further you walk from the origin (calm near it, "monster horde nonsense" far out), and every level-up offers a draft of three choices that builds your character (OQ-040, OQ-041, OQ-043). Dying in the overworld is always permadeath and leaves your grave behind, while dungeons are the safer side of the loop: no permadeath, but a death there seals one of your abilities and raises the world's difficulty for good (OQ-042, OQ-045). The world remembers what your characters did, and the next one benefits. The frontier is a tug of war: graves, lit beacons and settlements push back against the monsters spreading, and the monsters push back where nobody holds the line (OQ-044).

## Pillars

1. **You are just another one.** Players and NPCs share one rule set: same traits, same learning by doing, same death. The world doesn't revolve around the player and doesn't wait for them.
2. **The world keeps living.** Monsters age, breed, compete and spread. Cities grow, starve, migrate and die. Every system changes world state, and that state is what the player reads.
3. **You grow by doing.** No classes, no attributes. Swing a sword and you get better with swords. Fight an ogre often enough and you learn its heavy swing. Your build is your history.
4. **Cozy surface, brutal depth.** Saturated, lighthearted visuals and humor sit on top of permadeath, graves and corpse runs, open PvP and dungeons that remember who they killed.
5. **Friends at the table.** A desktop game for you and a few friends (OQ-029). One machine hosts the world, friends join over LAN or the internet, and nobody needs an account.
6. **Everything is ours or credited.** What we make, by any method (including Lucid's AI-generated images and our agents' Blender scripts), and what we take under a compatible licence, with every third-party file listed in `game/assets/third_party/CREDITS.md`. Nothing unlicensed, NonCommercial or ripped from commercial games or artists (OQ-038, which supersedes OQ-030).

## Tone

Lighthearted and saturated, with dark humor. A big mob knocks a tree onto your head and the tree does the damage. Each biome has its own palette, while magic, hits and loot always pop. The world is cozy at a glance, but the details give it away: scars, grey fur, abandoned villages, a corpse with someone else's gear on it.

## References (what we take, and from where)

| Game | Take | Avoid |
|------|------|-------|
| Valheim | Seeded worlds, characters that travel between worlds, host-run sessions, corpse runs, stamina combat, zone-split simulation | Rigid biome rings where difficulty equals biome |
| Metin2 | Real-time hack-and-slash feel, player shops, karma | Grind for its own sake, pay-to-win |
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
- **Ability**: an active power learned from an Ability Book: the book adds it to the level-up draft pool, and the draft picks it (OQ-041).
- **Teaching** (also "skill"): a transferable technique, such as an attack pattern or movement trick, learned from NPCs or from fighting monsters that use it.
- **Level-up draft**: each level-up offers 3 choices drawn from what the character has (books read, gear carried, teachings learned, generic boons), and the player picks one (OQ-041).
- **Frontier**: the overworld far from the world origin, where monster density and horde size are highest (OQ-043).
- **Grave**: the container a death leaves with the dead character's full inventory (the corpse); it becomes a landmark that acts as a civilization anchor (OQ-044).
- **Civilization anchor**: a grave, a lit beacon or waystone, a village or a city. Anchors push back against monsters spreading and taking over settlements (OQ-044).
- **Knowledge codex**: the record of the Ability Books and teachings a character learned, which helps the next character (OQ-044).
- **Heirloom**: the one item (or bit of power) that passes from a dead character to the next (OQ-044).
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
- [ ] ~~**OVR-005** README quick start: prerequisites (Node 22, Python 3.13), the build/dev/test commands, and the `?seed=` URL parameter (found in M0 E2E).~~ (dropped: Godot overhaul, OQ-031; the root README covers the download and the Godot commands)
- [x] **OVR-006** Committed headless page checker `scripts/check-page.mjs` (`playwright-core` devDependency): loads a URL, prints canvas info and console errors, saves an optional screenshot, exits 1 on errors. Agent role files reference it (replaces M0's container-only checker). — #12
- [x] **OVR-007** Dev-environment housekeeping: repo-root `.venv/` convention (ignored by git and eslint), replace the old container's paths and the stale proxy trap in `CLAUDE.md`, and copy the discipline skills from `LucidPaths/claude.md-workflow` into `.claude/skills/`. — #13
- [x] **OVR-008** Retarget to a desktop game for a few friends and redefine 'everything is ours' as 'authored by us' (OQ-029, OQ-030; OQ-030 is superseded by OQ-038). — #33
- [x] **OVR-009** Record the Godot overhaul (decisions D1 to D8, OQ-031 to OQ-038): rewrite the GDD sections it touches, `CLAUDE.md`, the milestones and the root README, and add `game/assets/third_party/CREDITS.md` with its CI check `tools/check-credits.sh`. (`docs/overhaul/PLAN.md`) — #40
- [x] **OVR-010** Retire the TypeScript sim, the Pixi client, the Python art pipeline and the browser scripts (`sim/`, `client/`, `tools/art/`, `scripts/`) and `deploy.yml`, once the GDScript ports (GOD-003, GOD-004) are proven against the shared fixtures. They stay in git history. (OQ-031) — #42
- [x] **OVR-011** Record the frontier design (OQ-040, OQ-041, OQ-042, OQ-043, OQ-044): the horde-slayer combat shape, the level-up draft, always-permadeath, horde density by distance, and the world-remembers meta progression with the tug of war. Rewrites the GDD sections it touches, strikes or rewrites the tasks it makes wrong, adds the new tasks, and replans G2 in `docs/agents/MILESTONES.md`. (`docs/specs/OVR-011.md`) — #47
- [x] **OVR-012** Record the new dungeon-death rule (OQ-045): a death in a dungeon seals one ability until a church or healer NPC unseals it, and raises the world's difficulty for good; no XP loss or de-leveling. (`docs/specs/OVR-012.md`) — #50
