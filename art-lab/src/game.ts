// The live prototype: the lab sim in a Web Worker, snapshots interpolated, the world and its people drawn as a pixel
// diorama, a camera that follows the local player. ?seed=22&species=4&hour=10.5&cycle=0&npcs=9&bot=0
import { attack, blend, clearPose, death, dodge, hurt, idle, locomotion, newPose, ATTACK_S, DODGE_S, type Pose } from "./actors/anim";
import type { Weapon } from "./actors/rig";
import { SPECIES } from "./actors/species";
import { createInput } from "./input";
import { ActorLayer, type ActorDraw, type ActorLook } from "./render/actor-layer";
import { FxLayer } from "./render/fx-layer";
import { PropLayer } from "./render/prop-layer";
import { Renderer } from "./render/renderer";
import { applyTime } from "./render/sky";
import { TerrainLayer } from "./render/terrain-layer";
import { HURT_TICKS, labSpawn } from "./sim/lab-world";
import { Ground, hash01 } from "./world/ground";
import { HeightField } from "./world/heightfield";
import { TICK_HZ, TICK_MS } from "../../sim/src/constants";
import { Action, Facing, type InputMessage, type SimToHost, type Snapshot } from "../../sim/src/protocol";

const WEAPONS: Weapon[] = ["sword", "axe", "spear", "dagger", "sword", "none"];
const FACING_YAW: Record<number, number> = { [Facing.Down]: 0, [Facing.Left]: -Math.PI / 2, [Facing.Right]: Math.PI / 2, [Facing.Up]: Math.PI };

interface Vis {
  yaw: number;
  phase: number;
  speed: number;
  look: ActorLook;
  pose: Pose;
  base: Pose;
  seed: number;
  /** blend weight of the action layer, eased in so clips don't pop */
  act: number;
  lastAction: number;
  step: number;
  rippleAt: number;
  draw: ActorDraw;
}

const FACING_VEC: Record<number, [number, number]> = { [Facing.Down]: [0, 1], [Facing.Left]: [-1, 0], [Facing.Right]: [1, 0], [Facing.Up]: [0, -1] };

