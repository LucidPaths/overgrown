# overgrown — Game Design Document

The GDD is the single source of truth for what the game is. Code that contradicts it is either a bug or a sign the GDD needs a PR first.

## Sections

| # | File | Prefix | Covers |
|---|------|--------|--------|
| 00 | [Overview](00-overview.md) | `OVR` | Pitch, pillars, tone, references, glossary |
| 01 | [Tech & multiplayer](01-tech.md) | `TEC` | Stack, architecture, netcode, saves, auth, budgets |
| 02 | [World](02-world.md) | `WLD` | Worldgen, chunks, biomes, difficulty, clock, weather, seasons, water |
| 03 | [Ecology](03-ecology.md) | `ECO` | Monster aging, breeding, density, variants, flyers, territory bosses |
| 04 | [Characters & progression](04-characters.md) | `CHR` | Species, levels, level points, traits, abilities, teachings |
| 05 | [Combat & controls](05-combat.md) | `CMB` | Inputs, stamina/mana, weapons, damage, PvP, death |
| 06 | [NPCs & society](06-npcs-society.md) | `NPC` | Life sim, factions, cities, migration, crime, quests |
| 07 | [Dungeons & rifts](07-dungeons.md) | `DNG` | City dungeons, wild rifts, floors, death, lifecycle |
| 08 | [Items & economy](08-items-economy.md) | `ITM` | Loot, crafting, materials, trade, stalls, corpses |
| 09 | [Housing, camps & taming](09-housing-taming.md) | `HSG` | Claim & furnish, camps, beds, taming |
| 10 | [Art & audio pipeline](10-art-audio.md) | `ART` / `AUD` | Procedural sprites, paper doll, palettes, VFX, synth audio |
| 11 | [UI & UX](11-ui-ux.md) | `UIX` | HUD, menus, touch layout, onboarding |
| 12 | [Content catalogs (DRAFT)](12-catalogs.md) | `CAT` | Weapons, traits, abilities, teachings, species, monsters, biomes, stations |
| 13 | [Open questions](13-open-questions.md) | `OQ` | Undecided things, with a default until decided |

## Conventions

- **Design rules** are plain prose. They explain *why*.
- **Tasks** are checkbox bullets with a stable ID. One task should fit one PR:
  ```
  - [ ] **ABC-001** Example task description.
  ```
- **IDs never change or get reused.** If a task is dropped, strike it through and keep the ID: `- [ ] ~~**ABC-002** …~~ (dropped: reason)`.
- **New tasks** get the next free number in their prefix, appended at the end of the relevant list.
- `(→ ECO-012)` marks a dependency on another task.
- `[proto]` marks tasks needed for the first playable prototype. `[mvp]` will mark tasks needed for the first public release (not tagged yet).
- Tunable numbers live in data files later. Numbers in this doc are starting values, not law.

## Workflow

The full agent pipeline (spec → worker → critic → PR → Fable gate → merge) is in [docs/agents/PIPELINE.md](../agents/PIPELINE.md). In short:

1. Every task gets a spec in `docs/specs/<ID>.md` before work starts. A worker implements only that task on a branch named after its ID (lowercase ID + slug, e.g. `cmb-004-stamina-pool`).
2. The PR title starts with the ID: `CMB-004: stamina pool`. The PR body links the GDD line and the spec.
3. After the final gate passes, the orchestrator merges, then in the same push (or an immediate follow-up commit) ticks the box and appends the PR number:
   ```
   - [x] **ABC-001** Example task description. — #42
   ```
4. If implementation reveals the design was wrong, the PR also edits the design prose and says so in its description. Design changes never happen silently.
5. Anything undecided goes to [13-open-questions.md](13-open-questions.md), never into code as a guess.
