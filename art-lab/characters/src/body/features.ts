// Shared sculpt features: hair locks, beards, flat ears, snouts. Every helper works in head space (the head
// ellipsoid's centre and radii), so the same hairstyle fits any species' head without being re-authored.
import { Op, alongY, euler, type Model, type V3 } from "../sdf/model";
import { B } from "../rig/skeleton";
import { add, lerpV, scaleV, sub, type Build, type Joints } from "./build";
import { M } from "./mats";

/** A point on the head ellipsoid (grown by `grow`): azimuth `az` from the face (+z) toward the left (+x), elevation `el`. */
export function scalp(j: Joints, b: Build, az: number, el: number, grow = 1.0): V3 {
  const h = j.headC, R = b.head;
  return [h[0] + R[0] * grow * Math.cos(el) * Math.sin(az), h[1] + R[1] * grow * Math.sin(el), h[2] + R[2] * grow * Math.cos(el) * Math.cos(az)];
}

/** Outward unit normal of the head ellipsoid at (az, el). */
export function scalpN(b: Build, az: number, el: number): V3 {
  const R = b.head;
  const n: V3 = [Math.cos(el) * Math.sin(az) / R[0], Math.sin(el) / R[1], Math.cos(el) * Math.cos(az) / R[2]];
  const l = Math.hypot(...n);
  return [n[0] / l, n[1] / l, n[2] / l];
}

/**
 * One lock of hair: a tapered tube that leaves the scalp at (az, el), runs `len` px over the head toward
 * (az + daz, el + del), lifted `lift` px off the surface at its middle and ending in a point. Locks are
 * blended into the hair mass with a small radius, so each one keeps a groove on both sides: clumps read at
 * any distance where strands never would.
 */
export interface Lock {
  az: number;
  el: number;
  daz: number;
  del: number;
  /** root radius, px */
  r: number;
  /** how far the tip stands off the head (px): flicks, spikes */
  lift: number;
  /** extra length beyond the end point, along the last direction (px) */
  over?: number;
}

export function lock(m: Model, j: Joints, b: Build, L: Lock, mat = M.hair, bone: number = B.head, grow = 1.04): void {
  const a = scalp(j, b, L.az, L.el, grow);
  const mid = add(scalp(j, b, L.az + L.daz * 0.5, L.el + L.del * 0.5, grow), scaleV(scalpN(b, L.az + L.daz * 0.5, L.el + L.del * 0.5), L.lift * 0.45 + L.r * 0.35));
  let tip = add(scalp(j, b, L.az + L.daz, L.el + L.del, grow), scaleV(scalpN(b, L.az + L.daz, L.el + L.del), L.lift + L.r * 0.2));
  if (L.over) {
    const d = sub(tip, mid);
    const l = Math.hypot(...d) || 1;
    tip = add(tip, scaleV(d, L.over / l));
  }
  m.cone(a, mid, L.r, L.r * 0.8, { mat, bone, k: 0.45 });
  m.cone(mid, tip, L.r * 0.8, 0.12, { mat, bone, k: 0.3 });
}

export type HairStyle = "tousled" | "swept" | "long" | "bun" | "braid" | "mohawk" | "crop" | "none";

/**
 * Hair: a cap that hugs the cranium (crisp hairline, cut away over the face and at the nape) plus locks. The
 * cap carries the mass, the locks carry the style and the silhouette from above.
 */
