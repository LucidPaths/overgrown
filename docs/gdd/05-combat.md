# 05 — Combat & Controls

Real-time hack-and-slash with physical weight, closer to Valheim and Metin2 than to auto-attack survivors games.

## Controls

**Desktop (default):**
- WASD move · mouse aims · LMB weapon attack · RMB block/aim (by weapon) · Space dodge · Shift sprint
- 1–6 abilities and teachings on a hotbar · E interact · Tab inventory
- Click-to-move as an alternative scheme (→ OQ-006)

**Touch (day one):**
- Left virtual stick moves. A big attack button attacks toward the stick direction, with soft auto-aim at the nearest target in a cone.
- Dodge button; ability ring of 4–6 buttons around attack; hold attack for a heavy attack or charge.
- Tapping an enemy hard-targets it; tapping empty ground clears the target.

## Resources

- **Stamina:** spent by basic attacks, heavy attacks, dodges, sprinting, swimming and blocking. Regenerates after a short pause.
- **Mana:** spent by abilities and by magic-focus attacks. Regeneration grows with the mana regen trait.
- **Ability fatigue:** casting abilities back to back stacks a fatigue counter, which adds a stamina cost to further casts until it decays. Spamming is possible but punished.
- **HP:** healing comes from food, potions, resting and abilities. No passive regen in combat.

## Weapons

Every weapon has a **damage range (min–max)**, a speed, a reach and a family. The family determines the basic attack pattern and which mastery trait grows from it.

Families: blades (sword, dagger, greatsword) · blunt (mace, hammer, club) · axes · polearms (spear, halberd) · bows · crossbows · throwing weapons · shields (off-hand, bash) · magic foci (staff, wand, tome).

**Magic is just another weapon family.** A fire staff's basic attack throws fire, and a stone wand's throws stones. The element is a property of the focus, the same way a sword has a cutting edge. Abilities from books are separate and can be used with any weapon that meets their requirement.

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

| Where | Result |
|-------|--------|
| Overworld, **permadeath world** | Character deleted. Everything they carried stays on the corpse in that world. Reputation, traits and level are gone. |
| Overworld, **respawn world** | Respawn at your bed or the world spawn. Your corpse keeps your inventory until you recover it (Valheim-style). |
| Dungeon / rift | Teleported to the entrance and lose XP (Metin2-style; amount tunable; → OQ-007). The dungeon's difficulty rises for everyone (→ DNG). |

The world host picks permadeath or respawn when creating the world.

## Tasks

- [ ] **CMB-001** `[proto]` Desktop input: WASD movement, mouse aim, LMB attack, Space dodge, Shift sprint.
- [ ] **CMB-002** `[proto]` Touch input: virtual stick, attack button with soft auto-aim, dodge button.
- [ ] **CMB-003** `[proto]` Ability hotbar (keys 1–6 / touch ring).
- [ ] **CMB-004** `[proto]` Stamina pool: costs per action, regen after a pause.
- [ ] **CMB-005** `[proto]` Dodge roll with invulnerability frames.
- [ ] **CMB-006** Mana pool and regen hooked to the mana trait.
- [ ] **CMB-007** `[proto]` Melee attacks: per-family swing arcs and hitboxes.
- [ ] **CMB-008** `[proto]` Damage roll with mastery skew (formula above).
- [ ] **CMB-009** `[proto]` Hit feedback: flash, hitstop, knockback, damage numbers.
- [ ] **CMB-010** Ranged weapons: projectiles, draw time, ammo.
- [ ] **CMB-011** Magic foci: element-based basic attacks costing mana.
- [ ] **CMB-012** Shields: block (stamina), parry window, bash.
- [ ] **CMB-013** Heavy/charged attacks.
- [ ] **CMB-014** Status effects: bleed, burn, poison, slow, stun, wet, chill.
- [ ] **CMB-015** Armor and damage types (cut, blunt, pierce, elements).
- [ ] **CMB-016** Crits.
- [ ] **CMB-017** Environmental damage from props (→ WLD-020).
- [ ] **CMB-018** Open PvP: players can damage players; kill attribution for the crime system.
- [ ] **CMB-019** Death in the overworld with the per-world permadeath/respawn setting.
- [ ] **CMB-020** Corpse container: holds the full inventory, lootable by anyone, persists in the world save.
- [ ] **CMB-021** Dungeon death: teleport to entrance, XP loss, notify the dungeon difficulty system (→ DNG-009).
- [ ] **CMB-022** Juice settings: screen-shake and flash intensity sliders.
- [ ] **CMB-023** Hitting flyers during their attack pass (→ ECO-012).
