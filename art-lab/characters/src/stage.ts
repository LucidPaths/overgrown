// Stage: deterministic posed scenes in the real world (lineups, turnarounds, motion sheets).
// ?mode=stage&species=0,1&yaw=0,45&scale=4&x=2080&y=1032
import { PropLayer } from "../../src/render/prop-layer";
import { Renderer } from "../../src/render/renderer";
import { applyTime } from "../../src/render/sky";
import { TerrainLayer } from "../../src/render/terrain-layer";
import { Ground } from "../../src/world/ground";
import { HeightField } from "../../src/world/heightfield";
import { clearings } from "../../src/world/placement";
import { SPECIES } from "./body/species";
import type { Look } from "./body/look";
import { CharLayer, type CharDraw } from "./render/char-layer";
import { newPose, newPosed, placeM } from "./rig/pose";
import { Animator, ACT } from "./anim/animator";
import { buildLook } from "./body/look";
import { slash, stand, stride } from "./anim/sketch-poses";
import { chibi, heroic } from "./body/proportions";

export function runStage(canvas: HTMLCanvasElement, q: URLSearchParams): void {
  const seed = Number(q.get("seed") ?? 22);
  const fx = Number(q.get("x") ?? 2080), fz = Number(q.get("y") ?? 1032);
  const scale = Number(q.get("scale") ?? 4);
  const spacing = Number(q.get("sp") ?? 30);
  clearings.push({ tx: Math.floor(fx / 16), ty: Math.floor(fz / 16), r: Number(q.get("clear") ?? 7) });
  const r = new Renderer(canvas);
  applyTime(r, Number(q.get("hour") ?? 10.5));
  const ground = new Ground(seed);
  const terrain = new TerrainLayer(r.gl, ground);
  const props = new PropLayer(r.gl, ground);
  const chars = new CharLayer(r.gl, r);
  if (q.has("tilt")) chars.tilt = (Number(q.get("tilt")) * Math.PI) / 180;
  if (q.has("lean")) r.lean = Number(q.get("lean"));
  if (q.has("linew")) chars.lineW = Number(q.get("linew"));
  chars.mode = (q.get("cmode") ?? "clay") as never;
  if (q.has("zoom")) r.zoom = Number(q.get("zoom"));
  if (q.has("dbg")) (window as unknown as { dbgSimple: number }).dbgSimple = Number(q.get("dbg"));
  const hf = new HeightField();
  terrain.onChunk = (rl) => { props.add(rl); hf.add(rl); };
  r.drawables.push(terrain, props, chars);
  const W = Number(q.get("w") ?? innerWidth), H = Number(q.get("h") ?? innerHeight);
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  r.resize(Math.round(W * devicePixelRatio), Math.round(H * devicePixelRatio), scale);
  while (terrain.pending(fx, fz, 1, 1) > 0) terrain.update(fx, fz, 1, 1, 25);
  const gy = hf.height(fx, fz);
  r.focus = [fx, gy + Number(q.get("lift") ?? 18), fz];
  const list = (q.get("species") ?? SPECIES.map((_, i) => i).join(",")).split(",").map(Number);
  const yaws = (q.get("yaw") ?? "0").split(",").map(Number);
  const t0 = performance.now();
  const puppets: { x: number; y: number; z: number; sp: "human" | "fox" | "bear"; pose: "stand" | "stride" | "slash"; back: boolean }[] = [];
  const anim = q.get("anim");
  const ts = (q.get("ts") ?? "").split(",").filter(Boolean).map(Number);
  if (anim) {
    // motion sheet: one row per species, one column per time; each frame is its own animator run from t = 0
    const yaw0 = (yaws[0]! * Math.PI) / 180;
    list.forEach((si, row) => {
      ts.forEach((tt, col) => {
        const x = fx + (col - (ts.length - 1) / 2) * spacing;
        const z = fz + (row - (list.length - 1) / 2) * Number(q.get("rowsp") ?? 40);
        const sb = SPECIES[si]!.build;
        const prop = q.get("prop");
        const look: Look = { species: si, gear: (q.get("gear") ?? "tunic,trousers,boots,belt").split(",").filter(Boolean) as never, weapon: (q.get("weapon") ?? "sword") as never, build: prop === "heroic" ? heroic(sb) : prop === "chibi" ? chibi(sb) : undefined };
        const built = buildLook(look);
        const an = new Animator(built.sk, built.build, look.weapon, SPECIES[si]!.gait ?? {}, Number(q.get("seed2") ?? 0.37) + si);
        const speed = anim === "run" ? 128 : anim === "walk" ? 80 : 0;
        const action = { idle: ACT.Idle, walk: ACT.Walk, run: ACT.Walk, attack: ACT.Attack, attack2: ACT.Attack, dodge: ACT.Dodge, hurt: ACT.Hurt, death: ACT.Death }[anim] ?? ACT.Idle;
        const ps = newPosed();
        const dt = 1 / 60;
        const steps = Math.round(tt / dt);
        let mz = 0;
        for (let k = 0; k <= steps; k++) {
          an.update(k === 0 ? 0 : dt, { action, t: k * dt, serial: anim === "attack2" ? 1 : 0, speed });
          mz += (anim === "dodge" ? 137 : speed) * dt;
          an.solve(ps, placeM(Math.sin(yaw0) * mz, 0, Math.cos(yaw0) * mz, yaw0), dt);
        }
        const d: CharDraw = { look, x, y: hf.height(x, z), z, yaw: yaw0, pose: an.pose, posed: ps, posedReady: true };
        chars.list.push(d);
      });
    });
  } else list.forEach((si, i) => {
    yaws.forEach((yaw, row) => {
      const inRow = q.get("layout") === "row";
      const col = inRow ? i * yaws.length + row : i, ncol = inRow ? list.length * yaws.length : list.length;
      const x = fx + (col - (ncol - 1) / 2) * spacing;
      const z = inRow ? fz : fz + (row - (yaws.length - 1) / 2) * Number(q.get("rowsp") ?? 40);
      const prop = q.get("prop");
      const sb = SPECIES[si]!.build;
      const look: Look = { species: si, gear: (q.get("gear") ?? "tunic,trousers,boots,belt").split(",").filter(Boolean) as never, weapon: (q.get("weapon") ?? "sword") as never, build: prop === "heroic" ? heroic(sb) : prop === "chibi" ? chibi(sb) : undefined };
      const pose = newPose();
      const b = { ...sb, ...look.build };
      const poses = (q.get("pose") ?? "stand").split(",");
      const pn = poses[i % poses.length]!;
      if (!q.has("rest")) (pn === "stride" ? stride : pn === "slash" ? slash : stand)(pose, b);
      const d: CharDraw = { look, x, y: hf.height(x, z), z, yaw: (yaw * Math.PI) / 180, pose };
      if (chars.mode === ("puppet" as never)) puppets.push({ x, y: d.y, z, sp: (["human", "fox", "bear"] as const)[si] ?? "human", pose: pn as never, back: Math.cos(d.yaw) < 0 });
      else chars.list.push(d);
    });
  });
  console.log(`built in ${(performance.now() - t0).toFixed(0)} ms`);
  let frames = 0;
  let overlay: HTMLCanvasElement | null = null;
  const drawPuppets = async () => {
    if (puppets.length === 0) return;
    const { drawPuppet } = await import("./sketch/puppet");
    if (!overlay) {
      overlay = document.createElement("canvas");
      overlay.width = canvas.width; overlay.height = canvas.height;
      overlay.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none`;
      document.body.appendChild(overlay);
    }
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const k = (r.scale * r.zoom * 36) / 150;
    puppets.sort((a, b) => a.z - b.z);
    for (const p of puppets) {
      const [sx, sy] = r.project([p.x, p.y, p.z]);
      // a soft ground shadow
      ctx.fillStyle = "rgba(20,30,40,0.35)";
      ctx.beginPath(); ctx.ellipse(sx * devicePixelRatio, sy * devicePixelRatio, 34 * k, 11 * k, 0, 0, Math.PI * 2); ctx.fill();
      const img = drawPuppet(p.sp, p.pose, p.back);
      ctx.drawImage(img, sx * devicePixelRatio - 80 * k, sy * devicePixelRatio - 205 * k, 160 * k, 220 * k);
    }
  };
  const loop = () => {
    r.render(Number(q.get("clock") ?? 1.5));
    if (frames === 1) void drawPuppets();
    if (++frames === Number(q.get("frames") ?? 3)) { (window as unknown as { sketchDone: boolean }).sketchDone = true; if (q.has("frames")) return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
