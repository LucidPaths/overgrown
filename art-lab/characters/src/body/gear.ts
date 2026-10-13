// Gear and clothing. Cloth is a SHELL: the wearer's own body grown by a thickness, kept inside a mask region.
// It therefore fits every species without being remade, and it bends with the body because it borrows the
// body's skin weights. Rule: an outer layer is thicker than the layer it covers (0.35 trousers < 0.55 tunic <
// 0.8 coat < 1.1 armour), which is all the ordering a paper doll needs. Hard gear (blades, buckles, plates) is
// a solid layer on one bone.
import { Op, alongY, euler, type Model, type V3 } from "../sdf/model";
import { B } from "../rig/skeleton";
import { add, lerpV, scaleV, sub, type Build, type Joints } from "./build";
import { M } from "./mats";

export type GearId = "tunic" | "shirt" | "trousers" | "shorts" | "boots" | "belt" | "cloak" | "hood" | "pauldron" | "breastplate" | "helmet" | "bracers" | "kilt" | "scarf" | "eyepatch";
export type WeaponId = "none" | "sword" | "axe" | "spear" | "dagger" | "hammer" | "staff";

const BIG = 40;

/** A mask slab between two heights (in rest space), wide enough for any body. */
function slab(m: Model, y0: number, y1: number, halfW = BIG, z0 = -BIG, z1 = BIG): void {
  m.box([0, (y0 + y1) / 2, (z0 + z1) / 2], [halfW, (y1 - y0) / 2, (z1 - z0) / 2], 0, { mat: 0, bone: 0 });
}

/** A mask capsule along a limb from `a` toward `b`, stopping at fraction t of the way. */
function limbMask(m: Model, a: V3, b: V3, t: number, r: number, back = 0): void {
  const d = sub(b, a);
  const s = add(a, scaleV(d, -back));
  m.cone(s, add(a, scaleV(d, t)), r, r, { mat: 0, bone: 0 });
}

/** Carves the head (and a collar gap) out of a shell's mask: clothes stop at the neck on every species. */
function notHead(m: Model, b: Build, j: Joints): void {
  const R = b.head;
  m.ellipsoid(j.headC, [R[0] * 1.3, R[1] * 1.2, R[2] * 1.3], { mat: 0, bone: 0, op: Op.Subtract });
  m.cone(j.pos[B.head]!, j.headC, R[0] * 0.42, R[0] * 0.5, { mat: 0, bone: 0, op: Op.Subtract });
}

/** Half width of a mask that holds both legs and never the hands. */
function legsHalfW(b: Build): number {
  return Math.max(b.hipW + b.legR[0] + 1.6, b.pelvis[0] + 1.2);
}

/** Carves the tail out of a shell's mask (a capsule along the tail bones, plus its root). */
function notTail(m: Model, b: Build, j: Joints): void {
  if (!b.tail) return;
  for (let i = 0; i < 3; i++) m.cone(j.pos[B.tail1 + i]!, j.pos[B.tail1 + i + 1]!, b.tail.r1 * 1.5 + 1, b.tail.r1 * 1.5 + 1, { mat: 0, bone: 0, op: Op.Subtract });
}

