import { describe, expect, it } from "vitest";
import { deviceToTargetOffset, integerScale, layoutCamera } from "./camera";

const CSS_VIEWPORTS: [number, number][] = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [393, 873],
  [412, 915],
  [768, 1024],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];
const DPRS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.625, 3, 3.5, 4];

describe("camera", () => {
  it("integerScale: largest integer device-px scale that keeps ≥ 16 tiles on the short axis, at least 1", () => {
    for (const [w, h] of CSS_VIEWPORTS) {
      for (const [cssW, cssH] of [
        [w, h],
        [h, w],
      ] as const) {
        for (const dpr of DPRS) {
          const dw = Math.round(cssW * dpr);
          const dh = Math.round(cssH * dpr);
          const s = integerScale(dw, dh);
          const where = `${cssW}×${cssH} @${dpr} → ${dw}×${dh}: scale ${s}`;
          expect(Number.isInteger(s) && s >= 1, where).toBe(true);
          const short = Math.min(dw, dh);
          if (short >= 256) {
            expect(short >= 256 * s && short < 256 * (s + 1), where).toBe(true);
          } else {
            expect(s, where).toBe(1);
          }
        }
      }
    }

    const pinned: [number, number, number][] = [
      [1280, 720, 2],
      [1920, 1080, 4],
      [1082, 2402, 4],
      [1170, 2532, 4],
      [750, 1334, 2],
      [3840, 2160, 8],
      [200, 100, 1],
    ];
    for (const [w, h, s] of pinned) expect(integerScale(w, h), `${w}×${h}`).toBe(s);

    expect(() => integerScale(NaN, 720)).toThrow(RangeError);
    expect(() => integerScale(-1, 720)).toThrow(RangeError);
  });

  it("layoutCamera: the rounded target lands on the floored centre with integer device origins", () => {
    const canvases: [number, number][] = [
      [1081, 2401],
      [1280, 720],
    ];
    const targets: [number, number][] = [
      [10.4, -3.5],
      [-0.5, 0.5],
      [1048576.49, -7.51],
    ];
    for (const [w, h] of canvases) {
      for (const [tx, ty] of targets) {
        const where = `canvas ${w}×${h}, target (${tx}, ${ty})`;
        const l = layoutCamera(w, h, tx, ty);
        expect(Number.isInteger(l.originX) && Number.isInteger(l.originY), where).toBe(true);
        expect(l.anchorX, where).toBe(Math.floor(w / 2));
        expect(l.anchorY, where).toBe(Math.floor(h / 2));
        expect(l.originX + Math.round(tx) * l.scale, where).toBe(l.anchorX);
        expect(l.originY + Math.round(ty) * l.scale, where).toBe(l.anchorY);
        expect(deviceToTargetOffset(l, l.anchorX + 3 * l.scale, l.anchorY - 2 * l.scale), where).toEqual({ x: 3, y: -2 });
      }
    }
  });
});
