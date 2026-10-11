# 04 — Characters & Progression

## Creation

- **Species** (→ CAT species): the only mechanical choice at creation. Each species has a few **unique innate abilities** that no one else can learn.
- **Appearance:** body, colors, hair or fur, face, starting clothes. Everything else is learned in play.
- **No attributes.** There is no STR/DEX/INT. Power comes from traits, abilities, teachings and gear. Attributes that grow by use would be redundant with traits, and attributes bought with points would compete with abilities.

## Levels and experience

- Every kill grants XP, overworld and dungeon alike. Quests, crafting milestones and discoveries grant XP too.
- **Soft cap:** the XP curve steepens so levels slow down without a hard ceiling. This mirrors monsters soft-capping with age.
- **Level points: 1 per level.** They're the currency for abilities (below). A level 10 character has 10 points in total, so it can't hold 11 abilities.

## The three ways to grow

### 1. Traits — grow by doing

A trait is a passive competence that rises by use, with no points involved. Anyone can learn any trait at any time just by doing the thing.

- **Weapon masteries** (one per weapon type: sword, bow, staff, …). Mastery skews damage rolls toward the top of the weapon's damage range (see the formula in CMB).
- **Movement:** dodging, sprinting, jumping, swimming, climbing.
- **Magic:** mana regeneration, channel speed, staff/wand/tome mastery.
- **Life:** gathering, crafting crafts, trading/haggling, taming, perception, tracking, sneaking.
- **Social:** NPC reputation-related traits such as persuasion and leadership (→ CAT traits).

Traits use diminishing returns: each rank needs more use than the last. **NPCs gain traits exactly the same way.**

### 2. Abilities — learned from Ability Books, paid with level points

- **Ability Books** drop in dungeons and rifts and are sold in special shops. Reading one teaches its ability **if you spend 1 level point**.
- There's no limit on how many abilities you know, apart from your level points.
- **Ranking up:** using an ability fills its ability XP. When it's full, you can spend **another level point** to rank it up.
- That trade-off is the build system. Many abilities at low rank, or a few at high rank.
- Abilities cost **mana** (→ CMB). Spam an ability back to back and it starts costing stamina too (ability fatigue).

### 3. Teachings — techniques taken from others

A teaching is a transferable technique, usually an attack pattern or movement trick. Teachings come only from:
- **NPC teachers**, who can be asked, paid or befriended into teaching. Example: an assassin teaches silent running.
- **Fighting monsters or NPCs that use it, repeatedly.** Example: fight ogres enough and you learn the heavy blunt swing. Fight archers and you pick up quickdraw or multishot.

**Magic teachings** work the same way: spell techniques learned from NPC mages or from magical monsters (e.g. fire spit from a salamander). They need a magic focus and cost mana. Together with the focus-bound ability of the equipped focus (→ CMB magic), they mean a mage never depends on Ability Books alone.

Each teaching has a **requirement** (weapon type or trait rank) to use it, plus its own proficiency that grows by use. Teachings cost **no level points**. The cost is exposure: you have to seek out the right teacher or enemy.

## Equip slots (paper doll)

Head, chest, legs, feet, hands, back (cape or quiver), main hand, off hand (shield, torch, tome, second weapon), two rings, an amulet, and a cosmetic/fashion override per armor slot (→ ART paper doll).

## Death (summary; details in CMB)

- At 0 HP you're **downed** for ~10 s and an ally can revive you.
- **Overworld:** depends on the world mode. **Respawn** sends you back to your bed or the world spawn and leaves a corpse to recover. **Permadeath** deletes the character; its items stay on its corpse for anyone to loot. **Hardcore** (solo only) deletes the character and the world.
- **Dungeon/rift:** you're teleported to the entrance and lose XP, scaled by depth; you can de-level. The dungeon gets harder for everyone (→ DNG).
- Either way, reputation is tied to the character, so a new character starts fresh.

## Tasks

- [ ] **CHR-001** `[proto]` Character entity shared by players and NPCs (same component set).
- [ ] **CHR-002** `[proto]` XP and level-up with a soft-cap curve (tunable table).
- [ ] **CHR-003** Level point pool: earned 1 per level; spent on learning and ranking abilities.
- [ ] **CHR-004** `[proto]` Trait system core: use events → trait XP → rank, with diminishing returns.
- [ ] **CHR-005** `[proto]` Weapon mastery traits feeding the damage roll skew (→ CMB-008).
- [ ] **CHR-006** Movement traits: dodge, sprint, swim, climb, jump.
- [ ] **CHR-007** Magic traits: mana regen, channel speed, focus masteries.
- [ ] **CHR-008** Life traits: gathering, crafting, haggling, taming, perception, tracking, sneaking.
- [ ] **CHR-009** Ability Book item: read → spend level point → learn ability.
- [ ] **CHR-010** Ability XP by use; rank-up gate that costs a level point.
- [ ] **CHR-011** Ability fatigue: rapid repeated casts add a stamina cost.
- [ ] **CHR-012** Teaching system core: exposure counter per teaching per character, learn threshold, usage requirements.
- [ ] **CHR-013** Learn teachings from NPC teachers (dialogue, cost, conditions).
- [ ] **CHR-014** Learn teachings by repeatedly fighting monsters or NPCs that use them.
- [ ] **CHR-015** Teaching proficiency grows by use.
- [ ] **CHR-016** Species selection with innate abilities (→ CAT species).
- [ ] **CHR-017** Appearance editor: body, colors, hair/fur, face, starting clothes.
- [ ] **CHR-018** Equip slots and paper-doll layering (→ ART-010).
- [ ] **CHR-019** Character sheet UI: traits, abilities, teachings, level points.