export async function runGame(canvas: HTMLCanvasElement, q: URLSearchParams): Promise<void> {
  const seed = Number(q.get("seed") ?? 22);
  const species = Number(q.get("species") ?? 4);
  let hour = Number(q.get("hour") ?? 10.5);
  const cycle = Number(q.get("cycle") ?? 0); // real minutes per in-game day; 0 = frozen
  // the worker starts first: its spawn search and chunk generation run while this thread builds meshes
  // the init travels in the worker's name: the worker starts its world the moment it boots, no message round trip
  const init = { type: "init", seed, npcs: Number(q.get("npcs") ?? 9), species };
  const worker = new Worker(new URL("./sim/lab-worker.ts", import.meta.url), { type: "module", name: JSON.stringify(init) });
  // Chromium boots a worker only when this thread yields: wait for it (bounded), so its startup overlaps our mesh building
  await new Promise<void>((res) => {
    const done = () => { clearTimeout(to); worker.removeEventListener("message", on); res(); };
    const on = (e: MessageEvent) => { if ((e.data as { type: string }).type === "boot") done(); };
    const to = setTimeout(done, 1500);
    worker.addEventListener("message", on);
  });
  const ground = new Ground(seed);
  const spawn = labSpawn(seed, ground); // also registers the spawn clearing, so props agree with the worker's collision
  performance.mark("lab:spawn");

  const r = new Renderer(canvas);
  const terrain = new TerrainLayer(r.gl, ground);
  const props = new PropLayer(r.gl, ground);
  const actors = new ActorLayer(r.gl);
  const hf = new HeightField();
  terrain.onChunk = (rl) => { props.add(rl); hf.add(rl); };
  terrain.onDrop = (cx, cy) => { props.drop(cx, cy); hf.drop(cx, cy); };
  const fx = new FxLayer(r.gl);
  r.drawables.push(terrain, props, actors, fx);
  performance.mark("lab:gl");
  const forced = Number(q.get("scale") ?? 0);
  const resize = () => r.resize(Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), forced);
  resize();
  window.addEventListener("resize", resize);

  // the first view: build the chunks around the spawn before the first frame
  r.focus = [spawn.x, 0, spawn.y];
  // the first view: build only the chunks the screen shows; the rest of the ring streams in one per frame
  const hw = r.iw / 2 + 32, hd = r.ih / 2 / Math.sin((52 * Math.PI) / 180) + 96;
  for (let cz = Math.floor((spawn.y - hd) / 512); cz <= Math.floor((spawn.y + hd) / 512); cz++) {
    for (let cx = Math.floor((spawn.x - hw) / 512); cx <= Math.floor((spawn.x + hw) / 512); cx++) terrain.ensure(cx, cz);
  }
  r.focus[1] = hf.height(spawn.x, spawn.y);
  performance.mark("lab:chunks");

  let prev: Snapshot | null = null, curr: Snapshot | null = null, currAt = 0;
  worker.onmessage = (e: MessageEvent<SimToHost>) => {
    const m = e.data;
    const tm = m as unknown as { type: string; boot: number; init: number; created: number; origin: number };
    if (tm.type === "boot") return;
    if (tm.type === "timing") {
      const off = tm.origin - performance.timeOrigin;
      performance.mark("lab:worker-boot", { startTime: tm.boot + off });
      performance.mark("lab:worker-init", { startTime: tm.init + off });
      performance.mark("lab:worker-created", { startTime: tm.created + off });
      return;
    }
    if (m.type === "snapshot") {
      if (!curr) performance.mark("lab:first-snapshot");
      prev = curr; curr = m.snapshot; currAt = performance.now();
    }
    else if (m.type === "chunk") ground.put({ cx: m.cx, cy: m.cy, tiles: m.tiles, biomes: m.biomes } as never);
    else if (m.type === "error") { console.error(m.message); showError(m.message); }
  };
  const post = (m: InputMessage) => worker.postMessage(m);
  const input = createInput(canvas, post);
  const bot = q.get("bot") === "1" ? botDriver(post) : null;

  window.addEventListener("keydown", (e) => { if (e.code === "KeyT") hour = (hour + 1.5) % 24; });

  const vis = new Map<number, Vis>();
  const lookOf = (id: number, sp: number, you: boolean): ActorLook => {
    if (you) return { species: sp, dye: 1, weapon: "sword", trousers: 0 };
    const h = (k: number) => hash01(seed, id, k);
    return { species: sp, dye: Math.floor(h(1) * 9), weapon: WEAPONS[Math.floor(h(2) * WEAPONS.length)]!, trousers: Math.floor(h(3) * 4) };
  };

  let lastT = performance.now();
  let frameN = 0;
  let firstFrame = false;
  const cam = { x: spawn.x, y: r.focus[1], z: spawn.y };
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (cycle > 0) hour = (hour + (dt * 24) / (cycle * 60)) % 24;
    const night = applyTime(r, hour);
    frameN++;
    r.cloudOffset[0] += dt * 9; r.cloudOffset[1] += dt * 3;
    actors.list.length = 0;
    let you: Vis | null = null, youPos: [number, number, number] = [cam.x, cam.y, cam.z];
    if (curr) {
      const alpha = Math.min(1, (now - currAt) / TICK_MS);
      const seen = new Set<number>();
      const pi = new Map<number, number>();
      if (prev) for (let i = 0; i < prev.count; i++) pi.set(prev.ids[i]!, i);
      let pushers = 0;
      props.pushers.fill(0);
      for (let i = 0; i < curr.count; i++) {
        const id = curr.ids[i]!;
        seen.add(id);
        const j = pi.get(id);
        const px = j !== undefined ? prev!.x[j]! : curr.x[i]!, py = j !== undefined ? prev!.y[j]! : curr.y[i]!;
        const x = px + (curr.x[i]! - px) * alpha, z = py + (curr.y[i]! - py) * alpha;
        const isYou = id === curr.you;
        let v = vis.get(id);
        if (!v) {
          const look = lookOf(id, curr.species[i]!, isYou);
          const pose = newPose();
          v = { yaw: FACING_YAW[curr.facing[i]!]!, phase: hash01(seed, id, 9), speed: 0, look, pose, base: newPose(), seed: hash01(seed, id, 7) * 10, act: 0, lastAction: -1, step: 0, rippleAt: 0, draw: { look, x, y: 0, z, yaw: 0, pose, sil: isYou ? [1, 0.62, 0.18] : [0.36, 0.46, 0.78], attackU: -1 } };
          vis.set(id, v);
        }
        const gy = hf.height(x, z);
        if (Number.isNaN(gy)) continue; // its chunk isn't built yet
        // speed from the snapshot pair (px/s), smoothed so walk/run blends don't flicker
        const sp = j !== undefined ? Math.hypot(curr.x[i]! - px, curr.y[i]! - py) * TICK_HZ : 0;
        v.speed += (sp - v.speed) * Math.min(1, dt * 10);
        const action = curr.action[i]!;
        const t = (curr.tick - curr.actionStart[i]! + alpha) / TICK_HZ;
        // yaw: toward the motion while walking or rolling, else the sim facing; turns are quick but not instant
        let target = FACING_YAW[curr.facing[i]!]!;
        if ((action === Action.Walk || action === Action.Dodge) && j !== undefined && sp > 5) target = Math.atan2(curr.x[i]! - px, curr.y[i]! - py);
        const turn = action === Action.Attack ? 30 : 14;
        v.yaw += wrap(target - v.yaw) * Math.min(1, dt * turn);
        // the clip
        const rig = actors.rigFor(v.look).rig;
        const p = v.pose;
        clearPose(v.base);
        if (v.speed > 4 && action !== Action.Death) {
          const run = Math.max(0, Math.min(1, (v.speed - 90) / 40));
          v.phase += (v.speed * dt) / (20 + run * 10) * rig.species.gait.stride;
          locomotion(v.base, rig, v.phase, run, now / 1000);
          const w = Math.min(1, v.speed / 30);
          clearPose(p); idle(p, rig, now / 1000, v.seed); blend(p, v.base, w);
        } else {
          clearPose(p); idle(p, rig, now / 1000, v.seed);
        }
        v.draw.attackU = -1;
        // events -> particles (cosmetic, host only)
        const wl = hf.water(x, z);
        const wet = !Number.isNaN(wl) && wl > gy + 0.5;
        const surf = wet ? wl : gy;
        const ev = id * 7919 + curr.actionStart[i]!;
        if (action !== v.lastAction && v.lastAction >= 0) {
          if (action === Action.Hurt || action === Action.Death) {
            const fv = FACING_VEC[curr.facing[i]!]!;
            fx.hit(x, gy, z, -fv[0], -fv[1], ev);
          }
          if (action === Action.Dodge || v.lastAction === Action.Dodge) {
            if (wet) fx.splash(x, surf, z, ev, true); else fx.dust(x, gy, z, ev, 7, 1.2);
          }
          if (action === Action.Death) { if (wet) fx.splash(x, surf, z, ev + 1, true); else fx.dust(x, gy, z, ev + 1, 9, 1.5); }
        }
        if (action !== v.lastAction) { v.act = action === Action.Idle || action === Action.Walk ? v.act : 0.35; v.lastAction = action; }
        const stepN = Math.floor(v.phase * 2);
        if (stepN !== v.step) {
          v.step = stepN;
          if (wet) fx.ripple(x, surf, z, 0.8);
          else if (v.speed > 100) fx.dust(x, gy, z, ev + stepN * 31, 2, 0.6);
          if (wet && v.speed > 100) fx.splash(x, surf, z, ev + stepN * 17);
        }
        if (wet && now > v.rippleAt) { v.rippleAt = now + 1100 + hash01(seed, id, stepN) * 600; fx.ripple(x, surf, z, 0.7); }
        if (action === Action.Attack || action === Action.Dodge || action === Action.Hurt || action === Action.Death) {
          v.act = Math.min(1, v.act + dt * 14);
          clearPose(v.base);
          if (action === Action.Attack) { const u = Math.min(1, t / ATTACK_S); attack(v.base, rig, u); v.draw.attackU = u; }
          else if (action === Action.Dodge) dodge(v.base, rig, Math.min(1, t / DODGE_S));
          else if (action === Action.Hurt) hurt(v.base, rig, Math.min(1, t / (HURT_TICKS / TICK_HZ)));
          else death(v.base, rig, t);
          blend(p, v.base, v.act);
        } else v.act = Math.max(0, v.act - dt * 8);
        v.draw.x = x; v.draw.y = gy; v.draw.z = z; v.draw.yaw = v.yaw;
        actors.list.push(v.draw);
        if (pushers < 12) { props.pushers.set([x, z, 0, 11], pushers * 4); pushers++; }
        if (isYou) { you = v; youPos = [x, gy, z]; }
      }
      for (const id of vis.keys()) if (!seen.has(id)) vis.delete(id);
    }
    // camera: follow the player with a short lag and a look-ahead toward the aim; never ahead of the chunks
    const m = input.msg;
    const la = Math.hypot(m.aimX, m.aimY) > 0 ? [m.aimX / Math.max(1, Math.hypot(m.aimX, m.aimY)), m.aimY / Math.max(1, Math.hypot(m.aimX, m.aimY))] : [0, 0];
    const tx = youPos[0] + la[0]! * 16, tz = youPos[2] + la[1]! * 12;
    const k = 1 - Math.exp(-dt * 5);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.y += (youPos[1] - cam.y) * (1 - Math.exp(-dt * 3));
    r.focus = [cam.x, cam.y + 10, cam.z];
    fx.update(dt, r.basis);
    if (you) { const c = r.toTexel([youPos[0], youPos[1] + 12, youPos[2]], 12); props.cut.set([c[0], c[1], c[2], 26]); }
    { const L = r.lighting; fx.ambient = [0, 1, 2].map((k) => Math.min(1, L.sunCol[k]! * 0.75 * Math.max(0.2, L.sunDir[1]) + L.skyCol[k]! * 0.45)) as [number, number, number]; }
    // night: the player's lantern, a few NPC lanterns, glowing mushrooms, fireflies over the grass
    r.lights.fill(0);
    if (night > 0.05) {
      const cand: [number, number, number, number, number, number, number, number][] = [];
      if (you) cand.push([youPos[0], youPos[1] + 16, youPos[2], 60 + 40 * night, 1.0 * night, 0.68 * night, 0.34 * night, 0]);
      for (const d of actors.list) if (d !== you?.draw && hash01(seed, Math.round(d.look.dye * 7 + d.look.species), 3) < 0.4) cand.push([d.x, d.y + 15, d.z, 46 * night, 0.9 * night, 0.6 * night, 0.3 * night, 1]);
      for (const list of props.tall.values()) for (const t of list) if (t.kind === 8) cand.push([t.x, t.y + 4, t.z, 26, 0.25 * night, 0.85 * night, 0.8 * night, 2]);
      cand.sort((a, b) => (a[7] - b[7]) || (Math.hypot(a[0] - cam.x, a[2] - cam.z) - Math.hypot(b[0] - cam.x, b[2] - cam.z)));
      cand.slice(0, 8).forEach((c, i) => { r.lights.set([c[0], c[1], c[2], c[3]], i * 4); r.lightCols.set([c[4], c[5], c[6]], i * 3); });
      if (frameN % 6 === 0 && night > 0.4) {
        const fx0 = cam.x + (hash01(seed, frameN, 1) - 0.5) * r.iw, fz0 = cam.z + (hash01(seed, frameN, 2) - 0.5) * r.ih * 1.3;
        const gy0 = hf.height(fx0, fz0);
        if (!Number.isNaN(gy0) && Number.isNaN(hf.water(fx0, fz0))) fx.firefly(fx0, gy0, fz0, frameN);
      }
    }
    terrain.update(cam.x, cam.z, 1, 1, 1);
    r.render(now / 1000);
    // aim: the player's feet in CSS px, and CSS px per world px on the ground (x, and y foreshortened by the pitch)
    const pc = r.project(youPos);
    const cssPerPx = r.scale / devicePixelRatio;
    input.frame([pc[0] / devicePixelRatio, pc[1] / devicePixelRatio], cssPerPx, cssPerPx * Math.sin((52 * Math.PI) / 180));
    bot?.(now);
    if (!firstFrame && curr && you) {
      firstFrame = true;
      performance.mark("overgrown:first-frame");
      (window as unknown as { sketchDone: boolean }).sketchDone = true;
    }
    hud(now, hour);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function wrap(a: number): number {
  return a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
}

