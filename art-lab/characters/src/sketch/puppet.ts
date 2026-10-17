// Exploration C: 2D cut-out puppets (the Cult of the Lamb / Don't Starve family). Flat vector parts with a heavy
// ink line, a hard shadow shape, big heads; drawn with Canvas2D and laid over the world at the characters' feet.
// Exploration code: it draws stills (front and back views) to judge the look; it is not shipped.

type Pt = [number, number];
export type PuppetSpecies = "human" | "fox" | "bear";
export type PuppetPose = "stand" | "stride" | "slash";

const INK = "#1f1724";

interface Pal { body: string; body2: string; shade: string; cloth: string; clothShade: string; pants: string; boot: string; hair?: string; nose: string }
const PAL: Record<PuppetSpecies, Pal> = {
  human: { body: "#f2c4a0", body2: "#f2c4a0", shade: "#d68f78", cloth: "#3d6fae", clothShade: "#2a4c86", pants: "#e2d8bf", boot: "#4a3428", hair: "#5a3422", nose: "#d68f78" },
  fox: { body: "#e0702a", body2: "#fbf1e2", shade: "#b04e22", cloth: "#3d6fae", clothShade: "#2a4c86", pants: "#e2d8bf", boot: "#3a2626", nose: "#2a2028" },
  bear: { body: "#8a5634", body2: "#d8b088", shade: "#653c26", cloth: "#3d6fae", clothShade: "#2a4c86", pants: "#e2d8bf", boot: "#4a3428", nose: "#2a2028" },
};

function blob(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string, line = 3): void {
  // a closed smooth curve through the points (quadratic midpoints)
  ctx.beginPath();
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, m = mid(p, pts[(i + 1) % n]!);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.stroke(); }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, line = 3, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}

/** A limb: a tapered stroke drawn as two ink passes (fat dark, then the colour). */
function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, fill: string, c?: Pt): void {
  for (const [col, ww] of [[INK, w + 6], [fill, w]] as const) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    if (c) ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    else ctx.lineTo(b[0], b[1]);
    ctx.lineCap = "round";
    ctx.lineWidth = ww;
    ctx.strokeStyle = col;
    ctx.stroke();
  }
}

/**
 * Draws one puppet into a canvas sized 160x220, feet at (80, 205). Units are canvas px (about 2 per world px at
 * the shot scale). `back` draws the rear view.
 */
