// The live prototype: the lab sim (real sim systems) in a worker, the pixel-diorama world, and the clay-and-ink
// characters with their animators. ?seed=22&species=4&hour=10.5&npcs=14&bot=0
import { createInput } from "../../src/input";
import { FxLayer } from "../../src/render/fx-layer";
import { PropLayer } from "../../src/render/prop-layer";
import { Renderer } from "../../src/render/renderer";
import { applyTime } from "../../src/render/sky";
import { TerrainLayer } from "../../src/render/terrain-layer";
import { labSpawn } from "../../src/sim/lab-world";
import { Ground } from "../../src/world/ground";
import { HeightField } from "../../src/world/heightfield";
import { TICK_HZ, TICK_MS } from "../../../sim/src/constants";
import { Action, Facing, type InputMessage, type SimToHost, type Snapshot } from "../../../sim/src/protocol";
import { Animator } from "./anim/animator";
import type { Built, Look } from "./body/look";
import { MeshPool } from "./body/mesh-pool";
import { hash01, npcLook, playerLook } from "./body/outfits";
import { SPECIES } from "./body/species";
import { CharLayer, type CharDraw } from "./render/char-layer";
import { newPosed, placeM } from "./rig/pose";

const FACING_YAW: Record<number, number> = { [Facing.Down]: 0, [Facing.Left]: -Math.PI / 2, [Facing.Right]: Math.PI / 2, [Facing.Up]: Math.PI };
const FACING_VEC: Record<number, [number, number]> = { [Facing.Down]: [0, 1], [Facing.Left]: [-1, 0], [Facing.Right]: [1, 0], [Facing.Up]: [0, -1] };

interface Vis {
  look: Look;
  built?: Built;
  anim?: Animator;
  yaw: number;
  draw: CharDraw;
  lastAction: number;
  serial: number;
  you: boolean;
}

