// Exploration C: "Ink & wash storybook". Watercolour washes with pooled edges and granulation on cream paper,
// a wobbly ink line on every boundary, hatching for shade, characters drawn as inked figures.
import { B, Ground, T, hash01 } from "../world/ground";
import { SEED, VIEW, fbm, hex, maskSampler, mix } from "./common";

const W = 1280, H = 720, S = 32;
type RGB = [number, number, number];
const INK: RGB = [52, 40, 48];
const PAPER: RGB = [244, 236, 214];

export function drawInk(canvas: HTMLCanvasElement): void {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = new Ground(SEED);
  const wash = fbm(21, 3), gran = fbm(23, 2), wob = fbm(25, 2), paperN = fbm(27, 2);
  const isWater = maskSampler(g, (x, y) => g.tile(x, y) >= T.Shallow);
  const isDeep = maskSampler(g, (x, y) => g.tile(x, y) >= T.Deep);
  const isSand = maskSampler(g, (x, y) => g.tile(x, y) === T.Sand || g.tile(x, y) >= T.Shallow);
  const isForest = maskSampler(g, (x, y) => g.biome(x, y) === B.Forest);
  const isDirt = maskSampler(g, (x, y) => g.tile(x, y) === T.Dirt);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const pal = {
    grass: hex("#a9c86a"), forest: hex("#6f9a5e"), dirt: hex("#c9a273"), sand: hex("#ecd9a6"),
    water: hex("#7fb6c9"), deep: hex("#4d86a8"),
  };
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = VIEW.tx0 + px / S, y = VIEW.ty0 + py / S;
      const j = (wob(x * 2, y * 2) - 0.5) * 0.35;
      const vw = isWater(x, y) + j, vd = isDeep(x, y) + j, vs = isSand(x, y) + j, vf = isForest(x, y) + j * 1.5, vdi = isDirt(x, y) + j;
      let c: RGB;
      let edge = 0;
      const band = (v: number) => Math.max(0, 1 - Math.abs(v - 0.5) / 0.09); // pooled pigment near the boundary
      if (vw > 0.5) { c = vd > 0.5 ? pal.deep : pal.water; edge = Math.max(band(vw), band(vd) * 0.6); }
      else if (vs > 0.5) { c = pal.sand; edge = band(vs) * 0.5; }
      else {
        c = mix(pal.grass, pal.forest, Math.min(1, Math.max(0, (vf - 0.35) * 3)));
        if (vdi > 0.5) { c = pal.dirt; edge = band(vdi) * 0.6; }
      }
      const w = (wash(x * 0.5, y * 0.5) - 0.5) * 0.35;
      c = mix(c, w > 0 ? PAPER : [60, 50, 80], Math.abs(w));
      c = mix(c, [c[0] * 0.7, c[1] * 0.68, c[2] * 0.75], edge * 0.8);
      c = mix(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.9], Math.max(0, gran(px * 0.9, py * 0.9) - 0.55) * 2);
      c = mix(c, PAPER, 0.12 + (paperN(px * 0.3, py * 0.3) - 0.5) * 0.1);
      const ink = Math.max(band(vw) > 0.55 ? 1 : 0, band(vs) > 0.7 ? 0.5 : 0);
      if (ink > 0) c = mix(c, INK, ink * 0.85);
      if (vw > 0.6 && Math.abs(Math.sin((y * 3 + wob(x * 0.7, y * 0.7) * 6) * 3.1)) < 0.05 && hash01(3, Math.floor(x * 2), Math.floor(y * 3)) < 0.4) c = mix(c, PAPER, 0.7);
      const i = (py * W + px) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const props: { y: number; draw: () => void }[] = [];
  for (let ty = Math.floor(VIEW.ty0) - 2; ty < VIEW.ty0 + VIEW.th + 2; ty++) {
    for (let tx = Math.floor(VIEW.tx0) - 2; tx < VIEW.tx0 + VIEW.tw + 2; tx++) {
      const t = g.tile(tx, ty), b = g.biome(tx, ty), h = hash01(SEED, tx, ty, 1);
      const sx = (tx - VIEW.tx0 + hash01(SEED, tx, ty, 2)) * S, sy = (ty - VIEW.ty0 + hash01(SEED, tx, ty, 3)) * S;
      if (b === B.Forest && t === T.Grass && h < 0.2) props.push({ y: sy, draw: () => inkTree(ctx, sx, sy, h * 5, false) });
      else if (b === B.Grassland && t === T.Grass && h < 0.035) props.push({ y: sy, draw: () => inkTree(ctx, sx, sy, h * 28, true) });
      else if (b === B.Grassland && t === T.Grass && h < 0.25) props.push({ y: sy, draw: () => inkTuft(ctx, sx, sy, h) });
      else if (b === B.River && t === T.Sand && h < 0.2) props.push({ y: sy, draw: () => inkTuft(ctx, sx, sy, h, true) });
    }
  }
  const actors = [
    { x: 103.5, y: 60, sp: "fox", pose: 0 }, { x: 106, y: 61.2, sp: "human", pose: 1 },
    { x: 112, y: 57, sp: "bird", pose: 0 }, { x: 96, y: 63, sp: "bear", pose: 0 },
  ];
  for (const a of actors) {
    const sx = (a.x - VIEW.tx0) * S, sy = (a.y - VIEW.ty0) * S;
    props.push({ y: sy, draw: () => inkFigure(ctx, sx, sy, a.sp, a.pose) });
  }
  props.sort((a, b) => a.y - b.y);
  for (const p of props) p.draw();
}

function wobblyBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, n = 9): void {
  ctx.beginPath();
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash01(seed, i, 9) * 0.3;
    const rr = r * (0.75 + 0.3 * hash01(seed, i));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]);
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, q = pts[(i + 1) % n]!;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const ox = (mx - cx) * 0.35, oy = (my - cy) * 0.35;
    if (i === 0) ctx.moveTo(p[0], p[1]);
    ctx.quadraticCurveTo(mx + ox, my + oy, q[0], q[1]);
  }
  ctx.closePath();
}

function inkStroke(ctx: CanvasRenderingContext2D, w = 1.6): void {
  ctx.strokeStyle = "rgba(52,40,48,0.92)"; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
}

function hatch(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, step = 4): void {
  ctx.save(); ctx.clip();
  ctx.beginPath();
  for (let k = -h; k < w + h; k += step) { ctx.moveTo(x0 + k, y0 + h); ctx.lineTo(x0 + k + h * 0.8, y0); }
  ctx.strokeStyle = "rgba(52,40,48,0.45)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function inkTree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, round: boolean): void {
  const seed = Math.floor(h * 1e6);
  ctx.fillStyle = "rgba(60,50,80,0.25)"; ctx.beginPath(); ctx.ellipse(x + 6, y + 2, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y + 2); ctx.lineTo(x - 2, y - 30); ctx.lineTo(x + 2, y - 30); ctx.lineTo(x + 4, y + 2); ctx.closePath();
  ctx.fillStyle = "#8a6446"; ctx.fill(); inkStroke(ctx, 1.4);
  const r = round ? 24 : 28 + h * 8;
  wobblyBlob(ctx, x, y - 44, r, seed, round ? 8 : 11);
  ctx.fillStyle = round ? "#93c063" : "#4f8a5a"; ctx.fill();
  ctx.save(); wobblyBlob(ctx, x, y - 44, r, seed, round ? 8 : 11); hatch(ctx, x - r, y - 44 + r * 0.1, r * 2, r); ctx.restore();
  ctx.fillStyle = "rgba(255,248,220,0.35)"; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - 44 - r * 0.35, r * 0.4, r * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
  wobblyBlob(ctx, x, y - 44, r, seed, round ? 8 : 11); inkStroke(ctx, 1.8);
}