export function hair(m: Model, b: Build, j: Joints, style: HairStyle, mat = M.hair): void {
  if (style === "none") return;
  const h = j.headC, R = b.head;
  m.beginSolid();
  const o = { mat, bone: B.head };
  // the cap
  const crop = style === "crop" || style === "mohawk";
  const g = crop ? 1.03 : 1.08;
  m.ellipsoid(add(h, [0, R[1] * 0.1, -R[2] * 0.06]), [R[0] * g, R[1] * (crop ? 0.97 : 1.0), R[2] * g], o);
  // face window: below the hairline, in front of the ears
  const hairline = crop ? 0.42 : 0.3;
  m.box(add(h, [0, -R[1] * (0.62 - hairline), R[2] * 1.0]), [R[0] * 0.98, R[1] * 0.9, R[2] * 0.8], 1.2, { ...o, op: Op.Subtract, k: 0.5 });
  // nape and below the ears
  if (style !== "long" && style !== "braid") m.box(add(h, [0, -R[1] * 1.2, -R[2] * 0.15]), [R[0] * 1.5, R[1] * 0.78, R[2] * 1.5], 0.6, { ...o, op: Op.Subtract, k: 0.6 });
  if (style === "mohawk") {
    // shave the sides, keep a ridge
    for (const s of [1, -1]) m.box(add(h, [s * R[0] * 1.02, R[1] * 0.2, 0]), [R[0] * 0.62, R[1] * 1.1, R[2] * 1.3], 0.5, { ...o, op: Op.Subtract, k: 0.4 });
    for (let i = 0; i < 6; i++) {
      const el = 1.25 - i * 0.42;
      lock(m, j, b, { az: Math.PI * (i > 2 ? 1 : 0), el: i > 2 ? Math.PI - el : el, daz: 0, del: -0.3, r: 1.05 - i * 0.06, lift: 2.4 - i * 0.2 }, mat);
    }
    m.useLayer(0);
    return;
  }
  // fringe: locks that start on the crown and fall over the brow, swept to one side
  const sweep = style === "swept" ? 0.5 : 0.18;
  const fr: [number, number, number][] = style === "crop" ? [[-0.5, 0.95, 0.75], [0.1, 1.0, 0.8], [0.6, 0.9, 0.7]] : [[-0.75, 1.0, 0.95], [-0.2, 1.08, 1.1], [0.35, 1.04, 1.05], [0.85, 0.92, 0.9]];
  for (const [az, el, r] of fr) lock(m, j, b, { az: az + sweep * 0.5, el, daz: sweep * 0.6 - az * 0.15, del: -(el - (crop ? 0.42 : 0.28)), r, lift: crop ? 0.2 : 0.55 }, mat);
  if (!crop) {
    // sides over the ears, back locks falling to the nape
    for (const s of [1, -1]) {
      lock(m, j, b, { az: s * 1.3, el: 0.7, daz: s * 0.25, del: -0.95, r: 1.05, lift: 0.5 }, mat);
      lock(m, j, b, { az: s * 1.9, el: 0.75, daz: s * 0.3, del: -1.0, r: 1.15, lift: 0.4 }, mat);
    }
    for (const az of [2.6, Math.PI, -2.6]) lock(m, j, b, { az, el: 0.6, daz: 0, del: -0.95, r: 1.25, lift: 0.35 }, mat);
  }
  if (style === "tousled") {
    // a cowlick and two crown tufts break the helmet from above
    lock(m, j, b, { az: 2.4, el: 1.2, daz: 0.6, del: -0.2, r: 0.9, lift: 1.6 }, mat);
    lock(m, j, b, { az: -2.2, el: 1.1, daz: -0.5, del: -0.25, r: 0.85, lift: 1.3 }, mat);
    lock(m, j, b, { az: 0.2, el: 1.4, daz: 0.25, del: -0.35, r: 0.8, lift: 1.4 }, mat);
  }
  if (style === "long") {
    // a curtain down the back to the shoulder blades, and side locks past the jaw
    m.ellipsoid(add(h, [0, -R[1] * 0.75, -R[2] * 0.55]), [R[0] * 0.98, R[1] * 1.0, R[2] * 0.5], { ...o, k: 1.2 });
    for (const s of [1, -1]) {
      lock(m, j, b, { az: s * 1.45, el: 0.4, daz: s * 0.1, del: -1.6, r: 1.25, lift: 0.4, over: 2.5 }, mat);
      lock(m, j, b, { az: s * 2.4, el: 0.2, daz: s * 0.05, del: -1.6, r: 1.4, lift: 0.3, over: 3.2 }, mat);
    }
    lock(m, j, b, { az: Math.PI, el: 0.1, daz: 0, del: -1.5, r: 1.6, lift: 0.3, over: 4 }, mat);
  }
  if (style === "bun") {
    m.sphere(add(h, [0, R[1] * 0.75, -R[2] * 0.85]), R[0] * 0.42, { ...o, k: 0.5 });
    m.torus(add(h, [0, R[1] * 0.62, -R[2] * 0.72]), R[0] * 0.3, 0.32, { mat: M.cloth1, bone: B.head, rot: euler(0, 0.9) });
  }
  if (style === "braid") {
    for (let i = 0; i < 5; i++) {
      const c = add(h, [0, -R[1] * 0.55 - i * 1.7, -R[2] * 0.98 - i * 0.2]);
      m.ellipsoid(c, [1.25 - i * 0.1, 1.05, 1.0 - i * 0.06], { mat, bone: i < 2 ? B.head : B.chest, k: 0.25 });
    }
    m.sphere(add(h, [0, -R[1] * 0.55 - 5 * 1.7 + 0.5, -R[2] * 0.98 - 1.0]), 0.75, { mat: M.cloth1, bone: B.chest, k: 0.2 });
  }
  m.useLayer(0);
}

