import { describe, expect, it } from "vitest";
import {
  hitTest,
  layoutTouchControls,
  STICK_RADIUS_PX,
  stickToMove,
  type Circle,
  type Insets,
  type TouchLayout,
} from "./touch-controls";

const R = STICK_RADIUS_PX;
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

describe("stickToMove", () => {
  it("stickToMove: dead zone, rescale, sprint at full deflection, beyond the radius", () => {
    expect(stickToMove(0.14 * R, 0)).toEqual({ moveX: 0, moveY: 0, sprint: false });

    const half = stickToMove(0.5 * R, 0);
    expect(half.moveX).toBeCloseTo(0.35 / 0.85, 9);
    expect(half.sprint).toBe(false);

    const up = stickToMove(0, -0.89 * R);
    expect(up.moveY).toBeCloseTo(-0.74 / 0.85, 9);
    expect(up.sprint).toBe(false);

    expect(stickToMove(0.91 * R, 0)).toEqual({ moveX: 1, moveY: 0, sprint: true });

    const far = stickToMove(10 * R, 10 * R);
    expect(Math.abs(far.moveX - Math.SQRT1_2)).toBeLessThan(1e-12);
    expect(Math.abs(far.moveY - Math.SQRT1_2)).toBeLessThan(1e-12);
    expect(far.sprint).toBe(true);

    for (const m of [0.95, 3]) {
      for (let deg = 0; deg < 360; deg++) {
        const rad = (deg * Math.PI) / 180;
        const v = stickToMove(Math.cos(rad) * m * R, Math.sin(rad) * m * R);
        expect(v.sprint).toBe(true);
        expect(Math.abs(v.moveX)).toBeLessThanOrEqual(1);
        expect(Math.abs(v.moveY)).toBeLessThanOrEqual(1);
        expect(Math.abs(Math.hypot(v.moveX, v.moveY) - 1)).toBeLessThan(1e-12);
      }
    }

    expect(() => stickToMove(NaN, 0)).toThrow(RangeError);
  });
});

function circles(l: TouchLayout): [string, Circle][] {
  return [
    ["attack", l.attack],
    ["dodge", l.dodge],
    ...l.ring.map((c, k): [string, Circle] => [`ring${k}`, c]),
    ["stickRest", l.stickRest],
  ];
}

describe("layoutTouchControls", () => {
  it("layoutTouchControls: inside the safe area, no overlaps, hitTest finds each control", () => {
    const viewports: [number, number, Insets][] = [];
    for (const [w, h] of [[360, 640], [412, 915]] as const) {
      viewports.push([w, h, ZERO], [w, h, { top: 47, right: 0, bottom: 34, left: 0 }]);
    }
    for (const [w, h] of [[640, 360], [915, 412]] as const) {
      viewports.push([w, h, ZERO], [w, h, { top: 0, right: 47, bottom: 21, left: 47 }]);
    }
    viewports.push([1280, 720, ZERO]);

    for (const [w, h, ins] of viewports) {
      const label = `${w}x${h} ${JSON.stringify(ins)}`;
      const l = layoutTouchControls(w, h, ins);
      const all = circles(l);
      for (const [name, c] of all) {
        expect(c.x - c.r, `${label} ${name} left`).toBeGreaterThanOrEqual(ins.left);
        expect(c.x + c.r, `${label} ${name} right`).toBeLessThanOrEqual(w - ins.right);
        expect(c.y - c.r, `${label} ${name} top`).toBeGreaterThanOrEqual(ins.top);
        expect(c.y + c.r, `${label} ${name} bottom`).toBeLessThanOrEqual(h - ins.bottom);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const [na, a] = all[i]!;
          const [nb, b] = all[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${label} ${na} vs ${nb}`).toBeGreaterThanOrEqual(a.r + b.r);
        }
      }
      expect(hitTest(l, l.attack.x, l.attack.y), label).toBe("attack");
      expect(hitTest(l, l.dodge.x, l.dodge.y), label).toBe("dodge");
      for (const c of l.ring) expect(hitTest(l, c.x, c.y), label).toBe("ring");
      expect(hitTest(l, l.stickRest.x, l.stickRest.y), label).toBe("stick");
      expect(hitTest(l, w / 2 - 1, ins.top + 1), label).toBe("stick");
      expect(hitTest(l, w / 2 + 1, ins.top + 1), label).toBeNull();
    }

    const l = layoutTouchControls(412, 915, ZERO);
    const want: [Circle, number, number][] = [
      [l.attack, 352, 855],
      [l.dodge, 268, 871],
      [l.ring[0], 385.13, 731.36],
      [l.ring[1], 318.87, 731.36],
      [l.ring[2], 261.49, 764.49],
      [l.ring[3], 228.36, 821.87],
      [l.stickRest, 72, 843],
    ];
    for (const [c, x, y] of want) {
      expect(Math.abs(c.x - x)).toBeLessThan(0.01);
      expect(Math.abs(c.y - y)).toBeLessThan(0.01);
    }
  });
});
