# 02 — World

## Shape

- **Infinite, chunk-generated, from a seed.** Chunks are 32×32 tiles at 16 px per tile on the ground grid, while characters are 32×32 px sprites (→ ART). Chunks generate when first approached and are deterministic from seed + chunk coordinates.
- Infinite only works if moving across it means something (the Cube World lesson). Distance, local ecology and time all change what you meet. New ground always offers new dungeons, cities, bosses and biomes.

## Biomes

Biomes are about **place, not difficulty**. Any biome can hold weak and strong creatures side by side.

Launch set:
- **Grassland / meadow:** spawn-friendly, open, readable.
- **Forest:** cover, dens, falling trees.
- **River:** crossings, fishing, swimming.
- **Mountains:** cliffs, caves, cold peaks. Cliffs are blocking cliff tiles on steep elevation, drawn with a 3/4 rock face; there are no height levels (OQ-018).
- **Ocean:** coastlines, boats, deep-water monsters.

Later: swamp/marsh, tundra, desert/badlands, volcanic (→ CAT biomes).

## Difficulty

Difficulty is a property of **individual creatures**, not of biomes or rings:

```
creature_level ≈ f(species base, age, local density pressure, distance from world origin)
```

- **Distance from origin** shifts the *distribution* of levels upward. Near spawn it's mostly low with rare high outliers; far out it's mostly high. The meadow near spawn can still hold a sleeping level 40 bear.
- **Local density and age** add to it: an unchecked area becomes nastier over time (→ ECO).
- Whether a creature's level is visible depends on the observer's perception trait (→ CHR, UIX).

## Time

- **One in-game day = 60 real minutes**: 30 min of daylight, 30 min of night.
- **The world clock only runs while at least one player is in the world**, in solo and multiplayer alike. With nobody playing, nothing happens.
- **Sleep:** lying in a bed or camp bedroll at night fast-forwards to morning. In multiplayer, every player present has to be sleeping. Fast-forward runs the simulation at coarse LOD, so monsters still age and breed during the skipped hours.
- **Night** brings different monster activity (nocturnal species, more aggression), plus reduced sight radius and stronger lighting effects.

## Simulation level of detail

| Zone | What runs | Tick |
|------|-----------|------|
| **Hot** (≈ 2 screens around any player) | Every entity simulated individually: AI, needs, combat, aging | 20 Hz |
| **Warm** (previously visited, not near players) | Region statistics: population per species, age distribution, density trend, settlement food/defense/headcount | ≤ 1 Hz, batched |
| **Cold** (never visited) | Nothing; generated from seed on first approach, with a short catch-up history pass so it looks lived-in | — |

When a warm region turns hot, its statistics get **materialized** back into individual entities consistent with those stats. When it cools, individuals get **summarized** back into statistics. The pattern is STALKER's A-Life.

## Weather and seasons

These are the main source of "feel", so give them real visual budget.

- **Weather:** clear, cloudy, rain, storm, fog, snow (biome and season dependent). Weather affects visibility, sound, monster behavior and some traits (e.g., tracking in rain).
- **Seasons:** spring, summer, autumn, winter, one season = 7 in-game days (tunable).
  - Spring: breeding season for most species.
  - Autumn: migrations and stockpiling.
  - Winter: food scarcity. Predators push into settlements and rivers freeze.
- The visuals change per season: palette shifts, foliage, snow cover, particles.

## Water

- Shallow water is walkable at reduced speed. Deep and very deep water block movement until swimming exists (WLD-017). Rivers are mostly shallow, with deep water only in wide stretches and seeded fords, so a spawn can't be enclosed (OQ-019).
- Swimming drains stamina. If stamina runs out you take drowning damage.
- Boats can be crafted or bought, used for river and ocean travel.
- Deep water holds monsters. You can try to swim across the ocean. Good luck.

## Props and environment

- Destructible props: trees, rocks, fences, crates, ice.
- Falling or thrown props deal damage to whatever they hit, players included. A big mob can knock a tree onto you.
- Terrain itself is not editable (no digging or terraforming).

## Tasks

- [ ] **WLD-001** `[proto]` Chunk generator: seed + coordinates → tile layer (deterministic, tested).
- [ ] **WLD-002** `[proto]` Biome map from layered noise (temperature, moisture, elevation); grassland, forest, river, mountain, ocean.
- [ ] **WLD-003** `[proto]` Chunk streaming: load and unload around players; cache generated chunks.
- [ ] **WLD-004** `[proto]` Tile collision and walkability; water depth layer; cliff tiles block, shallow water slows, deep water blocks (OQ-018, OQ-019).
- [ ] **WLD-005** River and coastline generation that stays continuous across chunk borders.
- [ ] **WLD-006** Structure placement: settlements, dens, dungeon sites, rift sites (seeded, with minimum spacing).
- [ ] **WLD-007** Creature level distribution as a function of distance from origin, plus local modifiers.
- [ ] **WLD-008** World clock: 60-minute day, pauses with zero players, persists in the save.
- [ ] **WLD-009** Day/night lighting and darkness radius.
- [ ] **WLD-010** Sleep: bed interaction, all-players-sleeping check, fast-forward at coarse sim.
- [ ] **WLD-011** Sim LOD scheduler: hot, warm, cold zones and their tick rates.
- [ ] **WLD-012** Region statistics model (per species population, age histogram, density trend).
- [ ] **WLD-013** Materialize and summarize between region statistics and entities.
- [ ] **WLD-014** Cold-region catch-up history pass on first visit.
- [ ] **WLD-015** Weather system: states, transitions, per-biome tables.
- [ ] **WLD-016** Seasons: calendar and the effects hooks for breeding, migration and scarcity.
- [ ] **WLD-017** Swimming: stamina drain, drowning damage, deep-water spawns.
- [ ] **WLD-018** Boats: crafting/buying, boarding, steering, damage.
- [ ] **WLD-019** Destructible props with HP, break states and drops.
- [ ] **WLD-020** Falling-prop physics: trees topple in the direction they were hit and deal damage on impact.
- [ ] **WLD-021** Frozen rivers in winter (walkable ice that can crack).
- [ ] **WLD-022** Chunk retention: drop visited chunks that have no lasting changes and regenerate them from the seed on revisit; region sim statistics are kept.
