# 05 — Combat & Controls

Real-time hack-and-slash with physical weight, closer to Valheim and Metin2 than to auto-attack survivors games.

## Controls

**Desktop (default):**
- WASD move · mouse aims · LMB weapon attack · RMB block/aim (by weapon) · Space dodge · Shift sprint
- 1–6 abilities and teachings on a hotbar · E interact · Tab inventory
- **Optional click-to-move scheme** (Metin2-style), toggled in settings: LMB on ground moves, LMB on an enemy moves into range and attacks

**Touch (day one) (retired, OQ-029):**
- Left virtual stick moves. A big attack button attacks toward the stick direction, with soft auto-aim at the nearest target in a cone.
- Dodge button; ability ring of 4–6 buttons around attack; hold attack for a heavy attack or charge.
- Tapping an enemy hard-targets it; tapping empty ground clears the target.
- Retired: the touch input that shipped (CMB-002, UIX-002) stays in the code and gets no further work. Keyboard, mouse and gamepad are the inputs (OQ-029).

## Resources

- **Stamina:** spent by basic attacks, heavy attacks, dodges, sprinting, swimming and blocking. Regenerates after a short pause.
- **Mana:** spent by abilities, focus-bound abilities and magic teachings. Regeneration grows with the mana regen trait.
- **Ability fatigue:** casting abilities back to back stacks a fatigue counter, which adds a stamina cost to further casts until it decays. Spamming is possible but punished.
- **HP:** healing comes from food, potions, resting and abilities. No passive regen in combat.

## Weapons

Every weapon has a **damage range (min–max)**, a speed, a reach and a family. The family determines the basic attack pattern and which mastery trait grows from it.

Families: blades (sword, dagger, greatsword) · blunt (mace, hammer, club) · axes · polearms (spear, halberd) · bows · crossbows · throwing weapons · shields (off-hand, bash) · magic foci (staff, wand, tome).

**Magic is just another thing in the world**, not a separate class. Magic foci (staff, wand, tome) are weapons with one difference: **a focus has no basic attack.** Instead, each focus comes with a built-in **focus-bound ability**, shaped by that focus (a fire staff might carry a flame jet, a stone wand a shard burst). It costs mana and no level points, and it grows with the focus mastery trait, the same way a sword's swing grows with blade mastery.

A mage's toolkit has four sources, so no mage depends on Ability Books alone:
1. the **focus-bound ability** of the equipped focus
2. **magic teachings** learned from NPC mages and magical monsters, exactly like martial teachings (→ CHR teachings)
3. **traits**: focus mastery, mana flow, channeling, attunement
4. **Ability Books**, which aren't only elemental spells and can be used with any weapon that meets their requirement

## Damage

**Mastery skews the roll toward the top of the range:**

```
u      = uniform(0,1)
skew   = 1 + k × mastery_rank        (k ≈ 0.15, tunable)
roll   = min + (max − min) × u^(1/skew)
```

At mastery 0 the roll is uniform across the range. As mastery grows, rolls cluster near max, so an expert hits consistently hard. A weapon's max never changes; only how reliably you reach it does.

Final damage = roll × (ability/teaching multiplier) × (crit) − target armor, plus element and status effects.

## Feel ("juice")

Hit flash, hitstop (a 2–4 frame pause on heavy hits), knockback scaled by weight, screen shake on big impacts, damage numbers, particles per material (blood, sap, sparks, dust). All of it can be turned down in settings.

## Environment

Anything can hurt anything. Falling trees, rolling rocks, thrown props and friendly-fire area effects deal damage to every entity in their path.

## PvP

- **Open PvP everywhere.** Any player can attack any player or NPC.
- **Consequences are witness-based** (→ NPC crime): a kill only counts as a crime if a living NPC saw it and gets back to a settlement to report it.
- Corpses are lootable by anyone.

## Death

**Downed first.** At 0 HP a character is **downed** for ~10 s (tunable): they can't act, they can be finished off, and any ally can revive them by channeling next to them. If nobody does, they die. This works in every world mode. In PvP it means looters wait out the 10 s.

**World modes**, picked by the host at world creation:

| Mode | Overworld death |
|------|-----------------|
| **Respawn** | Respawn at your bed or the world spawn. Your corpse keeps your inventory until you recover it (Valheim-style). |
| **Permadeath** | Character deleted. Everything they carried stays on the corpse in that world. Reputation, traits and level are gone. |
| **Hardcore** (solo only) | Character deleted **and the world is deleted** (Minecraft hardcore-style). Can't be opened to friends. |

**Dungeon/rift death (all modes):** you're teleported to the entrance and lose XP. The loss **scales with floor depth and can de-level you** (Metin2-style, harsh; amounts tunable). The dungeon's difficulty rises for everyone (→ DNG).

## Tasks

- [x] **CMB-001** `[proto]` Desktop input: WASD movement, mouse aim, LMB attack, Space dodge, Shift sprint. M1: attack, dodge and sprint are animation-only with no stamina (OQ-021); movement and facing defaults in OQ-025. — #20
- [x] **CMB-002** `[proto]` Touch input: virtual stick, attack button with soft auto-aim, dodge button. M1 scoping in OQ-021; auto-aim defaults in OQ-026. — #25
- [ ] **CMB-003** `[proto]` Ability hotbar (keys 1–6; the touch ring is dropped, OQ-029).
- [ ] **CMB-004** `[proto]` Stamina pool: costs per action, regen after a pause.
- [ ] **CMB-005** `[proto]` Dodge roll with invulnerability frames.
- [ ] **CMB-006** Mana pool and regen hooked to the mana trait.
- [ ] **CMB-007** `[proto]` Melee attacks: per-family swing arcs and hitboxes.
- [ ] **CMB-008** `[proto]` Damage roll with mastery skew (formula above).
- [ ] **CMB-009** `[proto]` Hit feedback: flash, hitstop, knockback, damage numbers.
- [ ] **CMB-010** Ranged weapons: projectiles, draw time, ammo.
- [ ] **CMB-011** Magic foci: no basic attack; each focus grants its focus-bound ability (mana cost, scales with focus mastery).
- [ ] **CMB-012** Shields: block (stamina), parry window, bash.
- [ ] **CMB-013** Heavy/charged attacks.
- [ ] **CMB-014** Status effects: bleed, burn, poison, slow, stun, wet, chill.
- [ ] **CMB-015** Armor and damage types (cut, blunt, pierce, elements).
- [ ] **CMB-016** Crits.
- [ ] **CMB-017** Environmental damage from props (→ WLD-020).
- [ ] **CMB-018** Open PvP: players can damage players; kill attribution for the crime system.
- [ ] **CMB-019** Death in the overworld per world mode: respawn, permadeath, hardcore (solo-only, deletes the world).
- [ ] **CMB-020** Corpse container: holds the full inventory, lootable by anyone, persists in the world save.
- [ ] **CMB-021** Dungeon death: teleport to entrance, depth-scaled XP loss that can de-level, notify the dungeon difficulty system (→ DNG-009).
- [ ] **CMB-022** Juice settings: screen-shake and flash intensity sliders.
- [ ] **CMB-023** Hitting flyers during their attack pass (→ ECO-012).
- [ ] **CMB-024** Optional click-to-move control scheme (settings toggle).
- [ ] **CMB-025** Downed state: ~10 s at 0 HP, ally revive by channeling, death on expiry or finishing blow; corpse is lootable only after death.
- [ ] **CMB-026** Gamepad input: move, aim, attack, dodge, sprint through the shared HostInput. (OQ-029)