export async function runGame(canvas: HTMLCanvasElement, q: URLSearchParams): Promise<void> {
  const seed = Number(q.get("seed") ?? 22);
  const species = Number(q.get("species") ?? 4);
  let hour = Number(q.get("hour") ?? 10.5);
  const cycle = Number(q.get("cycle") ?? 0);
  const init = { type: "init", seed, npcs: Number(q.get("npcs") ?? 12), species };
  const worker = new Worker(new URL("../../src/sim/lab-worker.ts", import.meta.url), { type: "module", name: JSON.stringify(init) });
  const pool = new MeshPool();
  // start sculpting the player and one of every species while the world builds
  void pool.get(playerLook(species));
  const ground = new Ground(seed);
  const spawn = labSpawn(seed, ground);
  const r = new Renderer(canvas);
  const terrain = new TerrainLayer(r.gl, ground);
  const props = new PropLayer(r.gl, ground);
  const chars = new CharLayer(r.gl, r);
  chars.pool = pool;
  const hf = new HeightField();
  terrain.onChunk = (rl) => { props.add(rl); hf.add(rl); };
  terrain.onDrop = (cx, cy) => { props.drop(cx, cy); hf.drop(cx, cy); };
  const fx = new FxLayer(r.gl);
  r.drawables.push(terrain, props, chars, fx);
  (window as unknown as { __lab: unknown }).__lab = { r, chars, pool };
  const forced = Number(q.get("scale") ?? 0);
  const zoom = Number(q.get("zoom") ?? 1);
  r.zoom = zoom;
  const resize = () => r.resize(Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), forced || Math.max(1, Math.round(Math.max(innerWidth, innerHeight) * devicePixelRatio / 440 / zoom)));
  resize();
  window.addEventListener("resize", resize);
  r.focus = [spawn.x, 0, spawn.y];
  const hw = r.iw / 2 / zoom + 32, hd = r.ih / 2 / zoom / Math.sin((52 * Math.PI) / 180) + 96;
  for (let cz = Math.floor((spawn.y - hd) / 512); cz <= Math.floor((spawn.y + hd) / 512); cz++) {
    for (let cx = Math.floor((spawn.x - hw) / 512); cx <= Math.floor((spawn.x + hw) / 512); cx++) terrain.ensure(cx, cz);
  }
  r.focus[1] = hf.height(spawn.x, spawn.y);

  let prev: Snapshot | null = null, curr: Snapshot | null = null, currAt = 0;
  worker.onmessage = (e: MessageEvent<SimToHost>) => {
    const m = e.data;
    const tm = m as unknown as { type: string };
    if (tm.type === "boot" || tm.type === "timing") return;
    if (m.type === "snapshot") { prev = curr; curr = m.snapshot; currAt = performance.now(); }
    else if (m.type === "chunk") ground.put({ cx: m.cx, cy: m.cy, tiles: m.tiles, biomes: m.biomes } as never);
    else if (m.type === "error") console.error(m.message);
  };
  const post = (m: InputMessage) => worker.postMessage(m);
  const input = createInput(canvas, post);
  const bot = q.get("bot") === "1" ? botDriver(post) : null;
  window.addEventListener("keydown", (e) => { if (e.code === "KeyT") hour = (hour + 1.5) % 24; });

  const vis = new Map<number, Vis>();
  let lastT = performance.now();
  let firstFrame = false;
  const cam = { x: spawn.x, y: r.focus[1], z: spawn.y };
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (cycle > 0) hour = (hour + (dt * 24) / (cycle * 60)) % 24;
    const night = applyTime(r, hour);
    r.cloudOffset[0] += dt * 9; r.cloudOffset[1] += dt * 3;
    chars.list.length = 0;
    let youPos: [number, number, number] = [cam.x, cam.y, cam.z];
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
          const look = isYou ? playerLook(curr.species[i]!) : npcLook(curr.species[i]!, seed, id);
          v = { look, yaw: FACING_YAW[curr.facing[i]!]!, lastAction: -1, serial: 0, you: isYou, draw: { look, x, y: 0, z, yaw: 0, pose: undefined as never, posed: newPosed(), posedReady: true } };
          vis.set(id, v);
        }
        if (!v.anim) {
          const b = pool.peek(v.look);
          if (!b) continue;
          v.built = b;
          v.anim = new Animator(b.sk, b.build, v.look.weapon, SPECIES[v.look.species]!.gait ?? {}, hash01(seed, id, 5) * 10);
          v.draw.pose = v.anim.pose;
        }
        const gy = hf.height(x, z);
        if (Number.isNaN(gy)) continue;
        const sp = j !== undefined ? Math.hypot(curr.x[i]! - px, curr.y[i]! - py) * TICK_HZ : 0;
        const action = curr.action[i]!;
        const t = (curr.tick - curr.actionStart[i]! + alpha) / TICK_HZ;
        if (action !== v.lastAction || (action === Action.Attack && t < 0.06 && v.lastAction === Action.Attack)) {
          if (action === Action.Attack) v.serial++;
          // events -> particles
          if (v.lastAction >= 0 && (action === Action.Hurt || action === Action.Death)) {
            const fv = FACING_VEC[curr.facing[i]!]!;
            fx.hit(x, gy, z, -fv[0], -fv[1], id * 7919 + curr.actionStart[i]!);
          }
          if (v.lastAction >= 0 && (action === Action.Dodge || v.lastAction === Action.Dodge)) fx.dust(x, gy, z, id * 31 + curr.actionStart[i]!, 7, 1.2);
          v.lastAction = action;
        }
        // facing: toward motion while moving or rolling, toward the aim when the local player attacks, else the sim facing
        let target = FACING_YAW[curr.facing[i]!]!;
        if ((action === Action.Walk || action === Action.Dodge) && j !== undefined && sp > 5) target = Math.atan2(curr.x[i]! - px, curr.y[i]! - py);
        if (isYou && action === Action.Attack && Math.hypot(input.msg.aimX, input.msg.aimY) > 1) target = Math.atan2(input.msg.aimX, input.msg.aimY);
        const turn = action === Action.Attack ? 26 : action === Action.Dodge ? 30 : 12;
        v.yaw += wrap(target - v.yaw) * Math.min(1, dt * turn);
        const an = v.anim;
        an.update(dt, { action, t, serial: v.serial, speed: action === Action.Walk ? sp : 0 });
        for (const s of an.steps) if (sp > 100) fx.dust(x, gy, z, id * 131 + Math.floor(an.phase * 2) * 7 + s, 2, 0.6);
        an.steps.length = 0;
        const place = placeM(x, gy, z, v.yaw);
        an.solve(v.draw.posed!, place, dt);
        v.draw.x = x; v.draw.y = gy; v.draw.z = z; v.draw.yaw = v.yaw;
        chars.list.push(v.draw);
        if (pushers < 12) { props.pushers.set([x, z, 0, 11], pushers * 4); pushers++; }
        if (isYou) youPos = [x, gy, z];
      }
      for (const id of vis.keys()) if (!seen.has(id)) vis.delete(id);
    }
    const m = input.msg;
    const al = Math.hypot(m.aimX, m.aimY);
    const la = al > 0 ? [m.aimX / Math.max(1, al), m.aimY / Math.max(1, al)] : [0, 0];
    const tx = youPos[0] + la[0]! * 16, tz = youPos[2] + la[1]! * 12;
    const k = 1 - Math.exp(-dt * 5);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.y += (youPos[1] - cam.y) * (1 - Math.exp(-dt * 3));
    r.focus = [cam.x, cam.y + 10, cam.z];
    fx.update(dt, r.basis);
    const c = r.toTexel([youPos[0], youPos[1] + 14, youPos[2]], 14);
    props.cut.set([c[0], c[1], c[2], 30 * zoom]);
    r.lights.fill(0);
    if (night > 0.05) {
      r.lights.set([youPos[0], youPos[1] + 16, youPos[2], 60 + 40 * night], 0);
      r.lightCols.set([1.0 * night, 0.68 * night, 0.34 * night], 0);
    }
    terrain.update(cam.x, cam.z, 1, 1, 1);
    r.render(now / 1000);
    const pc = r.project(youPos);
    const cssPerPx = (r.scale * r.zoom) / devicePixelRatio;
    input.frame([pc[0] / devicePixelRatio, pc[1] / devicePixelRatio], cssPerPx, cssPerPx * Math.sin((52 * Math.PI) / 180));
    bot?.(now);
    if (!firstFrame && chars.list.length > 0 && pool.busy === 0) {
      firstFrame = true;
      performance.mark("overgrown:first-frame");
      (window as unknown as { sketchDone: boolean }).sketchDone = true;
    }
    hud(now, hour, chars, pool);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function wrap(a: number): number {
  return a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
}

let hudEl: HTMLDivElement | null = null;
let hudFrames = 0, hudT = 0, hudFps = 0;
function hud(now: number, hour: number, chars: CharLayer, pool: MeshPool): void {
  if (!hudEl) {
    hudEl = document.createElement("div");
    hudEl.className = "hud";
    document.body.appendChild(hudEl);
  }
  hudFrames++;
  if (now - hudT > 1000) { hudFps = (hudFrames * 1000) / (now - hudT); hudFrames = 0; hudT = now; }
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  hudEl.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}  ${hudFps.toFixed(0)} fps  ${chars.stats.draws} chars ${(chars.stats.tris / 1000).toFixed(0)}k tris${pool.busy ? `  sculpting ${pool.busy}` : ""}`;
}

/** ?bot=1: a scripted player for captures (walks, swings, rolls). */
function botDriver(post: (m: InputMessage) => void): (now: number) => void {
  const m: InputMessage = { type: "input", moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprint: false, attackPresses: 0, dodgePresses: 0 };
  let step = -1;
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
