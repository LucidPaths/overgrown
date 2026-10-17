// The bare world, no sim: a fixed camera over a seeded spot (used for terrain captures and biome sheets).
import { PropLayer } from "./render/prop-layer";
import { Renderer } from "./render/renderer";
import { applyTime } from "./render/sky";
import { TerrainLayer } from "./render/terrain-layer";
import { Ground } from "./world/ground";
import { HeightField } from "./world/heightfield";

export function runStatic(canvas: HTMLCanvasElement, q: URLSearchParams): void {
  const seed = Number(q.get("seed") ?? 22);
  const fx = Number(q.get("x") ?? 1600), fz = Number(q.get("y") ?? 980);
  const r = new Renderer(canvas);
  applyTime(r, Number(q.get("hour") ?? 10.5));
  const ground = new Ground(seed);
  const terrain = new TerrainLayer(r.gl, ground);
  const props = new PropLayer(r.gl, ground);
  const hf = new HeightField();
  terrain.onChunk = (rl) => { props.add(rl); hf.add(rl); };
  r.drawables.push(terrain, props);
  const forced = Number(q.get("scale") ?? 0);
  r.resize(Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), forced);
  const rad = r.iw / r.scale > 700 || forced === 1 ? 2 : 1;
  while (terrain.pending(fx, fz, rad, rad) > 0) terrain.update(fx, fz, rad, rad, 25);
  r.focus = [fx, hf.height(fx, fz) || 20, fz];
  let frames = 0;
  const clock = q.get("clock");
  const loop = (t: number) => {
    r.render(clock ? Number(clock) : t / 1000);
    if (++frames === 3) (window as unknown as { sketchDone: boolean }).sketchDone = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
