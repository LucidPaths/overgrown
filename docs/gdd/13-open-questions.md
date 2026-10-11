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