export function applyGear(m: Model, b: Build, j: Joints, gear: GearId[]): void {
  const P = j.pos;
  const pelvisY = P[B.pelvis]![1];
  const shoulderY = j.shoulderY;
  const kneeY = (P[B.shinL]![1]);
  for (const g of gear) {
    switch (g) {
      case "trousers":
      case "shorts": {
        m.beginShell({ thickness: 0.35, mat: M.cloth2, fold: 0.12, folds: 7, foldY: 1e9 });
        const bottom = g === "trousers" ? (b.digi ? P[B.footL]![1] + 0.6 : P[B.footL]![1] + 1.4) : kneeY + 1.6;
        slab(m, bottom, pelvisY + b.pelvis[1] * 0.75, legsHalfW(b));
        notTail(m, b, j);
        break;
      }
      case "tunic":
      case "shirt": {
        m.beginShell({ thickness: 0.55, mat: M.cloth1, flare: g === "tunic" ? 0.2 : 0, flareY: pelvisY + 1.2, hem: 0.4, hemW: 0.8, hemMat: M.cloth2, hemPrims: 3, fold: g === "tunic" ? 0.18 : 0, folds: 11, foldY: pelvisY + 0.8 });
        // torso down to the upper thigh (the hem), sleeves to the elbow (cuffs); the neckline and tail are carved
        const hem = g === "tunic" ? pelvisY - b.hip * 0.32 : pelvisY - 0.6;
        const top = shoulderY + 1.5;
        m.box([0, (hem + top) / 2, 0], [b.shoulderW + 1.2, (top - hem) / 2, BIG], 0, { mat: 0, bone: 0 });
        for (const [arm, fore] of [[B.armL, B.foreL], [B.armR, B.foreR]] as const) limbMask(m, P[arm]!, P[fore]!, g === "tunic" ? 1.12 : 0.6, b.armR[0] * 2.4, 0.3);
        notHead(m, b, j);
        notTail(m, b, j);
        // the collar band
        m.useLayer(0);
        const ly = m.beginSolid();
        void ly;
        m.torus(add(P[B.head]!, [0, -0.9, 0.1]), b.head[0] * 0.38, 0.45, { mat: M.cloth1, bone: B.chest, rot: euler(0, 0.12) });
        break;
      }
      case "kilt": {
        m.beginShell({ thickness: 0.7, mat: M.cloth2, flare: 0.22, flareY: pelvisY });
        slab(m, kneeY + 1.2, pelvisY + 1.5, legsHalfW(b) + 1);
        break;
      }
      case "boots": {
        m.beginShell({ thickness: 0.55, mat: M.boot, hem: 0.35, hemW: 0.6 });
        const top = b.digi ? P[B.footL]![1] + 1.6 : kneeY - 1.0;
        slab(m, -1, top, legsHalfW(b));
        // a turned-down cuff
        m.useLayer(0);
        m.beginSolid();
        for (const shin of [B.shinL, B.shinR]) {
          const s = P[shin]!, a = P[shin + 1]!;
          const t = (top - a[1]) / (s[1] - a[1]);
          const c = lerpV(a, s, t);
          m.torus(c, b.legR[1] * 1.05 + 0.25, 0.42, { mat: M.leather, bone: shin, rot: alongY(sub(s, a)) });
        }
        break;
      }
      case "belt": {
        m.beginSolid();
        const c: V3 = [0, pelvisY + 1.6, 0.2];
        m.torus(c, 1, 0.5, { mat: M.leather, bone: B.spine, rot: euler(0, 0) });
        const last = m.prims[m.prims.length - 1]!;
        // stretch the torus to the waist ellipse: rebuild as an elliptic ring of small spheres instead
        m.prims.pop();
        const rx = b.belly[0] + 0.95, rz = b.belly[2] + 0.95;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          m.sphere([Math.sin(a) * rx, c[1], Math.cos(a) * rz], 0.62, { mat: M.leather, bone: B.spine, k: 0.5 });
        }
        m.box([0, c[1], rz + 0.35], [0.9, 0.75, 0.35], 0.25, { mat: M.gold, bone: B.spine });
        void last;
        break;
      }
      case "cloak": {
        // a cape: a curved slab hanging from the shoulders down the back
        m.beginSolid();
        const top = shoulderY + 0.4;
        for (let i = 0; i < 5; i++) {
          const y = top - i * (b.torso * 0.42);
          const w = b.shoulderW + 0.8 + i * 0.5;
          const z = -b.chest[2] - 0.6 - i * 0.35;
          m.ellipsoid([0, y, z], [w, b.torso * 0.32, 0.55], { mat: M.cloth2, bone: i < 2 ? B.chest : B.spine, k: 1.4 });
        }
        // clasp
        for (const s of [1, -1]) m.sphere([s * b.chest[0] * 0.55, shoulderY + 0.2, b.chest[2] * 0.75], 0.6, { mat: M.gold, bone: B.chest });
        break;
      }
      case "hood": {
        m.beginShell({ thickness: 1.0, mat: M.cloth2, base: 0 });
        // around the back and top of the head, open at the face
        m.ellipsoid(add(j.headC, [0, 0.4, -1.0]), [b.head[0] * 1.5, b.head[1] * 1.45, b.head[2] * 1.2], { mat: 0, bone: 0 });
        m.box(add(j.headC, [0, -b.head[1] * 0.2, b.head[2] * 1.0]), [b.head[0] * 0.9, b.head[1] * 0.85, b.head[2] * 0.8], 0.8, { mat: 0, bone: 0, op: Op.Subtract });
        break;
      }
      case "pauldron": {
        m.beginSolid();
        for (const [arm, s] of [[B.armL, 1], [B.armR, -1]] as const) {
          const sh = P[arm]!;
          m.dome(add(sh, [s * 0.5, 0.8, 0]), [b.armR[0] * 2.1, b.armR[0] * 1.6, b.armR[0] * 2.0], b.armR[0] * 0.2, { mat: M.metal, bone: arm, rot: euler(0, 0, -s * 0.45) });
          m.dome(add(sh, [s * 0.9, -0.4, 0]), [b.armR[0] * 1.9, b.armR[0] * 1.2, b.armR[0] * 1.8], b.armR[0] * 0.15, { mat: M.metal, bone: arm, k: 0.2, rot: euler(0, 0, -s * 0.55) });
        }
        break;
      }
      case "breastplate": {
        m.beginShell({ thickness: 1.0, mat: M.metal });
        m.box([0, (pelvisY + 1 + shoulderY + 0.6) / 2, 0], [b.shoulderW + 0.4, (shoulderY - pelvisY) / 2, BIG], 0, { mat: 0, bone: 0 });
        notHead(m, b, j);
        break;
      }
      case "helmet": {
        m.beginSolid();
        const h = j.headC, R = b.head;
        m.dome(add(h, [0, R[1] * 0.18, -0.2]), [R[0] * 1.14, R[1] * 0.95, R[2] * 1.12], R[1] * 0.05, { mat: M.metal, bone: B.head });
        // brim and a nose guard
        m.torus(add(h, [0, R[1] * 0.12, -0.2]), R[0] * 1.08, 0.5, { mat: M.metal, bone: B.head });
        m.box(add(h, [0, -R[1] * 0.1, R[2] * 1.1]), [0.35, R[1] * 0.38, 0.35], 0.3, { mat: M.metal, bone: B.head });
        m.cone(add(h, [0, R[1] * 1.0, -0.2]), add(h, [0, R[1] * 1.35, -0.8]), 0.7, 0.2, { mat: M.gold, bone: B.head, k: 0.3 });
        break;
      }
      case "bracers": {
        m.beginShell({ thickness: 0.6, mat: M.leather });
        for (const [fore, hand] of [[B.foreL, B.handL], [B.foreR, B.handR]] as const) limbMask(m, lerpV(P[fore]!, P[hand]!, 0.3), P[hand]!, 1.0, b.armR[1] * 2.2);
        break;
      }
      case "scarf": {
        m.beginSolid();
        m.torus(add(P[B.head]!, [0, -0.6, 0.0]), b.head[0] * 0.5, 0.95, { mat: M.cloth2, bone: B.chest, rot: euler(0, 0.1) });
        m.ellipsoid(add(P[B.head]!, [b.head[0] * 0.3, -3, b.chest[2] * 0.9]), [0.9, 2.2, 0.5], { mat: M.cloth2, bone: B.chest, k: 0.6, rot: euler(0, 0.15, 0.2) });
        break;
      }
      case "eyepatch": {
        m.beginSolid();
        const h = j.headC;
        m.ellipsoid(add(h, [1.75, 0.15, b.head[2] * 0.9]), [1.05, 1.0, 0.45], { mat: M.dark, bone: B.head, rot: euler(0.35) });
        m.torus(add(h, [0, 0.6, 0]), b.head[0] * 1.02, 0.18, { mat: M.dark, bone: B.head, rot: euler(0, 0, 0.3) });
        break;
      }
    }
    m.useLayer(0);
  }
}

