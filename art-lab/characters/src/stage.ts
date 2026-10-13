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
import { newPose, setRot } from "./rig/pose";
import { B } from "./rig/skeleton";

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
  list.forEach((si, i) => {
    yaws.forEach((yaw, row) => {
      const x = fx + (i - (list.length - 1) / 2) * spacing;
      const z = fz + (row - (yaws.length - 1) / 2) * Number(q.get("rowsp") ?? 40);
      const look: Look = { species: si, gear: ["tunic", "trousers", "boots", "belt"], weapon: (q.get("weapon") ?? "sword") as never };
      const pose = newPose();
      const a = SPECIES[si]!.build.aPose;
      if (!q.has("rest")) setRot(pose, B.armL, -0.05, 0, -a + 0.12);
      if (!q.has("rest")) { setRot(pose, B.armR, -0.05, 0, a - 0.12); setRot(pose, B.foreL, -0.25); setRot(pose, B.foreR, -0.6); }
      const d: CharDraw = { look, x, y: hf.height(x, z), z, yaw: (yaw * Math.PI) / 180, pose };
      chars.list.push(d);
    });
  });
  console.log(`built in ${(performance.now() - t0).toFixed(0)} ms`);
  let frames = 0;
  const loop = () => {
    r.render(Number(q.get("clock") ?? 1.5));
    if (++frames === Number(q.get("frames") ?? 3)) { (window as unknown as { sketchDone: boolean }).sketchDone = true; if (q.has("frames")) return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
