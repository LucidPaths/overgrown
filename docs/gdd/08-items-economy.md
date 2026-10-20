# 08 — Items & Economy

## Two sources of gear

1. **Crafted base gear:** made from overworld materials. Quality depends on material grade and the crafter's crafting trait.
2. **Dungeon loot:** rolled with rarity and random affixes (Diablo-style). Usually stronger, and rarer at depth.

They feed each other. Crafters can **reforge** (reroll an affix) and **upgrade** dungeon gear with materials, so overworld hunting stays relevant for endgame builds.

## Rarity and affixes

- Common → Uncommon → Rare → Epic → Legendary (names tunable). Higher rarity means more affix slots.
- Affixes cover damage range, attack speed, element damage, resistances, stamina/mana costs and regen, trait XP gain, ability modifiers, teaching modifiers and utility (light radius, swim speed).
- **Legendaries** carry one unique property each, such as "dodges leave a fire trail".

## Materials

- Come from overworld creatures (hides, bones, fangs, essences, scales), gathering (wood, ore, herbs, fiber) and corpses of naturally dead monsters.
- Grade depends on the creature's age and level: an old prime bear's hide is better than a cub's. That ties crafting back to ecology.
- **Mutation materials** from rare variants enable special recipes and affixes.

## Crafting

- **Recipe + station + trait.** You need to know the recipe, use the right station, and the crafting trait determines quality and failure chance.
- Recipes come from NPC teachers, books, quest rewards, and from **salvaging** items (a chance to learn the item's recipe).
- Stations: workbench, forge, tannery, loom, alchemy table, cooking fire, enchanting table (→ CAT stations). Stations exist in towns (rentable) and at camps (basic ones only).

## Trade

- **NPC merchants:** barter or coin. The haggling trait improves prices, and reputation with the merchant's faction matters.
- **Dynamic prices:** each settlement tracks supply and demand per good. Flooding a town with wolf pelts crashes the price; a war spikes weapon prices. Caravans move goods between settlements in the sim.
- **Player stalls:** players can rent a stall in a city (Metin2-style) and set prices. A player can **hire an NPC clerk** who keeps selling while the owner is offline or in another world. The clerk is a real NPC: paid wages, can be robbed, can die.
- **Currency:** one coin currency everywhere.

## Graves

- Every death leaves a **grave**: the corpse container of the earlier drafts, with the full inventory. The corpse rules are otherwise unchanged, and "corpse" and "grave" name the same container.
- **Anyone** can loot it: any character (including the dead character's next one), other players, NPCs (scavengers, bandits) and some monsters (shiny-hoarding species).
- Graves decay after a long time (tunable), and whatever is left becomes a loot cache at the site.
- A grave also becomes a **landmark that acts as a civilization anchor** (whether NPC graves anchor too is decided in NPC-023), and one heirloom (or a bit of power) from the dead character passes to the next (OQ-044, → 04-characters, 06-npcs-society). Whether the landmark outlasts the decay of the container, what the heirloom is, and whether NPCs leave heirlooms are decided in ITM-019.

## Tasks

- [ ] **ITM-001** `[proto]` Item data model: base type, family, damage range, slots, affixes, rarity.
- [ ] **ITM-002** `[proto]` Inventory grid and equip flow.
- [ ] **ITM-003** Affix pool and rarity roller.
- [ ] **ITM-004** Legendary unique-property framework.
- [ ] **ITM-005** Materials with grade from creature age/level (→ ECO-002).
- [ ] **ITM-006** Gathering nodes: wood, ore, herbs, fiber.
- [ ] **ITM-007** Recipe system: known recipes per character.
- [ ] **ITM-008** Crafting stations and crafting UI.
- [ ] **ITM-009** Crafting quality and failure from the crafting trait.
- [ ] **ITM-010** Salvaging with a chance to learn recipes.
- [ ] **ITM-011** Reforging and upgrading dungeon gear with materials.
- [ ] **ITM-012** NPC merchant trade: coin + barter, haggling trait.
- [ ] **ITM-013** Settlement supply/demand price model.
- [ ] **ITM-014** Caravan goods transfer between settlements in the sim (→ NPC-011).
- [ ] **ITM-015** Player stalls: rent, list, sell while present.
- [ ] **ITM-016** Corpse decay into loot caches (→ CMB-020).
- [ ] **ITM-017** Scavenger NPCs and hoarding monsters loot corpses.
- [ ] **ITM-018** Hired NPC stall clerks: wages, selling while the owner is away, payouts on return; clerk is a full NPC (→ NPC-001).
- [ ] **ITM-019** Grave landmark plus heirloom: the grave becomes a landmark that acts as a civilization anchor, and one heirloom (or a bit of power) passes to the next character (OQ-044); whether NPCs leave heirlooms is decided here (→ CMB-020, NPC-023, CHR-023).
