# 03 — Ecology

The overworld is an ecosystem, not a spawn table. Monsters are animals with lifecycles. What you see in an area is the result of what happened there.

## Lifecycle

Every monster has an **age**, measured in in-game days.

| Stage | Behavior | Visuals |
|-------|----------|---------|
| Young | Weak, stays near the pack or den, flees easily | Small, bright, soft shapes |
| Prime | Peak combat stats, breeds, defends territory | Defined muscle or lean build |
| Old | Slower, but knows more teachings and hits harder per blow; territorial | Grey fur/feathers, scars, a missing eye, a limp |
| Natural death | Dies of old age; the body is a material source | Corpse |

- There are **no full evolutions**. A wolf stays a wolf. Growth shows as size, stat curves, learned teachings and visual aging variants.
- **Monster levels are soft-capped by age.** Very old monsters plateau and eventually die naturally. That's why the player level cap is soft too: both curves flatten.
- **Learning:** monsters gain teachings over their lives (an old ogre has more swing patterns). Fight a monster that uses a teaching often enough and you can learn it yourself (→ CHR teachings).

## Breeding and density

- Each species has a breeding season, litter size, gestation time and territory size.
- **Density pressure:** when local population exceeds what the territory can hold, monsters spread into neighboring chunks, become more aggressive, and push other species out.
- **Areas can become unapproachable.** High density means constant aggro chains, and NPCs reroute trade and abandon farms (→ NPC).
- **Predator-prey:** species have diets. Wolves hunt rabbits, bears take wolves, and some species fight over territory. Kill all the predators and the prey explodes in number.

## What pushes back

- NPC factions: hunters, guards and settlements that cull nearby threats (→ NPC).
- Monster wars: competing species fight over territory.
- Players.
- **Civilization anchors** (graves, lit beacons, villages and cities): see "The tug of war" below (OQ-044).
- **Nothing**, in which case the area spreads. An overrun area spawns a **territory boss**: an exceptional, old, high-level individual that anchors the region until killed.

## The tug of war (OQ-044)

Monster spread (density pressure and overrun areas above, settlement death in 06-npcs-society) is only one side of a back and forth.

- **Civilization anchors** are graves, lit beacons and waystones (→ 02-world), villages and cities (→ 06-npcs-society). They push back against monsters spreading and taking over settlements.
- Where nobody holds the line, the monsters push civilization back: spread continues, settlements are overrun and become ruins.
- A **dungeon break** (OQ-046, → 07-dungeons) is a sudden push from the monster side: a flood around a dungeon that ate too many deaths.
- Which side wins is decided by skill and preparation. Lucid: "a proper back and forth … like a tug of war".
- How an anchor resists (its reach, its strength, and its effect on density pressure and territory-boss emergence) is decided in NPC-023. Balancing comes later.

## Variants and mutations

- **Aging variants** are cosmetic plus stat curves: grey, scarred, one-eyed, battle-worn, lean, bulky.
- **Rare mutations** (≈1 in several hundred births, tunable) bring an altered color, an extra property (venomous, armored, glowing) and a better drop table. Mutations can pass to offspring.

## Flyers

- The sky isn't empty. Birds, giant insects and winged beasts patrol above.
- The camera never looks up, so flyers in the air are drawn **only as their ground shadow**.
- **Shadow telegraph:** when a flyer dives, its shadow shrinks and sharpens, then the sprite drops in. That gives a readable window to dodge. Ranged weapons can hit flyers while they're on their attack pass.

## Overworld drops

Overworld mobs give **experience and materials**, not equipment loot (equipment loot comes from dungeons and rifts).
- **Materials** (hides, bones, fangs, essences) feed crafting and city economies (→ ITM).
- **Territory and reputation:** culling an area can satisfy NPC quests and raise standing with nearby settlements (→ NPC).
- **Ecology:** every kill changes local population, which is the main lever players have on the world.

## Tasks

- [ ] **ECO-001** `[proto]` Monster entity: species, age, level, HP, simple wander/aggro/flee AI.
- [ ] **ECO-002** `[proto]` Age → stat curve per species, with a soft cap and natural death.
- [ ] **ECO-003** Age stages with behavior changes (young flee, prime defend, old territorial).
- [ ] **ECO-004** Breeding: season, gestation, litter size, offspring placement near den.
- [ ] **ECO-005** Territory and density pressure; spillover into neighboring chunks.
- [ ] **ECO-006** Diet and predator-prey interactions between species.
- [ ] **ECO-007** Interspecies territory fights.
- [ ] **ECO-008** Monster teachings: learned over lifetime and used in combat (→ CHR-014).
- [ ] **ECO-009** Territory boss emergence in overrun regions.
- [ ] **ECO-010** Aging visual variants hooked to the paper-doll/sprite system (→ ART-012).
- [ ] **ECO-011** Rare mutations: roll on birth, heritable, visual + stat + drop effects.
- [ ] **ECO-012** Flyers: altitude state, shadow-only rendering, dive attack with shadow telegraph.
- [ ] **ECO-013** Nocturnal and diurnal activity schedules.
- [ ] **ECO-014** Overworld drop tables: XP + materials only.
- [ ] **ECO-015** Warm-zone ecology in the coarse sim: population, births, deaths, migration as statistics (→ WLD-012).
- [ ] **ECO-016** Dens and nests as persistent structures that monsters return to.
- [ ] **ECO-017** Seasonal migration paths.
