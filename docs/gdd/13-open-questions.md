# 13 — Open Questions

Undecided things go here, each with a **default** that code follows until it's decided. When a question is resolved, its row moves to *Resolved* with the decision, and the design sections are updated to match. IDs are never reused.

## Open

| ID | Question | Default until decided |
|----|----------|----------------------|
| OQ-002 | Final game name. | `overgrown` (working name) |
| OQ-017 | Mage design details: which foci exist, what each focus-bound ability is, and which monsters/NPCs teach magic teachings. | Draft in `12-catalogs.md`; Lucid to review. |

## Resolved

| ID | Question | Decision (2026-10-11) | Applied in |
|----|----------|----------|------------|
| OQ-001 | License | **MIT for everything** (code and generated assets). | OVR-003 |
| OQ-003 | Headless dedicated hosts for always-on worlds? | **Yes, plan for it.** The sim must run in Node without browser APIs, so a server can host a world the same way a tab does. | 01-tech, TEC-018 |
| OQ-004 | When does Sign in with X happen? | **Optional, forever.** It's identity sugar, never a gate. Characters work fully without it. | 01-tech, TEC-013 |
| OQ-005 | What happens when the host leaves? | **The tab-hosted world closes.** Always-on worlds use a dedicated host (OQ-003). No peer-to-peer host migration. | 01-tech |
| OQ-006 | Click-to-move? | **Yes, as an optional desktop scheme** in settings (Metin2-style). | 05-combat, CMB-024 |
| OQ-007 | Dungeon XP loss | **Harsh: scales with depth and can de-level.** | 05-combat, 07-dungeons |
| OQ-008 | Can stalls sell while the owner is away? | **Yes, through a hired NPC clerk** who runs the stall in that world. | 08-items-economy, ITM-018 |
| OQ-009 | Regional currencies? | **No. One coin currency.** | 08-items-economy |
| OQ-010 | Free-form base building? | **Maybe later, post-MVP.** Not planned now. | 09-housing-taming |
| OQ-011 | Permadeath design | **Per-world mode, picked by the host:** Respawn, Permadeath, or **Hardcore** (solo-only; your death deletes the world, Minecraft-style). | 05-combat, 11-ui-ux |
| OQ-012 | Revive | **Yes, everywhere.** A dying character is *downed* for ~10 s, and an ally can revive them in that window. In PvP, looters wait out the 10 s. | 05-combat, CMB-025 |
| OQ-013 | Can PvP be turned off? | **No. Open PvP everywhere.** | 05-combat |
| OQ-014 | Flag characters by the modes they've played? | **No flags.** | — |
| OQ-015 | Save size in infinite worlds | **Forget untouched chunks:** visited chunks with no lasting changes are dropped and regenerated from the seed on revisit. Region sim statistics are kept. | 02-world, WLD-022 |
| OQ-016 | Magic focus attack vs ability books | **A focus has no basic attack.** It comes with a built-in **focus-bound ability** (no level-point cost). Mages also learn **magic teachings** from NPC mages and magical monsters, like martial teachings. Ability Books aren't only elemental spells, and mages shouldn't depend on books alone. | 04-characters, 05-combat, 12-catalogs |
| OQ-018 | Cliffs in M1 (the E2E needs them; no task named them) | **A blocking `cliff` tile** on steep elevation in mountains, drawn with a 3/4 rock face. No height levels. (2026-10-12) | 02-world, WLD-004, ART-004 |
| OQ-019 | Water walkability before swimming exists | **Shallow walkable at ×0.6 speed; deep and very deep block** until WLD-017. Rivers are mostly shallow, deep only in wide stretches, with seeded fords. (2026-10-12) | 02-world, WLD-002, WLD-004 |
| OQ-020 | Species and body plans for ART-005 | **All 9 draft species on one shared humanoid biped skeleton (32×32)**, so all gear fits everyone. Species differ by parameters: height and width, head shape, ears, snout or beak, tail, fur/feathers/scales, colours. Birdfolk arms are arms with feathered sleeves. (2026-10-12) | ART-005 |
| OQ-021 | Attack, dodge and sprint in M1 (before stamina, i-frames and combat) | **Animation only.** LMB: an attack action toward the aim, rooted, no hitbox. Space: a ~0.35 s roll of 3 tiles in the move direction (facing if idle), no i-frames or cost, collision applies. Shift: sprint ×1.6 without limit until CMB-004. Touch: full stick deflection sprints. (2026-10-12) | CMB-001, CMB-002 |
| OQ-022 | Attack animation families in M1 | **Blades + unarmed.** Weapon family is a generator parameter; no weapon pixels in ART-006, frames carry a hand anchor for ART-009. (2026-10-12) | ART-006 |
| OQ-023 | Budget work for M1 | **TEC-020 (DPR cap) and TEC-021 (startup waterfall) join M1.** TEC-022 (animated actor rendering) is added to own the snapshot → frame mapping. (2026-10-12) | MILESTONES |
| OQ-024 | World feel defaults | Biome regions **~6–10 chunks across**. Zoom: the **largest integer scale showing ≥ 16 tiles on the short axis**. Spawn: **nearest walkable grassland tile to (0,0)** by a deterministic spiral. The `?seed=` URL counts as "create a world from a seed" until UIX-008. (2026-10-12) | WLD-002, WLD-003, CMB-001 |
| OQ-025 | Movement and collision defaults | Walk **5 tiles/s (80 px/s)**, instant acceleration, normalized diagonals. Facing follows movement and **snaps to the aim during attack and dodge**. Collider: a **10×6 px foot box** at the sprite's bottom centre; characters don't block each other in M1. All tunable. (2026-10-12) | CHR-001, CMB-001, WLD-004 |
| OQ-026 | Touch layout and auto-aim defaults | **Floating stick in the left half**, attack bottom-right with dodge beside it, the ability ring shown greyed out until CMB-003, safe-area aware. Soft auto-aim: **±30° cone, 4 tiles**; with no target, attack goes toward facing. (2026-10-12) | CMB-002, UIX-002 |
| OQ-027 | Palettes for M1 art | **A new actor palette** (skin, fur, feathers, scales, hair, cloth ramps) and **one palette per biome** for tiles. (2026-10-12) | ART-004, ART-005 |