/** A beard: jaw mass, a moustache and a long chin point. `len` is how far it hangs below the chin (px). */
export function beard(m: Model, b: Build, j: Joints, len: number, mat = M.hair): void {
  const h = j.headC, R = b.head;
  m.beginSolid();
  const o = { mat, bone: B.head };
  // jaw mass from ear to ear, hugging the lower face
  m.ellipsoid(add(h, [0, -R[1] * 0.55, R[2] * 0.42]), [R[0] * 0.98, R[1] * 0.55, R[2] * 0.72], { ...o });
  // keep the mouth and cheeks clear: carve above the moustache line
  m.box(add(h, [0, R[1] * 0.18, R[2] * 0.8]), [R[0] * 1.2, R[1] * 0.42, R[2] * 0.8], 0.8, { ...o, op: Op.Subtract, k: 0.5 });
  // the hanging part: a wedge to a point, split into two forks if long
  const chin = add(h, [0, -R[1] * 0.95, R[2] * 0.72]);
  const end = add(chin, [0, -len, 0.6 + len * 0.15]);
  if (len > 5) {
    for (const s of [1, -1]) m.cone(add(chin, [s * 1.1, 0.4, 0]), add(end, [s * 1.0, 0.6, 0]), R[0] * 0.42, 0.3, { mat, bone: B.chest, k: 0.9, ks: 1.5 });
  } else m.cone(chin, end, R[0] * 0.55, 0.35, { mat, bone: B.head, k: 0.9 });
  // moustache: two swept wedges over the mouth
  for (const s of [1, -1]) {
    const a = add(h, [s * 0.4, -R[1] * 0.38, R[2] * 0.98]);
    m.cone(a, add(a, [s * 2.4, -1.4, -0.6]), 0.95, 0.25, { mat, bone: B.head, k: 0.4 });
  }
  m.useLayer(0);
}

/** A flat ear: a tapered cone pressed thin by a slab, with a painted inside and an optional coloured tip. */
export function flatEar(m: Model, base: V3, tip: V3, r0: number, r1: number, thick: number, bone: number, mat: number, inner: number, tipMat = -1, tipFrac = 0.3, cup = 0.0, faceUp: V3 = [0, 0.35, 1]): void {
  const d = sub(tip, base);
  const rot = alongY(d, faceUp);
  m.group((g) => {
    g.cone(base, tip, r0, r1, { bone, mat });
    // a slab through the ear's plane keeps it flat (local z = the ear's facing)
    const c = lerpV(base, tip, 0.5);
    g.box(c, [r0 * 2.2, Math.hypot(...d), thick], 0, { bone, mat, op: Op.Intersect, k: 0.25, rot });
    if (cup > 0) g.ellipsoid(add(lerpV(base, tip, 0.45), scaleV([rot[6], rot[7], rot[8]], thick * 1.3)), [r0 * 0.6, Math.hypot(...d) * 0.42, thick], { bone, mat, op: Op.Subtract, k: 0.3, rot });
  }, { bone, mat, k: 0.7, ks: 1.2 });
  // inner ear: paint on the front face
  const fwd: V3 = [rot[6], rot[7], rot[8]];
  if (inner >= 0) m.ellipsoid(add(lerpV(base, tip, 0.42), scaleV(fwd, thick * 0.9)), [r0 * 0.55, Math.hypot(...d) * 0.4, thick * 0.9], { bone, mat: inner, op: Op.Paint, k: 0.12, rot });
  if (tipMat >= 0) m.sphere(tip, Math.hypot(...d) * tipFrac + r1, { bone, mat: tipMat, op: Op.Paint, k: 0.1 });
}

/** Places ear joints (base and mid) mirrored, and points their frames along the ear. */
export function placeEars(j: Joints, base: V3, tip: V3, refresh: (j: Joints, dirs: Partial<Record<number, V3>>) => void): void {
  const P = j.pos;
  for (const [e, e2, s] of [[B.earL, B.earL2, 1], [B.earR, B.earR2, -1]] as const) {
    const b0: V3 = [base[0] * s, base[1], base[2]], t0: V3 = [tip[0] * s, tip[1], tip[2]];
    P[e] = b0;
    P[e2] = lerpV(b0, t0, 0.5);
  }
  refresh(j, {
    [B.earL]: sub(tip, base), [B.earL2]: sub(tip, base),
    [B.earR]: sub([-tip[0], tip[1], tip[2]], [-base[0], base[1], base[2]]), [B.earR2]: sub([-tip[0], tip[1], tip[2]], [-base[0], base[1], base[2]]),
  });
}

/** Tail joints along a curve given as points (root first); frames point back toward the root. */
export function placeTail(j: Joints, pts: V3[], refresh: (j: Joints, dirs: Partial<Record<number, V3>>) => void): void {
  const dirs: Record<number, V3> = {};
  for (let i = 0; i < 4; i++) {
    j.pos[B.tail1 + i] = pts[i]!;
    dirs[B.tail1 + i] = sub(pts[i]!, pts[i + 1]!);
  }
  refresh(j, dirs);
}

/** A tail as a chain of blended ellipsoids along the tail joints, radii per segment, plus a tip shape. */
export function tailChain(m: Model, j: Joints, radii: number[], mat: number, tip: V3, k = 1.4): void {
  const T = [0, 1, 2, 3].map((i) => j.pos[B.tail1 + i]!);
  for (let i = 0; i < 4; i++) {
    const a = T[i]!, bb = i < 3 ? T[i + 1]! : tip;
    const r = radii[i]!;
    m.ellipsoid(lerpV(a, bb, 0.55), [r, Math.hypot(...sub(bb, a)) * 0.72 + r * 0.45, r * 1.02], { mat, bone: B.tail1 + i, k, ks: k + 1, rot: alongY(sub(bb, a), [0, 1, 0]) });
  }
}

export { add, lerpV, scaleV, sub };
