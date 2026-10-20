# 04 — Characters & Progression

## Creation

- **Species** (→ CAT species): the only mechanical choice at creation. Each species has **one innate**: a way of interacting with the world (senses, traversal, trust) that the species starts with and anyone else can unlock later through a trait. Innates are never stat buffs or immunities, are roughly equal in value, and don't steer playstyle.
- **Appearance:** body, colors, hair or fur, face, starting clothes. Everything else is learned in play.
- **No attributes.** There is no STR/DEX/INT. Power comes from traits, abilities, teachings and gear. Attributes that grow by use would be redundant with traits, and attributes bought with points would compete with abilities.

## Levels and experience

- Every kill grants XP, overworld and dungeon alike. Quests, crafting milestones and discoveries grant XP too.
- **Soft cap:** the XP curve steepens so levels slow down without a hard ceiling. This mirrors monsters soft-capping with age.
- **The level-up draft (OQ-041).** Each level-up offers **3 choices** and you pick one. The choices come from a pool fed by what the character has: **Ability Books read, gear carried and teachings learned** (learn or rank up an ability or technique), plus **generic boons**. This replaces level points.
- **Base power.** Every level-up also raises base power passively, whatever you pick.
- **Not decided yet:** draft size per rarity, rerolls, the generic boon list and how much base power one level adds are decided in CHR-020. How each source feeds the pool is decided in CHR-021.
- **De-leveling** (dungeon deaths can cause it): what happens to the draft picks above your new level is decided in CHR-020.

## The three ways to grow

### 1. Traits — grow by doing

A trait is a passive competence that rises by use, with no points involved. Anyone can learn any trait at any time just by doing the thing.

- **Weapon masteries** (one per weapon type: sword, bow, staff, …). Mastery skews damage rolls toward the top of the weapon's damage range (see the formula in CMB).
- **Movement:** dodging, sprinting, jumping, swimming, climbing.
- **Magic:** mana regeneration, channel speed, staff/wand/tome mastery.
- **Life:** gathering, crafting crafts, trading/haggling, taming, perception, tracking, sneaking.
- **Social:** NPC reputation-related traits such as persuasion and leadership (→ CAT traits).

Traits use diminishing returns: each rank needs more use than the last. **NPCs gain traits exactly the same way.**

### 2. Abilities — learned from Ability Books, picked in the level-up draft

- **Ability Books** drop in dungeons and rifts and are sold in special shops. Reading one **adds its ability to the draft pool** (OQ-041). Whether a book read is guaranteed to show up in the next draft is decided in CHR-021.
- **Ranking up** an ability is also a draft choice. Using an ability fills its ability XP; how a full bar makes a rank-up appear in the draft is decided in CHR-021.
- Each level-up is one pick among three, so the draft is the build system: which abilities, how far each one is ranked, and which other picks you take instead.
- Abilities cost **mana** (→ CMB). Some can be **toggled to auto-fire** while they pay mana (OQ-040, → CMB). Spam an ability back to back and it starts costing stamina too (ability fatigue).

### 3. Teachings — techniques taken from others

A teaching is a transferable technique, usually an attack pattern or movement trick. Teachings come only from:
- **NPC teachers**, who can be asked, paid or befriended into teaching. Example: an assassin teaches silent running.
- **Fighting monsters or NPCs that use it, repeatedly.** Example: fight ogres enough and you learn the heavy blunt swing. Fight archers and you pick up quickdraw or multishot.

**Magic teachings** work the same way: spell techniques learned from NPC mages or from magical monsters (e.g. fire spit from a salamander). They need a magic focus and cost mana. Together with the focus-bound ability of the equipped focus (→ CMB magic), they mean a mage never depends on Ability Books alone.

Each teaching has a **requirement** (weapon type or trait rank) to use it, plus its own proficiency that grows by use. Teachings are not bought with anything. The cost is exposure: you have to seek out the right teacher or enemy. A learned teaching also feeds the draft pool (OQ-041).

## Equip slots (paper doll)

Head, chest, legs, feet, hands, back (cape or quiver), main hand, off hand (shield, torch, tome, second weapon), two rings, an amulet, and a cosmetic/fashion override per armor slot (→ ART paper doll).

## Death (summary; details in CMB)