/** Weapons: built along the weapon bone's local +z (out of the fist) and transformed into rest space. */
export function applyWeapon(m: Model, j: Joints, w: WeaponId): { len: number } {
  if (w === "none") return { len: 0 };
  const g = j.pos[B.weapon]!;
  const r = j.sk.rot[B.weapon]!; // rows: local axes in object space
  const X: V3 = [r[0], r[1], r[2]], Y: V3 = [r[3], r[4], r[5]], Z: V3 = [r[6], r[7], r[8]];
  const at = (x: number, y: number, z: number): V3 => add(g, add(add(scaleV(X, x), scaleV(Y, y)), scaleV(Z, z)));
  m.beginSolid();
  const o = { bone: B.weapon };
  let len = 0;
  switch (w) {
    case "sword": {
      m.cone(at(0, 0, -2.4), at(0, 0, 1.6), 0.5, 0.5, { ...o, mat: M.leather });
      m.sphere(at(0, 0, -2.6), 0.75, { ...o, mat: M.gold });
      m.box(at(0, 0, 1.9), [2.0, 0.45, 0.45], 0.3, { ...o, mat: M.gold, rot: rowsOf(X, Y, Z) });
      // blade: flat, tapering to a point
      m.box(at(0, 0, 7.6), [0.85, 0.22, 5.4], 0.18, { ...o, mat: M.metal, rot: rowsOf(X, Y, Z) });
      m.cone(at(0, 0, 12.6), at(0, 0, 14.4), 0.62, 0.1, { ...o, mat: M.metal, k: 0.2 });
      len = 14.4;
      break;
    }
    case "dagger": {
      m.cone(at(0, 0, -1.6), at(0, 0, 1.0), 0.45, 0.45, { ...o, mat: M.leather });
      m.box(at(0, 0, 1.2), [1.2, 0.35, 0.3], 0.2, { ...o, mat: M.gold, rot: rowsOf(X, Y, Z) });
      m.box(at(0, 0, 3.8), [0.7, 0.2, 2.4], 0.15, { ...o, mat: M.metal, rot: rowsOf(X, Y, Z) });
      m.cone(at(0, 0, 6.0), at(0, 0, 7.0), 0.5, 0.08, { ...o, mat: M.metal, k: 0.15 });
      len = 7;
      break;
    }
    case "axe": {
      m.cone(at(0, 0, -3), at(0, 0, 10.5), 0.55, 0.5, { ...o, mat: M.wood });
      // the head: a curved bit on the outer side
      m.box(at(0, -2.0, 9.0), [0.35, 2.4, 1.5], 0.3, { ...o, mat: M.metal, rot: rowsOf(X, Y, Z) });
      m.ellipsoid(at(0, -3.9, 9.0), [0.4, 1.2, 2.6], { ...o, mat: M.metal, k: 0.6, rot: rowsOf(X, Y, Z) });
      len = 11;
      break;
    }
    case "spear": {
      m.cone(at(0, 0, -8), at(0, 0, 14), 0.5, 0.45, { ...o, mat: M.wood });
      m.cone(at(0, 0, 14), at(0, 0, 18.5), 0.95, 0.08, { ...o, mat: M.metal, k: 0.3 });
      m.torus(at(0, 0, 13.8), 0.55, 0.28, { ...o, mat: M.cloth1, rot: alongY(Z) });
      len = 18.5;
      break;
    }
    case "hammer": {
      m.cone(at(0, 0, -3), at(0, 0, 10), 0.55, 0.55, { ...o, mat: M.wood });
      m.box(at(0, 0, 10.4), [1.4, 2.6, 1.5], 0.45, { ...o, mat: M.metal, rot: rowsOf(X, Y, Z) });
      len = 11.5;
      break;
    }
    case "staff": {
      m.cone(at(0, 0, -10), at(0, 0, 13), 0.55, 0.5, { ...o, mat: M.wood });
      m.sphere(at(0, 0, 14.2), 1.3, { ...o, mat: M.glow });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        m.cone(at(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 12.6), at(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 15.2), 0.35, 0.18, { ...o, mat: M.wood, k: 0.3 });
      }
      len = 15;
      break;
    }
  }
  m.useLayer(0);
  return { len };
}

function rowsOf(x: V3, y: V3, z: V3): [number, number, number, number, number, number, number, number, number] {
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}