function inkTuft(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, reed = false): void {
  ctx.beginPath();
  const n = reed ? 4 : 3, L = reed ? 16 : 7;
  for (let i = 0; i < n; i++) { ctx.moveTo(x + i * 2.5 - 3, y); ctx.lineTo(x + (i - 1) * 3 + (h - 0.1) * 20, y - L - i * 2); }
  inkStroke(ctx, 1.1);
  if (!reed && h > 0.15) { ctx.fillStyle = ["#e86a5a", "#f2c84b", "#fff6e0"][Math.floor(h * 100) % 3]!; ctx.beginPath(); ctx.arc(x + 2, y - 8, 2.4, 0, Math.PI * 2); ctx.fill(); inkStroke(ctx, 0.9); }
}

const SP: Record<string, { fur: string; cloth: string; ears: string; snout?: string }> = {
  human: { fur: "#f2c6a0", cloth: "#c8574a", ears: "none" },
  fox: { fur: "#e48a45", cloth: "#5b8fb5", ears: "fox", snout: "#fbf0dc" },
  bear: { fur: "#93644a", cloth: "#7a9a4a", ears: "round", snout: "#dcb994" },
  bird: { fur: "#5b95d0", cloth: "#d9b04a", ears: "crest", snout: "#f0a040" },
};

function inkFigure(ctx: CanvasRenderingContext2D, x: number, y: number, sp: string, pose: number): void {
  const s = SP[sp]!;
  ctx.fillStyle = "rgba(60,50,80,0.25)"; ctx.beginPath(); ctx.ellipse(x + 3, y, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  const part = (fn: () => void, fill: string) => { ctx.beginPath(); fn(); ctx.fillStyle = fill; ctx.fill(); inkStroke(ctx, 1.6); };
  part(() => ctx.roundRect(x - 8, y - 16, 6, 16, 2), "#5d5068");
  part(() => ctx.roundRect(x + 2, y - 16, 6, 16, 2), "#5d5068");
  const torso = () => { ctx.moveTo(x - 11, y - 12); ctx.quadraticCurveTo(x - 12, y - 36, x, y - 37); ctx.quadraticCurveTo(x + 12, y - 36, x + 11, y - 12); ctx.closePath(); };
  part(torso, s.cloth);
  ctx.save(); ctx.beginPath(); torso(); hatch(ctx, x - 12, y - 22, 24, 10, 3); ctx.restore();
  if (s.ears === "fox") for (const k of [-1, 1]) part(() => { ctx.moveTo(x + k * 4, y - 58); ctx.lineTo(x + k * 13, y - 72); ctx.lineTo(x + k * 14, y - 52); ctx.closePath(); }, s.fur);
  if (s.ears === "round") for (const k of [-1, 1]) part(() => ctx.arc(x + k * 11, y - 61, 5.5, 0, Math.PI * 2), s.fur);
  if (s.ears === "crest") part(() => { ctx.moveTo(x - 3, y - 62); ctx.quadraticCurveTo(x - 2, y - 80, x + 7, y - 74); ctx.lineTo(x + 5, y - 62); ctx.closePath(); }, "#d9504a");
  part(() => ctx.ellipse(x, y - 50, 13.5, 12.5, 0, 0, Math.PI * 2), s.fur);
  if (s.snout) part(() => ctx.ellipse(x, y - 44, 6.5, 4.5, 0, 0, Math.PI * 2), s.snout);
  ctx.fillStyle = "#2a2030"; ctx.beginPath(); ctx.arc(x - 5, y - 52, 1.8, 0, 7); ctx.arc(x + 5, y - 52, 1.8, 0, 7); ctx.fill();
  if (pose === 1) {
    part(() => { ctx.moveTo(x + 10, y - 32); ctx.lineTo(x + 40, y - 62); ctx.lineTo(x + 43, y - 59); ctx.lineTo(x + 13, y - 29); ctx.closePath(); }, "#e6e8ee");
    ctx.beginPath(); ctx.arc(x + 4, y - 30, 48, -1.75, -0.15); ctx.strokeStyle = "rgba(52,40,48,0.6)"; ctx.lineWidth = 1; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const k of [-1, 1]) part(() => ctx.ellipse(x + k * 12, y - 26, 3.5, 7, k * 0.2, 0, 7), s.fur);
}
