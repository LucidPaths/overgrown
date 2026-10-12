// Stage: deterministic posed scenes for captures (species lineups, motion sheets). Same renderer, same world, same
// actors as the game; only the clock and the placement are fixed. ?mode=stage&view=lineup&anim=walk&t=0.25
import { attack, clearPose, death, dodge, hurt, idle, locomotion, newPose, ATTACK_S, DODGE_S, type Pose } from "./actors/anim";
import { SPECIES } from "./actors/species";
import { ActorLayer, type ActorDraw } from "./render/actor-layer";
import { PropLayer } from "./render/prop-layer";
import { Renderer } from "./render/renderer";
import { TerrainLayer } from "./render/terrain-layer";
import { Ground } from "./world/ground";
import { HeightField } from "./world/heightfield";
import { clearings } from "./world/placement";
import { applyTime } from "./render/sky";
import type { Weapon } from "./actors/rig";

export function runStage(canvas: HTMLCanvasElement, q: URLSearchParams): void {
  const seed = Number(q.get("seed") ?? 22);
  const view = q.get("view") ?? "lineup";
  const anim = q.get("anim") ?? "idle";
  const t = Number(q.get("t") ?? 0.3);
  const fx = Number(q.get("x") ?? 2080), fz = Number(q.get("y") ?? 1032);
  const scale = Number(q.get("scale") ?? 4);
  const spacing = Number(q.get("sp") ?? 34);
  clearings.push({ tx: Math.floor(fx / 16), ty: Math.floor(fz / 16), r: Number(q.get("clear") ?? 6) });

  const r = new Renderer(canvas);
  applyTime(r, Number(q.get("hour") ?? 10.5));
  const ground = new Ground(seed);
  const terrain = new TerrainLayer(r.gl, ground);
  const props = new PropLayer(r.gl, ground);
  const actors = new ActorLayer(r.gl);
  const hf = new HeightField();
  terrain.onChunk = (rl) => { props.add(rl); hf.add(rl); };
  r.drawables.push(terrain, props, actors);
  const W = Number(q.get("w") ?? innerWidth), H = Number(q.get("h") ?? innerHeight);
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  r.resize(Math.round(W * devicePixelRatio), Math.round(H * devicePixelRatio), scale);
  while (terrain.pending(fx, fz, 1, 1) > 0) terrain.update(fx, fz, 1, 1, 25);
  const gy = hf.height(fx, fz);
  r.focus = [fx, gy + Number(q.get("lift") ?? 18), fz];

  const weapons: Weapon[] = ["sword", "axe", "sword", "axe", "dagger", "none", "spear", "dagger", "sword"];
  const species = q.get("species");
  const list: number[] = species ? species.split(",").map(Number) : SPECIES.map((_, i) => i);
  const yaws = (q.get("yaw") ?? "0").split(",").map(Number);
  const rows = yaws.length;
  const weaponOverride = q.get("weapon") as Weapon | null;
  const draws: ActorDraw[] = [];
  list.forEach((si, i) => {
    yaws.forEach((yaw, row) => {
      const x = fx + (i - (list.length - 1) / 2) * spacing;
      const z = fz + (row - (rows - 1) / 2) * Number(q.get("rowsp") ?? 40);
      const pose = newPose();
      const weapon = weaponOverride ?? weapons[si]!;
      draws.push({
        look: { species: si, dye: (si * 4 + 1) % 9, weapon, trousers: si % 4 },
        x, y: hf.height(x, z), z, yaw: (yaw * Math.PI) / 180, pose, sil: [0.95, 0.9, 0.6], attackU: -1,
      });
    });
  });
  const posed = (d: ActorDraw, i: number, time: number) => {
    const p: Pose = d.pose;
    clearPose(p);
    const rig = actors.rigFor(d.look).rig;
    switch (anim) {
      case "idle": idle(p, rig, time, i * 1.7); break;
      case "walk": locomotion(p, rig, time, 0, time); break;
      case "run": locomotion(p, rig, time, 1, time); break;
      case "attack": { const u = Math.min(1, time); attack(p, rig, u); d.attackU = u; break; }
      case "dodge": dodge(p, rig, Math.min(1, time)); break;
      case "hurt": hurt(p, rig, Math.min(1, time)); break;
      case "death": death(p, rig, time); break;
    }
  };
  draws.forEach((d, i) => posed(d, i, t));
  actors.list.push(...draws);
  void ATTACK_S; void DODGE_S;
  let frames = 0;
  const loop = () => {
    r.render(Number(q.get("clock") ?? 1.5));
    if (++frames === 3) (window as unknown as { sketchDone: boolean }).sketchDone = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  void view;
}
