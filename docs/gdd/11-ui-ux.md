# 11 — UI & UX

## Principles

- **The first click is the game.** Launch it, see the world within seconds. There are no accounts; identity is a local profile name (OQ-029). Character creation is short (species + appearance) and can be skipped with a random roll.
- **Diegetic where possible.** Danger is read from sprites (size, scars, grey fur) before numbers. Numbers appear as your perception trait grows.
- ~~**Touch and mouse are equals.** Every action works with both.~~ (retired, OQ-029: keyboard, mouse and gamepad are the inputs; the shipped touch layout stays in the code with no further work)

## HUD

- HP, stamina and mana bars, plus an ability fatigue indicator.
- Hotbar (the touch ability ring is retired, OQ-029).
- Minimap showing explored areas only; a full map shows explored chunks, discovered settlements, dungeons and rifts.
- Clock and season indicator; weather icon.
- Damage numbers (toggleable).

## Nameplates (trait-gated)

| Perception rank | You see |
|---|---|
| Low | Name only, plus visual cues |
| Mid | Rough danger tier (color) and age symbol |
| High | Exact level, age stage, mutation flag, known teachings |

## Menus

- Inventory + paper doll · character sheet (traits, abilities, teachings, level points) · crafting · trade/barter · stall management · map · quest log · faction reputation.
- World menu: create world (seed; mode: Respawn / Permadeath / Hardcore, where Hardcore is solo-only; PvP is always on), load, export/import, open to friends (friends join the host over LAN or the internet, OQ-029; hidden for Hardcore), kick/ban.
- Settings include the optional click-to-move control scheme.

## Onboarding

No tutorial island. Spawn near a small friendly village where generated starter quests teach the systems through doing: gather, craft a weapon, cull a pest, sell materials, read your first Ability Book.

## Tasks

- [ ] **UIX-001** `[proto]` HUD: HP, stamina, mana bars.
- [x] **UIX-002** `[proto]` Touch layout: stick, attack, dodge, ability ring; auto-switch by input device. Layout per OQ-026. — #26
- [ ] **UIX-003** Minimap and full map with fog of war.
- [ ] **UIX-004** Nameplates gated by perception trait.
- [ ] **UIX-005** Inventory + paper doll screen.
- [ ] **UIX-006** Character sheet.
- [ ] **UIX-007** Crafting, trade and stall UIs.
- [ ] **UIX-008** World menu: create/load/export/import/open to friends.
- [ ] **UIX-009** Character creation: species + appearance, random roll.
- [ ] **UIX-010** Quest log and faction reputation screens.
- [ ] **UIX-011** Settings: graphics, audio buses, juice intensity, control remapping.
- [ ] **UIX-012** Starter-village onboarding quests (→ NPC-019).
