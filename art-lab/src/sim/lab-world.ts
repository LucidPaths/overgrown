// The lab's simulation: the real sim systems (spawnCharacter, the input latch, stepActions, stepMovement, the chunk
// store, findSpawn, slideMove) plus three lab-only stand-ins for systems the game doesn't have yet, each marked:
//  - NPC brains that write Intent exactly as a player's input does (stand-in for NPC-001);
//  - a hit check that starts Hurt and Death (stand-in for the CMB tasks);
//  - prop collision: trees and boulders block their tile by reading as Cliff (stand-in for WLD props in the sim).
// Browser-free: runs in the lab's Web Worker and in Node.
import { stepActions } from "../../../sim/src/actions";
import { IntentButton, createCharacterWorld, spawnCharacter } from "../../../sim/src/character";
import { TICK_HZ } from "../../../sim/src/constants";
import { World, type EntityId } from "../../../sim/src/ecs";
import { assertInputMessage, createInputLatch, latchInput } from "../../../sim/src/input";
import { facingToward, stepMovement } from "../../../sim/src/movement";
import { Action, Species, type ChunkStreamMessage, type InputMessage, type Snapshot, type SpeciesValue } from "../../../sim/src/protocol";
import { Rng, deriveSeed } from "../../../sim/src/rng";
import { createChunkStore, type AnchorPos } from "../../../sim/src/world/chunk-store";
import { slideMove } from "../../../sim/src/world/collision";
import { findSpawn } from "../../../sim/src/world/spawn";
import { Tile, type TileValue } from "../../../sim/src/world/tile";
import { TILE_RULES } from "../../../sim/src/world/walkability";
import { FACING_UNIT } from "../../../sim/src/actions";
import { Ground } from "../world/ground";
import { clearings, propBlocks } from "../world/placement";

export const HURT_TICKS = 6;
const REACH = 26; // px from the feet point
const HIT_TICK = 3; // ticks into an attack when the blade crosses (matches the strike beat in anim.ts)
const MAX_HP = 4;
const RESPAWN_TICKS = 8 * TICK_HZ;

/** The spawn plus the clearing around it; both threads call this so their prop placement agrees. */
export function labSpawn(seed: number, ground: Ground): { x: number; y: number } {
  const sp = findSpawn(createChunkStore(seed, (_s, cx, cy) => ground.chunk(cx, cy)));
  const tx = Math.floor(sp.x / 16), ty = Math.floor(sp.y / 16);
  if (!clearings.some((c) => c.tx === tx && c.ty === ty)) clearings.push({ tx, ty, r: 2 });
  return sp;
}

type Brain =
  | { kind: "wander"; homeX: number; homeY: number; tx: number; ty: number; wait: number; sprint: boolean }
  | { kind: "spar"; partner: EntityId; cooldown: number }
  | { kind: "corpse" };

interface Npc {
  id: EntityId;
  brain: Brain;
  hp: number;
  /** who hit it last and until when it hunts them */
  foe: EntityId;
  foeUntil: number;
  deadAt: number;
  species: SpeciesValue;
  homeX: number;
  homeY: number;
}

export interface LabWorld {
  readonly tick: number;
  step(): void;
  input(m: InputMessage): void;
  snapshot(): Snapshot;
  drain(): ChunkStreamMessage[];
  readonly player: EntityId;
}