export function drawPuppet(sp: PuppetSpecies, pose: PuppetPose, back: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 220;
  const ctx = cv.getContext("2d")!;
  const P = PAL[sp];
  const fx = 80, fy = 205;
  const big = sp === "bear" ? 1.18 : 1;
  const st = pose === "stride" ? 1 : 0;
  const sl = pose === "slash" ? 1 : 0;
  // tail behind (front view) / in front (back view)
  const tail = () => {
    if (sp === "fox") {
      blob(ctx, [[fx + 18, fy - 52], [fx + 52, fy - 70], [fx + 62, fy - 100], [fx + 48, fy - 118], [fx + 36, fy - 96], [fx + 22, fy - 70]], P.body, 3);
      blob(ctx, [[fx + 44, fy - 110], [fx + 52, fy - 120], [fx + 62, fy - 100], [fx + 56, fy - 98]], P.body2, 0);
    }
    if (sp === "bear") ellipse(ctx, fx, fy - 56, 7, 6, P.body);
  };
  if (!back) tail();
  // legs
  const legW = 12 * big, hipY = fy - 46;
  const lx = 10 * big;
  limb(ctx, [fx - lx, hipY], [fx - lx - 8 * st, fy - 8], legW, P.pants);
  limb(ctx, [fx + lx, hipY], [fx + lx + 8 * st, fy - 8 + 3 * st], legW, P.pants);
  for (const [x, s] of [[fx - lx - 8 * st, -1], [fx + lx + 8 * st, 1]] as const) blob(ctx, [[x - 9, fy - 10], [x + 9, fy - 12], [x + 11 + s * 2, fy - 1], [x - 11 + s * 2, fy]], P.boot, 3);
  // arms behind the body for the back arm in a slash
  const shoulderY = fy - 92 * (sp === "bear" ? 0.98 : 1);
  const armCol = P.cloth;
  // body: a soft trapezoid tunic
  const bw = 30 * big, bwB = 34 * big;
  blob(ctx, [[fx - bw, shoulderY + 6], [fx, shoulderY - 4], [fx + bw, shoulderY + 6], [fx + bwB, hipY + 6], [fx, hipY + 12], [fx - bwB, hipY + 6]], P.cloth, 3);
  // hard shadow on the body's right side (light from upper left)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(fx + bw * 0.35, shoulderY + 2); ctx.lineTo(fx + bw + 2, shoulderY + 6); ctx.lineTo(fx + bwB + 2, hipY + 6); ctx.lineTo(fx + bwB * 0.2, hipY + 11);
  ctx.closePath(); ctx.clip();
  blob(ctx, [[fx - bw, shoulderY + 6], [fx, shoulderY - 4], [fx + bw, shoulderY + 6], [fx + bwB, hipY + 6], [fx, hipY + 12], [fx - bwB, hipY + 6]], P.clothShade, 0);
  ctx.restore();
  // belt
  ctx.fillStyle = "#6a4128"; ctx.fillRect(fx - bwB + 4, hipY - 6, (bwB - 4) * 2, 6);
  if (!back) { ctx.fillStyle = "#e0b040"; ctx.fillRect(fx - 4, hipY - 7, 8, 8); }
  // arms
  if (sl) {
    limb(ctx, [fx + bw - 2, shoulderY + 10], [fx + bw + 30, shoulderY - 6], 11 * big, armCol, [fx + bw + 18, shoulderY + 12]);
    ellipse(ctx, fx + bw + 32, shoulderY - 8, 7 * big, 7 * big, P.body);
    // sword over the head, a smear behind it
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(fx + bw + 32, shoulderY - 8); ctx.arc(fx + bw + 32, shoulderY - 8, 70, -2.6, -1.0); ctx.closePath();
    ctx.fillStyle = "#fff6dc"; ctx.fill();
    ctx.restore();
    limb(ctx, [fx + bw + 32, shoulderY - 8], [fx + bw - 10, shoulderY - 70], 5, "#dfe4ee");
    limb(ctx, [fx - bw + 2, shoulderY + 10], [fx - bw - 14, shoulderY + 34], 11 * big, armCol);
    ellipse(ctx, fx - bw - 15, shoulderY + 36, 7 * big, 7 * big, P.body);
  } else {
    const sw = st * 10;
    limb(ctx, [fx - bw + 2, shoulderY + 10], [fx - bw - 6 + sw, shoulderY + 44], 11 * big, armCol);
    limb(ctx, [fx + bw - 2, shoulderY + 10], [fx + bw + 6 - sw, shoulderY + 44], 11 * big, armCol);
    ellipse(ctx, fx - bw - 6 + sw, shoulderY + 47, 7 * big, 7 * big, P.body);
    ellipse(ctx, fx + bw + 6 - sw, shoulderY + 47, 7 * big, 7 * big, P.body);
    if (!back) limb(ctx, [fx + bw + 6 - sw, shoulderY + 47], [fx + bw + 10 - sw, shoulderY + 82], 5, "#dfe4ee");
  }
  // head: big, round
  const hr = 34 * (sp === "bear" ? 1.06 : 1);
  const hy = shoulderY - hr * 0.78;
  if (sp === "fox") {
    for (const s of [-1, 1]) blob(ctx, [[fx + s * 10, hy - hr * 0.6], [fx + s * 34, hy - hr * 1.55], [fx + s * 34, hy - hr * 0.35]], P.body, 3);
    if (!back) for (const s of [-1, 1]) blob(ctx, [[fx + s * 17, hy - hr * 0.6], [fx + s * 31, hy - hr * 1.25], [fx + s * 30, hy - hr * 0.5]], "#3a2626", 0);
  }
  if (sp === "bear") for (const s of [-1, 1]) { ellipse(ctx, fx + s * hr * 0.72, hy - hr * 0.72, 11, 11, P.body); if (!back) ellipse(ctx, fx + s * hr * 0.72, hy - hr * 0.72, 6, 6, P.body2, 0); }
  ellipse(ctx, fx, hy, hr * (sp === "fox" ? 0.95 : 1.02), hr * 0.9, P.body);
  // head shade: a crescent on the right
  ctx.save();
  ctx.beginPath(); ctx.ellipse(fx, hy, hr * 1.0 - 1.5, hr * 0.9 - 1.5, 0, 0, Math.PI * 2); ctx.clip();
  ellipse(ctx, fx - hr * 0.28, hy - hr * 0.18, hr * 1.02, hr * 0.98, "rgba(0,0,0,0)", 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.beginPath(); ctx.rect(fx - hr, hy - hr, hr * 2, hr * 2); ctx.ellipse(fx - hr * 0.22, hy - hr * 0.16, hr * 0.98, hr * 0.92, 0, 0, Math.PI * 2, true);
  ctx.fillStyle = P.shade; ctx.fill("evenodd");
  ctx.restore();
  if (!back) {
    if (sp === "human") {
      blob(ctx, [[fx - hr * 1.0, hy - 2], [fx - hr * 0.9, hy - hr * 0.8], [fx, hy - hr * 1.02], [fx + hr * 0.95, hy - hr * 0.7], [fx + hr * 1.02, hy], [fx + hr * 0.5, hy - hr * 0.45], [fx - hr * 0.2, hy - hr * 0.35], [fx - hr * 0.6, hy - hr * 0.5]], P.hair!, 3);
    }
    if (sp === "fox") {
      blob(ctx, [[fx - hr * 0.55, hy + hr * 0.1], [fx, hy + hr * 0.95], [fx + hr * 0.55, hy + hr * 0.1], [fx, hy + hr * 0.35]], P.body2, 0);
      ellipse(ctx, fx, hy + hr * 0.62, 5, 4, P.nose, 0);
    }
    if (sp === "bear") {
      ellipse(ctx, fx, hy + hr * 0.38, hr * 0.42, hr * 0.32, P.body2);
      ellipse(ctx, fx, hy + hr * 0.26, 6, 4.5, P.nose, 0);
    }
    // eyes: big, with a catchlight
    const ey = hy + (sp === "human" ? hr * 0.1 : -hr * 0.02);
    const ex = sp === "bear" ? hr * 0.42 : hr * 0.36;
    for (const s of [-1, 1]) {
      if (sl) {
        ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(fx + s * ex - 6, ey - 2 + s * 3); ctx.lineTo(fx + s * ex + 6, ey - 2 - s * 3); ctx.stroke();
        ellipse(ctx, fx + s * ex, ey + 4, 4.5, 5, INK, 0);
      } else {
        ellipse(ctx, fx + s * ex, ey, 6, 8.5, INK, 0);
        ellipse(ctx, fx + s * ex - 2, ey - 3.5, 2.4, 2.4, "#fff8ec", 0);
      }
    }
    if (sp === "human") {
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath();
      if (sl) ctx.ellipse(fx, hy + hr * 0.55, 5, 4, 0, 0, Math.PI * 2); else ctx.arc(fx, hy + hr * 0.42, 6, 0.2, Math.PI - 0.2);
      ctx.stroke();
      for (const s of [-1, 1]) ellipse(ctx, fx + s * hr * 0.62, hy + hr * 0.38, 6, 3.5, "rgba(230,110,110,0.55)", 0);
    }
  } else {
    if (sp === "human") ellipse(ctx, fx, hy - hr * 0.08, hr * 1.0, hr * 0.85, P.hair!);
  }
  if (back) tail();
  return cv;
}
