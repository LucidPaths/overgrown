# 07 — Dungeons & Rifts

Dungeons and rifts are the same thing in two settings. This is where equipment loot and Ability Books come from, so they're the main farm for builds.

| | **Dungeon** | **Rift** |
|---|---|---|
| Where | Inside or beside every midsize city or larger | Appears at random in the wild |
| Upper floors | Stable, with shops, amenities and services run by NPCs | Stable but wild: no shops |
| Deeper floors | Procedural, rerolled on each entry | Procedural, rerolled on each entry |
| Lifecycle | Permanent | Grows over time, leaks monsters, can be sealed |

## Floors

- **Fixed top:** the first few floors (≈3, tunable per site) have a layout fixed by the world seed, so they can be learned and mapped. In city dungeons these upper floors host the business: merchants, an Ability Book shop, a healer, a smith, a tavern and a stash. Cities profit from their dungeon.
- **Procedural deep:** below that, every floor is generated fresh on each entry. Each floor deeper raises monster level and loot quality.
- **Checkpoints:** every N floors (≈5) a stable checkpoint lets you leave and return to that depth later.

## Loot

- Dungeon monsters drop **equipment** with rarity and affixes (→ ITM), **Ability Books**, consumables and some materials.
- Ability Book drop odds and tiers scale with depth.
- Overworld mobs never drop equipment (→ ECO); only dungeons and rifts do.

## Death in a dungeon

A death in a dungeon or rift follows OQ-045. It costs **no XP and no levels**.

- You're teleported to the dungeon entrance.
- **A sealed ability:** one of your abilities (or draft picks) is sealed until a church or healer NPC unseals it (→ 06-npcs-society). Which one, and what unsealing costs, is decided in CHR-024.
- **The world gets harder:** the death raises the world's difficulty level for everyone in that world, and it never goes back down (→ 02-world). What it scales and by how much is decided in WLD-025.
- **The dungeon ate you:** each death also raises that dungeon's **difficulty tier** for everyone in that world. Its monsters level up and its floors get nastier. This rule is unchanged.
- Difficulty tiers decay slowly over time, and clearing deep floors pushes them back down faster. This is also unchanged, and it applies to the dungeon's tier only: the world difficulty never decreases.
- There is no death limit per character.
- NPCs that adventure in dungeons follow the same rule (pillar 1); whether their deaths raise the world difficulty is decided in WLD-025.

## Rift lifecycle

1. **Opens** at a seeded or random site, starting shallow.
2. **Grows** over time: more floors, stronger monsters.
3. **Leaks:** uncleared rifts spawn monsters into the surrounding chunks, raising local density (→ ECO-005).
4. **Sealed** by clearing its deepest floor. The rift closes and leaves materials and a reward cache.
5. **Settled** if instead NPCs build around a stable rift (low leak, close to a settlement): over time it becomes a city dungeon and the settlement grows around it.

## Tasks

- [ ] **DNG-001** `[proto]` Dungeon instance: entrance, separate map, return to overworld.
- [ ] **DNG-002** `[proto]` Procedural floor generator (rooms, corridors, stairs) from seed + depth + entry nonce.
- [ ] **DNG-003** Fixed upper floors from world seed.
- [ ] **DNG-004** Upper-floor NPC services in city dungeons: shops, Ability Book shop, healer, smith, stash.
- [ ] **DNG-005** Depth scaling: monster level and loot quality per floor.
- [ ] **DNG-006** Checkpoints every N floors.
- [ ] **DNG-007** Dungeon drop tables: equipment, Ability Books, consumables.
- [ ] **DNG-008** Death → teleport to the entrance; the seal and the difficulty rises are in CMB-021 (rewritten: OQ-045 replaced the XP loss) (→ CMB-021).
- [ ] **DNG-009** Dungeon difficulty tier: rises on deaths, decays over time, drops on deep clears.
- [ ] **DNG-010** Rift spawning in the overworld.
- [ ] **DNG-011** Rift growth over time.
- [ ] **DNG-012** Rift leaking monsters into surrounding chunks.
- [ ] **DNG-013** Rift sealing on clearing the deepest floor; reward cache.
- [ ] **DNG-014** Rift settlement → becomes a city dungeon (→ NPC-008).
- [ ] **DNG-015** Multiplayer in dungeons: party members enter the same instance.