- At 0 HP you're **downed** for ~10 s and an ally can revive you.
- **Overworld: always permadeath** (OQ-042). The character is dead and you make a new one in the same world. Its items stay in its **grave** for anyone to loot. **Hardcore** (solo only, an optional host setting) also deletes the world.
- **Dungeon/rift:** you're teleported to the entrance and lose XP, scaled by depth; you can de-level. The dungeon gets harder for everyone (→ DNG).
- Reputation is tied to the character, so a new character starts fresh. What carries over is the world's memory, below.

## What outlives a character (OQ-044)

The meta progression is the world, not an account: no account or currency unlocks. A new character is a new person, but the world remembers the old one.

- **The world remembers.** What a character changed stays: beacons and waystones it lit at the frontier stay lit, and dens and outposts it cleared stay changed (→ WLD, ECO). The next character benefits, for example by starting further out.
- **Knowledge codex.** The Ability Books and teachings a character learned are recorded. New characters relearn them cheaper or start with some. Default scope: the world save. The exact benefit, and whether the codex follows the player profile across worlds, are decided in CHR-022.
- **Heirloom and grave.** The grave holds the dead character's gear, and any character can loot it. One heirloom (or a bit of power) passes to the next character; what it is and how it is chosen is decided in ITM-019. The grave also becomes a landmark that acts as a civilization anchor (→ NPC, tug of war).

## Tasks

- [x] **CHR-001** `[proto]` Character entity shared by players and NPCs (same component set). Movement and collider defaults in OQ-025. — #16
- [ ] **CHR-002** `[proto]` XP and level-up with a soft-cap curve (tunable table).
- [ ] ~~**CHR-003** Level point pool: earned 1 per level; spent on learning and ranking abilities; on de-level, the most recent spend goes dormant until the level is regained.~~ (dropped: level points are replaced by the level-up draft, OQ-041; de-level handling moves to CHR-020)
- [ ] **CHR-004** `[proto]` Trait system core: use events → trait XP → rank, with diminishing returns.
- [ ] **CHR-005** `[proto]` Weapon mastery traits feeding the damage roll skew (→ CMB-008).
- [ ] **CHR-006** Movement traits: dodge, sprint, swim, climb, jump.
- [ ] **CHR-007** Magic traits: mana regen, channel speed, focus masteries.
- [ ] **CHR-008** Life traits: gathering, crafting, haggling, taming, perception, tracking, sneaking.
- [ ] **CHR-009** Ability Book item: read → its ability joins the level-up draft pool (rewritten: OQ-041; → CHR-021).
- [ ] **CHR-010** Ability XP by use; a full bar makes a rank-up available through the level-up draft (rewritten: OQ-041; → CHR-021).
- [ ] **CHR-011** Ability fatigue: rapid repeated casts add a stamina cost.
- [ ] **CHR-012** Teaching system core: exposure counter per teaching per character, learn threshold, usage requirements.
- [ ] **CHR-013** Learn teachings from NPC teachers (dialogue, cost, conditions).
- [ ] **CHR-014** Learn teachings by repeatedly fighting monsters or NPCs that use them.
- [ ] **CHR-015** Teaching proficiency grows by use.
- [ ] **CHR-016** Species selection with one innate each, implemented as a pre-unlocked trait capability (→ CAT species).
- [ ] **CHR-017** Appearance editor: body, colors, hair/fur, face, starting clothes.
- [ ] **CHR-018** Equip slots and paper-doll layering (→ ART-010).
- [ ] **CHR-019** Character sheet UI: traits, abilities, teachings, level (rewritten: OQ-041).
- [ ] **CHR-020** Level-up draft core: the pool, 3 choices per level-up, the pick UI, and base power per level; also decides draft size per rarity, rerolls, the generic boon list and de-level handling of picks (OQ-041) (→ CHR-002).
- [ ] **CHR-021** Draft pool sources: Ability Books read, gear carried, teachings learned (learn or rank up) and generic boons feed the pool (OQ-041) (→ CHR-020, CHR-009, CHR-012, ITM-001).
- [ ] **CHR-022** Knowledge codex: record the Ability Books and teachings a character learned, so new characters relearn them cheaper or start with some; per world save by default (OQ-044) (→ CHR-009, CHR-012).
- [ ] **CHR-023** Character creation after death: a new character in the same world, starting near the origin or at a lit beacon (OQ-042, OQ-044) (→ CHR-017, CMB-019, WLD-024).
