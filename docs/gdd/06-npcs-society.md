# 06 — NPCs & Society

NPCs are the foreground. The player character is just one more person walking around.

## NPC life sim (hot zone)

Each NPC has:
- **Species, age, home, job, faction**, and the same trait, ability and teaching system players use (→ CHR). NPCs level, learn, carry and use gear.
- **Needs:** food, rest, safety, income. **Routines:** work, eat, sleep, socialize, follow a schedule by job.
- **Relationships:** family, friends, rivals, plus personal opinion of each player.
- **Memory:** recent notable events (saw a murder, was helped, lost a relative).

In warm zones, NPCs collapse into **settlement statistics** (headcount by job, food stock, defense, morale, wealth) that update at coarse ticks (→ WLD-011).

## Death and succession

- **Dead is dead**, for NPCs exactly as for players.
- **Successors keep continuity:** when an NPC with a role dies (merchant, smith, teacher, quest-giver), the settlement fills the role from its population or through migration. The new holder is a different person with their own traits and opinions.
- Rare authored NPCs follow the same rule, and their successor inherits the role.

## Settlements

- Sizes: hamlet → village → town → city. They grow with food, safety and trade, and shrink without them.
- **Every midsize city or larger has at least one dungeon** (→ DNG).
- **Settlements can die.** Overrun by monsters, starved or abandoned, they become ruins that monsters move into.
- **Church and healer NPCs unseal abilities** that a dungeon death sealed (OQ-045), for players and NPCs alike (pillar 1). What unsealing costs is decided in CHR-024.
- **Migration:** when a settlement thins out, its NPCs pack up and travel to the nearest larger settlement. Migration caravans are slow, valuable and easy prey for monsters and rogues, so escort quests pay well.

## The tug of war (OQ-044)

Settlements are one of the **civilization anchors**, along with graves and lit beacons (→ 02-world, 08-items-economy). Anchors push back against monsters spreading and taking over settlements (→ 03-ecology). Where nobody holds the line, the monsters push civilization back, and settlements die and become ruins (see Settlements above).

- It is a back and forth decided by skill and preparation. Balancing comes later.
- **Open point (pillar 1):** by one rule set, notable NPC deaths could leave graves that anchor civilization too. Whether they do, and which NPCs count as notable, is decided in NPC-023.
- How an anchor resists, and how a settlement counts as one, is decided in NPC-023.

## Factions and diplomacy

- Factions come per settlement, per species, and as cross-cutting groups (guilds, bandits, cults).
- **Dynamic diplomacy:** relations shift with sim events such as trade, border incidents, monster threats, murders and aid. Factions can ally, trade, embargo or go to war.
- **Monster societies:** some monster clades build camps that grow into villages and, if left unchecked, into real settlements with their own roles. They take part in diplomacy too, so not every goblin camp wants a fight.

## Reputation and crime

- Reputation is per character per faction, earned through quests, trade, culling threats and helping.
- **Witness system:** crimes (murder, theft, assault) only count when an NPC witnesses them, and the witness has to survive and reach a settlement to report it.
  - A merchant killed in the middle of nowhere with nobody around goes unreported.
  - Witnesses can be intimidated, bribed or silenced, which is itself a crime if someone sees it.
- **Bounties:** reported crimes create bounties. Guards hunt you inside their faction's territory; NPC bounty hunters, and players, can track you outside it.
- Reputation dies with the character.

## Quests

- **Generated from sim state** (the default): a village losing hunters to wolves posts a cull job; a smith short on iron posts a materials request; a migrating family needs an escort; a faction at war hires mercenaries.
- **Rare authored quests** for special NPCs, territory bosses and rare finds.
- Quests resolve through the sim. Killing the wolves actually lowers the wolf population, which is what completes the quest.

## Tasks

- [ ] **NPC-001** `[proto]` NPC entity on the shared character core (→ CHR-001), with home and job.
- [ ] **NPC-002** Needs and daily routines by job, driven by the world clock.
- [ ] **NPC-003** NPC trait growth by doing, same code path as players.
- [ ] **NPC-004** NPC combat AI that uses gear, abilities and teachings.
- [ ] **NPC-005** Relationships and per-player opinion.
- [ ] **NPC-006** Event memory (witnessed events with decay).
- [ ] **NPC-007** Settlement statistics model for warm zones (→ WLD-012).
- [ ] **NPC-008** Settlement growth and decline: hamlet → city and back.
- [ ] **NPC-009** Settlement death → ruins, and monster occupation.
- [ ] **NPC-010** Role succession when a role-holding NPC dies.
- [ ] **NPC-011** Migration: caravans to the nearest larger settlement, simulated travel and ambush.
- [ ] **NPC-012** Factions: membership, relations matrix.
- [ ] **NPC-013** Dynamic diplomacy: events shift relations; alliance, trade, embargo, war.
- [ ] **NPC-014** Monster societies: camps that grow into settlements (→ ECO).
- [ ] **NPC-015** Reputation per character per faction.
- [ ] **NPC-016** Witness system: line-of-sight crime detection, witness must survive and reach a settlement to report.
- [ ] **NPC-017** Bribing and intimidating witnesses.
- [ ] **NPC-018** Bounties: guard pursuit in territory, NPC bounty hunters outside it.
- [ ] **NPC-019** Generated quests from sim state (cull, gather, escort, deliver, defend).
- [ ] **NPC-020** Quest resolution via actual sim change (kill counts against real population).
- [ ] **NPC-021** Authored quest support for special NPCs and bosses.
- [ ] **NPC-022** Dialogue system: talk, trade, learn, quest, bribe.
- [ ] **NPC-023** Civilization anchors versus monster takeover (the tug of war): graves, lit beacons and settlements resist monster spread and settlement takeover, and monsters push civilization back where nobody holds the line; includes the open point on graves from notable NPC deaths (OQ-044) (→ ECO-005, ECO-009, NPC-008, NPC-009, ITM-019, WLD-024).
