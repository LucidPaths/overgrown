# 13 — Open Questions

Each question has a **default** that code follows until it's decided. When one is resolved, record the decision and strike the question; keep the ID.

| ID | Question | Default until decided |
|----|----------|----------------------|
| OQ-001 | Which open-source license? Code and generated assets may want different licenses (e.g. MIT/Apache for code, CC-BY-SA for art). | Undecided; nothing published as a release before this is set. |
| OQ-002 | Final game name, since "overgrown" is the working name. | `overgrown` |
| OQ-003 | Can a world be hosted somewhere other than a browser tab (a headless dedicated host on a server) for always-on worlds? | Tab-only. |
| OQ-004 | Sign in with X: X developer account and API costs are unverified. Required before first play, or prompted later? What happens with no X account? | Prompt after a few minutes of play; allow local-only characters if sign-in fails. |
| OQ-005 | Host migration: when the host leaves, does another peer take over, or does the world close? | World closes; other players' characters keep what they carried. |
| OQ-006 | Click-to-move as an alternative desktop scheme? | WASD + mouse only. |
| OQ-007 | Dungeon XP loss size, and can it de-level you? | 10% of the current level's XP requirement; no de-leveling. |
| OQ-008 | Can player stalls sell while the owner is offline (or in another world)? | No; stalls close when the owner leaves. |
| OQ-009 | Regional/species currencies? | One coin currency. |
| OQ-010 | Free-form base building ever? | No; claim, furnish and camps only. |
| OQ-011 | Permadeath design needs a closer look, per Lucid. Is permadeath + corpse looting fun at scale, or is a lineage/heir system better? | Per-world setting: permadeath or respawn. |
| OQ-012 | Revive ability: does it exist, and does it work in permadeath worlds? | Respawn worlds only. |
| OQ-013 | Can PvP be disabled per world, or is open PvP universal? | Open PvP everywhere (as chosen). |
| OQ-014 | Do characters from a permadeath world get flagged when joining respawn worlds (and vice versa)? | No flags. |
| OQ-015 | Max world size or chunk retention? Save files grow without bound in an infinite world. | Keep all visited chunks; revisit when saves exceed ~50 MB. |
| OQ-016 | Should magic-focus basic attacks and fire-type abilities overlap (fire staff + Fireball book)? Lucid flagged it as possibly redundant but wants magic to be "just another thing". | Both exist; the focus attack is weak and spammable, book abilities are strong and costly. |