let hudEl: HTMLDivElement | null = null;
let hudFrames = 0, hudT = 0, hudFps = 0;
function hud(now: number, hour: number): void {
  if (!hudEl) {
    hudEl = document.createElement("div");
    hudEl.className = "hud";
    document.body.appendChild(hudEl);
  }
  hudFrames++;
  if (now - hudT > 1000) { hudFps = (hudFrames * 1000) / (now - hudT); hudFrames = 0; hudT = now; }
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  hudEl.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}  ${hudFps.toFixed(0)} fps`;
}

function showError(msg: string): void {
  const el = document.createElement("pre");
  el.className = "err";
  el.textContent = msg;
  document.body.appendChild(el);
}

/** ?bot=1: a scripted player for captures (walks, swings, rolls) so the action beat needs no hands. */
function botDriver(post: (m: InputMessage) => void): (now: number) => void {
  const m: InputMessage = { type: "input", moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprint: false, attackPresses: 0, dodgePresses: 0 };
  let step = -1;
  // walk over to the sparring pair, swing into them, roll out, swing again, then sprint off
  const script: [number, Partial<InputMessage> & { a?: number; d?: number }][] = [
    [0, { moveX: 1, moveY: -0.35, aimX: 30, aimY: -10 }], [700, { moveX: 0, moveY: 0, aimX: 30, aimY: 0, a: 1 }], [1300, { a: 1 }],
    [1900, { moveX: -1, moveY: 0.6, d: 1 }], [2400, { moveX: 0, moveY: 0, aimX: 30, aimY: -5 }], [2600, { moveX: 1, moveY: 0 }], [3000, { moveX: 0, a: 1 }],
    [3600, { a: 1 }], [4300, { moveX: -1, moveY: 0.5, sprint: true }], [6000, { moveX: 0, moveY: 0, sprint: false }],
  ];
  let t0 = -1;
  return (now) => {
    if (t0 < 0) t0 = now + 300;
    const t = now - t0;
    while (step + 1 < script.length && t >= script[step + 1]![0]) {
      step++;
      const { a, d, ...rest } = script[step]![1];
      Object.assign(m, rest);
      if (a) m.attackPresses = (m.attackPresses + 1) >>> 0;
      if (d) m.dodgePresses = (m.dodgePresses + 1) >>> 0;
      post({ ...m });
    }
  };
}

void SPECIES;
