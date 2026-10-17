// Exploration B: "Paper theatre". Every terrain class is a sheet of torn paper stacked by height, with
// drop shadows; trees are stacked paper discs; characters are flat cut-out puppets pinned at the joints.
import { B, Ground, T, hash01 } from "../world/ground";
import { SEED, VIEW, fbm, hex, maskSampler, mix, rank } from "./common";

const W = 1280, H = 720, S = 32; // screen px per tile

type RGB = [number, number, number];
const PAPER: Record<string, string> = {
  vdeep: "#1f4e79", deep: "#2c6c9c", shallow: "#58a9c4", sand: "#e8cf98",
  grass: "#8cc152", forestGrass: "#4f8f4a", dirt: "#b98a5a", stone: "#a8a49a", cliff: "#7c7468",
};

export function drawPaper(canvas: HTMLCanvasElement): void {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = new Ground(SEED);
  const tear = fbm(7, 3), grain = fbm(11, 2), patch = fbm(13, 3);
  ctx.fillStyle = PAPER.vdeep!; ctx.fillRect(0, 0, W, H);

  const layers: { pred: (tx: number, ty: number) => boolean; color: (tx: number, ty: number) => RGB; lift: number }[] = [
    { pred: (x, y) => rank(g.tile(x, y)) >= 1, color: () => hex(PAPER.deep!), lift: 2 },
    { pred: (x, y) => rank(g.tile(x, y)) >= 2, color: () => hex(PAPER.shallow!), lift: 3 },
    { pred: (x, y) => rank(g.tile(x, y)) >= 3, color: () => hex(PAPER.sand!), lift: 4 },
    {
      pred: (x, y) => rank(g.tile(x, y)) >= 4,
      color: (x, y) => (g.biome(x, y) === B.Forest ? hex(PAPER.forestGrass!) : hex(PAPER.grass!)),
      lift: 4,
    },
    { pred: (x, y) => g.tile(x, y) === T.Dirt, color: () => hex(PAPER.dirt!), lift: 2 },
  ];

  for (const L of layers) {
    const m = maskSampler(g, L.pred);
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(W, H);
    const d = img.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x = VIEW.tx0 + px / S, y = VIEW.ty0 + py / S;
        const v = m(x, y) + (tear(x * 1.7, y * 1.7) - 0.5) * 0.55 + (tear(x * 9, y * 9) - 0.5) * 0.12;
        if (v < 0.47) continue;
        const i = (py * W + px) * 4;
        const tx = Math.floor(x), ty = Math.floor(y);
        let c = L.color(tx, ty);
        // torn white fibre rim
        if (v < 0.52) c = [246, 240, 226];
        else {
          const k = (patch(x * 0.4, y * 0.4) - 0.5) * 0.25 + (grain(px * 0.7, py * 0.7) - 0.5) * 0.08;
          c = mix(c, k > 0 ? [255, 250, 230] : [40, 30, 60], Math.abs(k));
        }
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.save();
    ctx.shadowColor = "rgba(30,20,50,0.45)";
    ctx.shadowBlur = 6; ctx.shadowOffsetX = L.lift * 0.5; ctx.shadowOffsetY = L.lift;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  // props: collect, then draw sorted by y
  const props: { y: number; draw: () => void }[] = [];
  for (let ty = Math.floor(VIEW.ty0) - 2; ty < VIEW.ty0 + VIEW.th + 2; ty++) {
    for (let tx = Math.floor(VIEW.tx0) - 2; tx < VIEW.tx0 + VIEW.tw + 2; tx++) {
      const t = g.tile(tx, ty), b = g.biome(tx, ty);
      const h = hash01(SEED, tx, ty, 1);
      const sx = (tx - VIEW.tx0 + hash01(SEED, tx, ty, 2)) * S, sy = (ty - VIEW.ty0 + hash01(SEED, tx, ty, 3)) * S;
      if (b === B.Forest && t === T.Grass && h < 0.22) props.push({ y: sy, draw: () => paperTree(ctx, sx, sy, h * 4.5) });
      else if (b === B.Grassland && t === T.Grass && h < 0.04) props.push({ y: sy, draw: () => paperTree(ctx, sx, sy, h * 20, true) });
      else if (b === B.Grassland && t === T.Grass && h < 0.2) props.push({ y: sy, draw: () => paperFlower(ctx, sx, sy, h) });
      else if (b === B.River && t === T.Sand && h < 0.15) props.push({ y: sy, draw: () => paperReed(ctx, sx, sy, h) });
    }
  }
  const actors = [
    { x: 103.5, y: 60, sp: "fox", pose: 0 }, { x: 106, y: 61.2, sp: "human", pose: 1 },
    { x: 112, y: 57, sp: "bird", pose: 0 }, { x: 96, y: 63, sp: "bear", pose: 0 },
  ];
  for (const a of actors) {
    const sx = (a.x - VIEW.tx0) * S, sy = (a.y - VIEW.ty0) * S;
    props.push({ y: sy, draw: () => puppet(ctx, sx, sy, a.sp, a.pose) });
  }
  props.sort((a, b) => a.y - b.y);
  for (const p of props) p.draw();
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, squash = 1): void {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (0.88 + 0.12 * hash01(seed, i % 24));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * squash;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sheet(ctx: CanvasRenderingContext2D, fill: string, lift = 3): void {
  ctx.save();
  ctx.shadowColor = "rgba(25,20,45,0.4)"; ctx.shadowBlur = 5; ctx.shadowOffsetX = lift * 0.5; ctx.shadowOffsetY = lift;
  ctx.fillStyle = "#f6f0e2"; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.clip();
  ctx.fillStyle = fill; ctx.translate(-1, -1.5); ctx.fill();
  ctx.restore();
}

function paperTree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, round = false): void {
  const seed = Math.floor(h * 1e6);
  ctx.fillStyle = "#6b4a32";
  ctx.beginPath(); ctx.roundRect(x - 4, y - 26, 8, 28, 3); sheet(ctx, "#7a5236", 2);
  const greens = round ? ["#5f9e3c", "#7dbb4a", "#a2d465"] : ["#2f6b45", "#3f8a52", "#5aa860"];
  const r0 = round ? 26 : 30 + h * 10;
  for (let k = 0; k < 3; k++) {
    blob(ctx, x + (k - 1) * 2, y - 40 - k * 10, r0 * (1 - k * 0.22), seed + k, 0.85);
    sheet(ctx, greens[k]!, 5 - k);
  }
}
function paperFlower(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const cols = ["#f2d24b", "#f28b6b", "#fff4d6", "#d97bc8"];
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 3 : 7;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
  }
  ctx.closePath(); sheet(ctx, cols[Math.floor(h * 20) % 4]!, 2);
}
function paperReed(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const bx = x + i * 5 - 5;
    ctx.moveTo(bx - 2, y); ctx.quadraticCurveTo(bx + (h - 0.07) * 60, y - 20, bx + 2 + i, y - 30 - i * 4); ctx.lineTo(bx + 2, y);
    sheet(ctx, i === 1 ? "#9fbf5a" : "#7ea34a", 2);
  }
}