export function createLabWorld(seed: number, opts: { npcs?: number; species?: SpeciesValue } = {}): LabWorld {
  const ecs = new World();
  const world = createCharacterWorld(ecs);
  const anchor = ecs.register("ChunkAnchor", {});
  const ground = new Ground(seed);
  // one generation per chunk: the store and the prop placement share Ground's cache
  const chunks = createChunkStore(seed, (_s, cx, cy) => ground.chunk(cx, cy));
  const spawn = labSpawn(seed, ground);
  const rng = new Rng(deriveSeed(seed, 0x1ab));
  const blockedCache = new Map<number, boolean>();
  const tileAt = (tx: number, ty: number): TileValue => {
    const t = chunks.tileAt(tx, ty);
    if (!TILE_RULES[t].walkable) return t;
    const k = tx * 131071 + ty;
    let b = blockedCache.get(k);
    if (b === undefined) {
      b = propBlocks(ground, tx, ty);
      blockedCache.set(k, b);
    }
    return b ? Tile.Cliff : t; // LAB: props block movement by reading as an unwalkable tile
  };
  const walkable = (px: number, py: number) => TILE_RULES[tileAt(Math.floor(px / 16), Math.floor(py / 16))].walkable;

  const player = spawnCharacter(world, { x: spawn.x, y: spawn.y, species: opts.species ?? Species.Foxfolk, tick: 0 });
  ecs.add(player, anchor);
  const latch = createInputLatch();
  const c = world.components;
  const npcs: Npc[] = [];
  const hp = new Map<EntityId, number>([[player, MAX_HP * 3]]);

  /** A walkable feet point near (x, y), searched outward on a deterministic ring. */
  const near = (x: number, y: number, r: number): { x: number; y: number } => {
    for (let k = 0; k < 64; k++) {
      const a = rng.nextFloat() * Math.PI * 2, d = rng.nextFloat() * r;
      const px = Math.floor((x + Math.cos(a) * d) / 16) * 16 + 8, py = Math.floor((y + Math.sin(a) * d) / 16) * 16 + 8;
      if (walkable(px, py) && walkable(px - 6, py) && walkable(px + 6, py)) return { x: px, y: py };
    }
    return { x, y };
  };

  const addNpc = (species: SpeciesValue, x: number, y: number, brain: Brain): Npc => {
    const id = spawnCharacter(world, { x, y, species, tick: 0 });
    const n: Npc = { id, brain, hp: MAX_HP, foe: -1, foeUntil: 0, deadAt: -1, species, homeX: x, homeY: y };
    npcs.push(n);
    hp.set(id, MAX_HP);
    return n;
  };

  // The cast: two sparring partners right by the spawn, a corpse with a story, and wanderers of every species.
  const sparA = near(spawn.x + 56, spawn.y - 20, 8);
  const a = addNpc(Species.Orc, sparA.x, sparA.y, { kind: "wander", homeX: 0, homeY: 0, tx: 0, ty: 0, wait: 0, sprint: false });
  const b = addNpc(Species.Lizardfolk, sparA.x + 30, sparA.y + 4, { kind: "spar", partner: a.id, cooldown: 10 });
  a.brain = { kind: "spar", partner: b.id, cooldown: 25 };
  const cp = near(spawn.x - 70, spawn.y + 50, 16);
  const corpse = addNpc(Species.Dwarf, cp.x, cp.y, { kind: "corpse" });
  c.action.store.state[ecs.indexOf(corpse.id)] = Action.Death;
  const roster: SpeciesValue[] = [Species.Human, Species.Elf, Species.Bearfolk, Species.Rabbitfolk, Species.Birdfolk, Species.Foxfolk, Species.Dwarf, Species.Orc, Species.Lizardfolk, Species.Human, Species.Elf, Species.Rabbitfolk];
  for (let i = 0; i < (opts.npcs ?? 9); i++) {
    const p = near(spawn.x, spawn.y, 60 + i * 14);
    addNpc(roster[i % roster.length]!, p.x, p.y, { kind: "wander", homeX: p.x, homeY: p.y, tx: p.x, ty: p.y, wait: 10 + i * 7, sprint: false });
  }

  let tick = 0;

  const idx = (id: EntityId) => ecs.indexOf(id);
  const pos = (id: EntityId) => ({ x: c.position.store.x[idx(id)]!, y: c.position.store.y[idx(id)]! });
  const setIntent = (id: EntityId, mx: number, my: number, ax: number, ay: number, buttons: number) => {
    const i = idx(id);
    const s = c.intent.store;
    s.moveX[i] = mx; s.moveY[i] = my; s.aimX[i] = ax; s.aimY[i] = ay;
    // keep pending presses (the same buffer rule the input latch follows)
    s.buttons[i] = buttons | (s.buttons[i]! & (IntentButton.AttackPress | IntentButton.DodgePress));
  };

  function think(n: Npc): void {
    if (!ecs.isAlive(n.id)) return;
    const i = idx(n.id);
    const state = c.action.store.state[i]!;
    if (state === Action.Death || state === Action.Hurt) { setIntent(n.id, 0, 0, 0, 0, 0); return; }
    const me = pos(n.id);
    // hunting whoever hit it (players and NPCs alike)
    if (n.foe >= 0 && tick < n.foeUntil && ecs.isAlive(n.foe) && c.action.store.state[idx(n.foe)] !== Action.Death) {
      const f = pos(n.foe);
      const dx = f.x - me.x, dy = f.y - me.y, d = Math.hypot(dx, dy);
      if (d > REACH - 6) setIntent(n.id, dx / d, dy / d, dx, dy, d > 60 ? IntentButton.Sprint : 0);
      else {
        setIntent(n.id, 0, 0, dx, dy, (tick + n.id) % 14 === 0 ? IntentButton.AttackPress : 0);
      }
      return;
    }
    const br = n.brain;
    switch (br.kind) {
      case "corpse":
        return;
      case "spar": {
        if (!ecs.isAlive(br.partner)) return;
        const f = pos(br.partner);
        const dx = f.x - me.x, dy = f.y - me.y, d = Math.hypot(dx, dy);
        br.cooldown -= 1;
        if (d > 34) { setIntent(n.id, dx / d, dy / d, dx, dy, 0); return; }
        if (d < 18) { setIntent(n.id, -dx / d, -dy / d, dx, dy, 0); return; }
        let buttons = 0;
        // the partner just started a swing: sometimes roll away from it
        const ps = c.action.store.state[idx(br.partner)];
        if (ps === Action.Attack && c.action.store.start[idx(br.partner)] === tick - 1 && rng.nextFloat() < 0.45) {
          setIntent(n.id, -dy / d, dx / d, dx, dy, IntentButton.DodgePress);
          return;
        }
        if (br.cooldown <= 0) { buttons = IntentButton.AttackPress; br.cooldown = 22 + rng.int(0, 18); }
        setIntent(n.id, 0, 0, dx, dy, buttons);
        return;
      }
      case "wander": {
        if (br.wait > 0) {
          br.wait -= 1;
          setIntent(n.id, 0, 0, 0, 0, 0);
          if (br.wait === 0) {
            const t = near(br.homeX, br.homeY, 90);
            br.tx = t.x; br.ty = t.y; br.sprint = rng.nextFloat() < 0.2;
          }
          return;
        }
        const dx = br.tx - me.x, dy = br.ty - me.y, d = Math.hypot(dx, dy);
        if (d < 4 || (c.velocity.store.vx[i] === 0 && c.velocity.store.vy[i] === 0 && state === Action.Walk)) {
          br.wait = 20 + rng.int(0, 70);
          setIntent(n.id, 0, 0, 0, 0, 0);
          return;
        }
        // amble: not every step at full speed
        const k = br.sprint ? 1 : 0.55 + 0.45 * Math.min(1, d / 40);
        setIntent(n.id, (dx / d) * k, (dy / d) * k, 0, 0, br.sprint ? IntentButton.Sprint : 0);
        return;
      }
    }
  }

  /** LAB stand-in for combat: the attack lands HIT_TICK ticks in, on everyone in a 120 deg arc within REACH. */
  function resolveHits(): void {
    const { state, start } = c.action.store;
    const { dir } = c.facing.store;
    const hits: [EntityId, EntityId, number, number][] = [];
    ecs.each([c.action, c.position, c.facing], (id, i) => {
      if (state[i] !== Action.Attack || tick - start[i]! !== HIT_TICK) return;
      const [fx, fy] = FACING_UNIT[dir[i]! as 0 | 1 | 2 | 3];
      const ax = c.position.store.x[i]!, ay = c.position.store.y[i]!;
      ecs.each([c.action, c.position], (other, j) => {
        if (other === id) return;
        const s = state[j]!;
        if (s === Action.Death || s === Action.Dodge) return; // a roll's i-frames
        const dx = c.position.store.x[j]! - ax, dy = c.position.store.y[j]! - ay;
        const d = Math.hypot(dx, dy);
        if (d > REACH || d < 0.01) return;
        if ((dx * fx + dy * fy) / d < 0.5) return;
        hits.push([id, other, dx / d, dy / d]);
      });
    });
    for (const [by, id, nx, ny] of hits) {
      const i = idx(id);
      const left = (hp.get(id) ?? MAX_HP) - 1;
      hp.set(id, left);
      state[i] = left <= 0 ? Action.Death : Action.Hurt;
      start[i] = tick;
      c.facing.store.dir[i] = facingToward(-nx, -ny, c.facing.store.dir[i]! as 0 | 1 | 2 | 3);
      knock.set(id, [nx * 2.2, ny * 2.2, 4]);
      const n = npcs.find((q) => q.id === id);
      if (n) {
        n.foe = by; n.foeUntil = tick + 6 * TICK_HZ;
        if (left <= 0) n.deadAt = tick;
      }
    }
  }
  const knock = new Map<EntityId, [number, number, number]>();

  function endHurt(): void {
    const { state, start } = c.action.store;
    ecs.each([c.action], (id, i) => {
      if (state[i] === Action.Hurt && tick - start[i]! >= HURT_TICKS) { state[i] = Action.Idle; start[i] = tick; }
      const k = knock.get(id);
      if (k && k[2] > 0) {
        const p = slideMove(tileAt, c.position.store.x[i]!, c.position.store.y[i]!, c.collider.store.hw[i]!, c.collider.store.hh[i]!, k[0], k[1]);
        c.position.store.x[i] = p.x; c.position.store.y[i] = p.y;
        k[2] -= 1;
        k[0] *= 0.6; k[1] *= 0.6;
      }
    });
    // the fallen get back up after a while (a lab convenience so the demo never runs out of people)
    for (const n of npcs) {
      if (n.deadAt >= 0 && tick - n.deadAt > RESPAWN_TICKS) {
        const i = idx(n.id);
        const p = near(n.homeX, n.homeY, 24);
        c.position.store.x[i] = p.x; c.position.store.y[i] = p.y;
        c.action.store.state[i] = Action.Idle; c.action.store.start[i] = tick;
        hp.set(n.id, MAX_HP); n.deadAt = -1; n.foe = -1;
      }
    }
    if ((hp.get(player) ?? 1) <= 0 && tick - c.action.store.start[idx(player)]! > RESPAWN_TICKS / 2) {
      const i = idx(player);
      c.action.store.state[i] = Action.Idle; c.action.store.start[i] = tick;
      hp.set(player, MAX_HP * 3);
    }
  }

  return {
    get tick() { return tick; },
    player,
    step() {
      tick += 1;
      latchInput(latch, world, player);
      for (const n of npcs) think(n);
      stepActions(world, tick);
      stepMovement(world, tick, tileAt);
      resolveHits();
      endHurt();
      const anchors: AnchorPos[] = [];
      ecs.each([c.position, anchor], (_id, i) => { anchors.push({ x: c.position.store.x[i]!, y: c.position.store.y[i]! }); });
      chunks.stream(anchors);
    },
    input(m) { assertInputMessage(m); latch.latest = m; },
    drain() { return chunks.drain(); },
    snapshot() {
      const vis = [c.position, c.kind, c.facing, c.action, c.species];
      let count = 0;
      ecs.each(vis, () => { count += 1; });
      const s: Snapshot = {
        tick, count,
        ids: new Uint32Array(count), x: new Float32Array(count), y: new Float32Array(count), kind: new Uint16Array(count),
        facing: new Uint8Array(count), action: new Uint8Array(count), actionStart: new Uint32Array(count), species: new Uint8Array(count),
        you: player,
      };
      let k = 0;
      ecs.each(vis, (id, i) => {
        s.ids[k] = id; s.x[k] = c.position.store.x[i]!; s.y[k] = c.position.store.y[i]!; s.kind[k] = c.kind.store.kind[i]!;
        s.facing[k] = c.facing.store.dir[i]!; s.action[k] = c.action.store.state[i]!; s.actionStart[k] = c.action.store.start[i]!;
        s.species[k] = c.species.store.species[i]!;
        k += 1;
      });
      return s;
    },
  };
}
