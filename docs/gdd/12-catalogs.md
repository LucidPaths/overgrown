# 12 — Content Catalogs (DRAFT)

> **Status: first-pass draft by Claude, for Lucid to edit.** Names are working names. Strike, rename, add freely. Numbers come later, in data files.

## Species (sapient, playable)

Each species has 2 **innate abilities** nobody else can learn.

| Species | Feel | Innate abilities |
|---|---|---|
| Humans | Adaptable, everywhere | *Quick Study* (all trait XP +10%) · *Second Wind* (once per day, refill stamina at low HP) |
| Elves | Forest, long-lived | *Keen Sight* (larger sight radius at night) · *Light Step* (no footstep noise on grass and forest floor) |
| Dwarves | Mountain, craft | *Stonesense* (see ore veins through walls) · *Sturdy* (reduced knockback) |
| Orcs | Badlands, raiders and traders | *Bloodrush* (damage up while below 30% HP) · *Thick Hide* (bleed immune) |
| Foxfolk | Meadow tricksters | *Feint* (dodges leave a decoy) · *Silver Tongue* (haggling starts higher) |
| Bearfolk | Forest, big and slow | *Hibernate* (sleeping heals fully and fast) · *Maul* (bare-hand heavy attack that scales) |
| Rabbitfolk | Grassland, fast and timid | *Burrow Dash* (dodge distance +50%) · *Big Ears* (hear unseen enemies; minimap pings) |
| Birdfolk | Cliffs and coast | *Glide* (glide down from heights, cross gaps) · *Sky Eye* (see flyer shadows from further away) |
| Lizardfolk | River and swamp | *Gills* (breathe underwater) · *Cold Blood* (slow in cold, regen in heat) |

## Monster societies (NPC-only clades)

Goblins (scavenger camps, love corpses) · Ogres (strongholds, heavy-swing teachers) · Gnolls (pack raiders) · Kobolds (miners, trap makers). These start as camps that grow into villages (→ NPC-014).

## Weapons

| Family | Types | Basic attack | Mastery trait |
|---|---|---|---|
| Blades | dagger, shortsword, longsword, greatsword | fast arcs; dagger stabs | Blade Mastery |
| Blunt | club, mace, hammer, maul | slow, heavy, stagger | Blunt Mastery |
| Axes | hatchet, battleaxe, greataxe | wide arc, chops props fast | Axe Mastery |
| Polearms | spear, halberd, pike | long reach, thrust or sweep | Polearm Mastery |
| Bows | shortbow, longbow | charged shot | Archery |
| Crossbows | light, heavy | slow reload, high pierce | Crossbow Mastery |
| Throwing | knives, javelins, bombs | quick throws | Throwing |
| Shields | buckler, round, tower | block, parry, bash | Shield Mastery |
| Magic foci | staff, wand, tome | element bolt from the focus's element (fire, frost, stone, storm, life, shadow) | Staff / Wand / Tome Mastery |

## Traits (grow by use)

- **Weapon:** one mastery per family above.
- **Movement:** Dodging · Sprinting · Swimming · Climbing · Jumping · Riding
- **Magic:** Mana Flow (regen) · Channeling (cast speed) · Attunement per element
- **Survival:** Perception · Tracking · Sneaking · Foraging · Fishing
- **Craft:** Smithing · Leatherworking · Tailoring · Alchemy · Cooking · Woodworking · Enchanting · Salvaging
- **Social:** Haggling · Persuasion · Intimidation · Leadership (party buffs) · Teaching (NPCs learn from you)
- **Beast:** Taming · Beast Lore (see monster info) · Butchering (material yield)

## Abilities (Ability Books)

| School | Abilities |
|---|---|
| Martial | Whirlwind · Leap Strike · Ground Slam · Rending Combo · Shield Charge · War Cry |
| Ranged | Rain of Arrows · Piercing Shot · Snare Trap · Volley |
| Fire | Fireball · Flame Wall · Ignite Weapon · Meteor (deep) |
| Frost | Ice Lance · Frost Nova · Freeze River · Blizzard (deep) |
| Stone | Stone Skin · Earth Spike · Boulder Throw · Quake (deep) |
| Storm | Chain Lightning · Static Dash · Thunder Call |
| Life | Mend · Regrowth · Purify · Revive (deep; respawn worlds only?) |
| Shadow | Blink · Shadow Cloak · Life Drain · Fear |
| Utility | Light · Recall (return to bed) · Featherfall · Waterwalk |

## Teachings (from NPCs or by fighting their users)

| Teaching | Learned from | Requires |
|---|---|---|
| Heavy Overhead | Ogres | Blunt or axe |
| Quickdraw | Hunters, archers | Bow |
| Multishot | Elite archers | Bow, Archery rank |
| Silent Run | Assassins | Sneaking rank |
| Pounce | Big cats | Dagger or bare hands |
| Pack Howl | Wolf alphas | Leadership rank (buffs allies) |
| Shield Wall | Town guards | Shield |
| Riposte | Duelists | Blade, parry |
| Tail Sweep | Lizard beasts | Polearm or staff |
| Dive Strike | Raptors (flyers) | Jumping rank |
| Charge | Boars, bulls | Any melee |
| Feign Death | Opossum-likes, rogues | Sneaking rank |

## Biomes (launch)

| Biome | Notable life | Materials |
|---|---|---|
| Grassland | horned bunnies, wild horses, boars, wolves, hawks (flyers) | fiber, hide, herbs |
| Forest | deer, wolves, bears, giant beetles, owls (flyers), forest spirits | wood, hide, sap, mushrooms |
| River | otters, river serpents, frogs, dragonflies (flyers) | fish, clay, reeds |
| Mountains | goats, mountain trolls, rock crawlers, eagles and wyverns (flyers) | ore, stone, gems |
| Ocean | crabs, sea serpents (deep), gulls (flyers), leviathans (very deep) | fish, shells, pearls |

Later: swamp, tundra, desert/badlands, volcanic.

## Crafting stations

Workbench (basic; camp-capable) · Forge · Tannery · Loom · Alchemy Table · Cooking Fire (camp-capable) · Enchanting Table · Boatwright Dock.

## Tasks

- [ ] **CAT-001** Lucid review pass over this catalog; strike/rename/add.
- [ ] **CAT-002** Data schema + files for species and innate abilities.
- [ ] **CAT-003** Data files for weapon families and types.
- [ ] **CAT-004** Data files for traits.
- [ ] **CAT-005** Data files for abilities.
- [ ] **CAT-006** Data files for teachings.
- [ ] **CAT-007** Data files for monster species: diet, lifecycle, breeding, territory, teachings, drops.
- [ ] **CAT-008** Data files for biomes: spawn tables, materials, palettes, weather tables.
- [ ] **CAT-009** Data files for crafting stations and recipes.
