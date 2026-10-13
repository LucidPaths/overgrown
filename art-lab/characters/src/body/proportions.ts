// Proportion presets for the explorations: the same species pushed toward heroic (about 6 heads) or chibi
// (about 2.3 heads). The species sculpts read everything from the Build, so the heads, ears and clothes follow.
import type { Build } from "./build";

const mul3 = (v: [number, number, number], k: number): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k];

export function heroic(b: Build): Partial<Build> {
  return {
    hip: b.hip * 1.55, torso: b.torso * 1.3, neck: b.neck * 1.4, arm: b.arm * 1.5, fore: b.fore * 1.45, hand: b.hand * 0.95,
    head: mul3(b.head, 0.8), headUp: b.headUp * 0.8, shoulderW: b.shoulderW * 1.12, hipW: b.hipW * 1.0,
    chest: [b.chest[0] * 1.08, b.chest[1] * 1.35, b.chest[2] * 0.95], belly: [b.belly[0] * 0.9, b.belly[1] * 1.25, b.belly[2] * 0.9],
    pelvis: [b.pelvis[0] * 0.95, b.pelvis[1] * 1.2, b.pelvis[2] * 0.95],
    armR: [b.armR[0] * 1.0, b.armR[1] * 0.95, b.armR[2] * 0.9], legR: [b.legR[0] * 1.05, b.legR[1] * 1.0, b.legR[2] * 0.95],
    handR: mul3(b.handR, 0.9), footLen: b.footLen * 1.2,
    tail: b.tail ? { ...b.tail, len: b.tail.len * 1.3 } : null,
  };
}

export function chibi(b: Build): Partial<Build> {
  return {
    hip: b.hip * 0.55, torso: b.torso * 0.66, neck: b.neck * 0.4, arm: b.arm * 0.62, fore: b.fore * 0.6, hand: b.hand * 1.0,
    head: mul3(b.head, 1.3), headUp: b.headUp * 1.3,
    chest: mul3(b.chest, 0.82), belly: mul3(b.belly, 0.85), pelvis: mul3(b.pelvis, 0.85),
    shoulderW: b.shoulderW * 0.8, hipW: b.hipW * 0.9,
    armR: mul3(b.armR, 1.0), legR: mul3(b.legR, 1.0), handR: mul3(b.handR, 1.1), footLen: b.footLen * 0.85,
    tail: b.tail ? { ...b.tail, len: b.tail.len * 0.8 } : null,
  };
}
