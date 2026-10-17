# ART-025 art lab: the pixel diorama

The world is real low-poly 3D, built from the seed and lit by one sun. It is drawn into a buffer where one texel is
one world pixel, outlined, and scaled up by a whole number. It reads as pixel art and behaves like a place: light,
wind, water, time of day, lanterns, and hits that spark. Every image here comes from code in `art-lab/`; there
are no asset files.

| Document | What it is |
|---|---|
| [DIRECTION.md](DIRECTION.md) | The art bible: philosophy, pipeline, rules, recipes. |
| [INTEGRATION.md](INTEGRATION.md) | What bringing it into the game takes, with measured numbers. |
| [EXPLORATION.md](EXPLORATION.md) | The directions I tried and killed. |
| [RESEARCH.md](RESEARCH.md) | Sources and what I took from each. |
| [PROGRESS.md](PROGRESS.md) | The work log. |
| [`art-lab/README.md`](../../../art-lab/README.md) | How to run the prototype. |

## Start here

![day, desktop 1280x720](img/desktop-day.png)
*The live prototype at 1280x720 (3 device px per texel), seed 22 spawn: meadow, river and forest. A foxfolk player
(centre) and NPCs of every species run on the real sim systems. The orc and lizardfolk next to the player are a sparring pair.*

![night](img/desktop-night.png)
*The same place at 22:00: moonlight, the player's lantern and a few NPC lanterns (stepped light pools), fireflies.*

![live fight](img/motion-live-fight.png)
*A fight in the live game, eight frames about 0.25 s apart, unscaled crops. The scripted player swings into a
sparring pair, gets hunted, rolls and swings again. Note the hit sparks, the slash ribbon, the foliage cutaway
around the player (a hole with a dithered rim), and the wading splashes.*

## The prototype at real size

| Desktop 1280x720 | |
|---|---|
| ![dawn](img/desktop-dawn.png) | ![dusk](img/desktop-dusk.png) |
| dawn 06:24 | dusk 18:18 |

| Phone 390x844 (DPR 3, shown at CSS size; 1 texel = 2 px) | |
|---|---|
| ![phone day](img/phone-day.png) | ![phone night](img/phone-night.png) |

The phone shows the touch controls: a floating stick on the left half, attack and roll buttons on the right.

## Biomes and borders

![forest river meadow](img/biome-border-forest-river-meadow.png)
*Forest | river | meadow. Grass colour comes from the continuous worldgen fields, so the forest floor darkens into
the meadow without a seam. The river has a sand bank, reeds, lily pads, flow and foam.*

![forest](img/biome-forest.png)
*Forest: oaks, pines, birches, ferns, red mushrooms (they glow teal at night), logs and stumps on a darker floor
with leaf litter.*

![coast](img/biome-coast.png)
*Ocean coast: depth bands with dithered steps, a breathing foam rim, a broken second wave line, wind-rippled
sand, driftwood, shells and dry grass.*

![highlands](img/biome-highlands-border.png)
*Mountain highlands at the meadow border: weathered slabs, alpine grass in hollows, snow-dusted pines. The sim's
Cliff tiles become a ridge of rock columns, and the sim's gaps in the ridge read as passes.*

![snow](img/biome-snow-ridges.png)
*High mountains (seed 4): the snow line with a dithered edge, basalt-column ridges with snow caps, snowy boulders.*

![wide](img/world-wide-1x.png)
*1 texel = 1 px over about 80x57 tiles: the "300th tree" check. Groves cluster, no stamp repeats, and the biome
borders blend.*

## Species

![lineup](img/species-lineup.png)
*Nine species on one 13-bone rig, front, three-quarter and back (scale 4). Left to right: human, elf, dwarf, orc,
foxfolk, bearfolk, rabbitfolk, birdfolk, lizardfolk. Silhouette first: ears, snout, tail and proportions name
each one.*

![lineup at game scale](img/species-lineup-1x-game-scale.png)
*The same lineup at a smaller scale (2 px per texel) on a 1280x200 strip.*

## Motion

All clips are procedural and pure functions of time. Their timing comes from the sim's action durations.

![walk](img/motion-walk.png)
*Walk, 8 phases (human, foxfolk, rabbitfolk). Ears and tails lag behind the bob.*

![run](img/motion-run.png)
*Run, 8 phases (elf, bearfolk, lizardfolk), side view.*

![attack](img/motion-attack.png)
*Attack over the sim's 0.4 s. Wind-up, the strike (the hit lands at 37.5 %), hold and recover. The sword traces
a dithered slash ribbon; the spear thrusts.*

![dodge](img/motion-dodge.png)
*Dodge roll over 0.35 s: crouch, tuck, a full roll about the body centre with a hop, land.*

![hurt and death](img/motion-hurt-death.png)
*Top: hurt (a white flash, snap back, recover). Bottom: death (buckle, fall back, bounce, stay, legs in the air).*

## Discarded explorations

See [EXPLORATION.md](EXPLORATION.md) for why each one died.

| | |
|---|---|
| ![paper](img/explore-paper.png) Paper theatre | ![ink](img/explore-ink.png) Ink and wash |
| ![voxel](img/explore-voxel.png) Voxel diorama | ![v1](img/explore-diorama-v1.png) The diorama's first frame |
| ![no lean](img/explore-no-lean-no-tilt.png) No lean, no tilt: hats, not faces | ![flagstone](img/explore-flagstone-mountain.png) Flagstone mountains |
| ![v1 mountain](img/explore-diorama-v1-mountain.png) First mountain: a grey plain | |

## What is not built yet

- Gear layers, aging and scars on the rig. The rules for them are in DIRECTION.md §3.
- Monsters and other body plans.
- Weather (rain, snow fall) and seasons.
- UI beyond the touch buttons.
- Real-phone performance checks.

The two biggest open problems are the prop vertex budget on low-end phones and moving chunk building off the
main thread (INTEGRATION.md).
