import { Action, Kind } from "@overgrown/sim/protocol";
import { describe, expect, it } from "vitest";
import { createFrame, type Frame } from "../render/interpolate";
import { pickAutoAim } from "./auto-aim";

const YOU = 7;
const YX = 100;
const YY = 100;

interface Other {
  id: number;
  dx: number;
  dy: number;
  kind?: number;
  action?: number;
}
const polar = (r: number, deg: number): { dx: number; dy: number } => ({
  dx: r * Math.cos((deg * Math.PI) / 180),
  dy: r * Math.sin((deg * Math.PI) / 180),
});

function frameOf(others: Other[], you = YOU): Frame {
  const f = createFrame();
  const n = others.length + 1;
  f.count = n;
  f.ids = new Uint32Array(n);
  f.x = new Float32Array(n);
  f.y = new Float32Array(n);
  f.kind = new Uint16Array(n);
  f.facing = new Uint8Array(n);
  f.action = new Uint8Array(n);
  f.ids[0] = YOU;
  f.x[0] = YX;
  f.y[0] = YY;
  f.kind[0] = Kind.Character;
  others.forEach((o, k) => {
    f.ids[k + 1] = o.id;
    f.x[k + 1] = YX + o.dx;
    f.y[k + 1] = YY + o.dy;
    f.kind[k + 1] = o.kind ?? Kind.Character;
    f.action[k + 1] = o.action ?? Action.Idle;
  });
  f.you = you;
  return f;
}
const pick = (others: Other[], dirX = 1, dirY = 0) => pickAutoAim(frameOf(others), dirX, dirY);

describe("pickAutoAim", () => {
  it("nearest living other Character within 4 tiles and ±30°", () => {
    expect(pick([{ id: 1, dx: 60, dy: 0 }])).toEqual({ x: 60, y: 0 });
    expect(pick([{ id: 1, dx: 64, dy: 0 }])).toEqual({ x: 64, y: 0 });
    expect(pick([{ id: 1, dx: 64.5, dy: 0 }])).toBeNull();
    expect(pick([{ id: 1, ...polar(50, 29) }])).not.toBeNull();
    expect(pick([{ id: 1, ...polar(50, 31) }])).toBeNull();
    // dir is not assumed unit: (0, -5) points up; -90 + 31 degrees is 31 degrees off it.
    expect(pick([{ id: 1, ...polar(50, -90 + 31) }], 0, -5)).toBeNull();
    expect(
      pick([
        { id: 1, dx: 40, dy: 5 },
        { id: 2, dx: 30, dy: -10 },
      ]),
    ).toEqual({ x: 30, y: -10 });
    expect(
      pick([
        { id: 1, dx: 20, dy: 0, action: Action.Death },
        { id: 2, dx: 50, dy: 0 },
      ]),
    ).toEqual({ x: 50, y: 0 });
    expect(
      pick([
        { id: 1, dx: 20, dy: 0, kind: 0 },
        { id: 2, dx: 50, dy: 0 },
      ]),
    ).toEqual({ x: 50, y: 0 });
    // Exact distance tie: the smaller EntityId wins, whatever the snapshot order.
    expect(
      pick([
        { id: 9, dx: 50, dy: 0 },
        { id: 3, dx: 48, dy: 14 },
      ]),
    ).toEqual({ x: 48, y: 14 });
  });

  it("null without a direction, without `you`, or with nothing in the cone", () => {
    const others = [{ id: 1, dx: 30, dy: 0 }];
    expect(pickAutoAim(frameOf(others), 0, 0)).toBeNull();
    expect(pickAutoAim(frameOf(others, -1), 1, 0)).toBeNull();
    expect(pick([{ id: 1, dx: -30, dy: 0 }])).toBeNull();
  });
});