const SPECIES: Record<string, { skin: string; cloth: string; ears: "fox" | "round" | "none" | "crest"; snout?: string }> = {
  human: { skin: "#f0c09a", cloth: "#d0483e", ears: "none" },
  fox: { skin: "#e8833a", cloth: "#3f8fbf", ears: "fox", snout: "#fff2df" },
  bear: { skin: "#8a5a3c", cloth: "#5f8a3a", ears: "round", snout: "#d9b28a" },
  bird: { skin: "#4a90d9", cloth: "#e0b040", ears: "crest", snout: "#f2a33a" },
};

function puppet(ctx: CanvasRenderingContext2D, x: number, y: number, sp: string, pose: number): void {
  const s = SPECIES[sp]!;
  // ground shadow
  ctx.fillStyle = "rgba(30,20,50,0.3)"; ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  const piece = (fn: () => void, fill: string, lift = 2) => { ctx.beginPath(); fn(); sheet(ctx, fill, lift); };
  // legs
  piece(() => ctx.roundRect(x - 9, y - 18, 7, 18, 3), "#5a4a6a");
  piece(() => ctx.roundRect(x + 2, y - 18, 7, 18, 3), "#5a4a6a");
  // body
  piece(() => { ctx.moveTo(x - 11, y - 14); ctx.lineTo(x - 8, y - 38); ctx.lineTo(x + 8, y - 38); ctx.lineTo(x + 11, y - 14); }, s.cloth);
  // arms
  const armA = pose === 1 ? -2.2 : 0.25;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(x + side * 9, y - 35); ctx.rotate(side === 1 ? armA : -0.25);
    piece(() => ctx.roundRect(-3.5, 0, 7, 20, 3.5), s.skin);
    if (side === 1 && pose === 1) {
      piece(() => { ctx.rect(-2, 18, 4, 30); }, "#d9dde6", 3);
    }
    ctx.restore();
    ctx.fillStyle = "#c9a227"; ctx.beginPath(); ctx.arc(x + side * 9, y - 34, 2, 0, Math.PI * 2); ctx.fill();
  }
  // head + ears
  if (s.ears === "fox") {
    for (const side of [-1, 1]) piece(() => { ctx.moveTo(x + side * 4, y - 58); ctx.lineTo(x + side * 14, y - 74); ctx.lineTo(x + side * 15, y - 52); }, s.skin);
  } else if (s.ears === "round") {
    for (const side of [-1, 1]) piece(() => ctx.arc(x + side * 11, y - 62, 6, 0, Math.PI * 2), s.skin);
  } else if (s.ears === "crest") {
    piece(() => { ctx.moveTo(x - 3, y - 64); ctx.lineTo(x + 2, y - 80); ctx.lineTo(x + 6, y - 62); }, "#e04a4a");
  }
  piece(() => ctx.ellipse(x, y - 52, 14, 13, 0, 0, Math.PI * 2), s.skin, 3);
  if (s.snout) piece(() => ctx.ellipse(x, y - 46, 7, 5, 0, 0, Math.PI * 2), s.snout, 1);
  ctx.fillStyle = "#2a2035";
  ctx.beginPath(); ctx.arc(x - 5, y - 54, 2, 0, Math.PI * 2); ctx.arc(x + 5, y - 54, 2, 0, Math.PI * 2); ctx.fill();
  if (pose === 1) {
    ctx.strokeStyle = "rgba(255,250,220,0.9)"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x + 8, y - 35, 46, -1.9, -0.2); ctx.stroke();
  }
}
