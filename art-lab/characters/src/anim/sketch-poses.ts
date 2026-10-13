// Quick poses for the exploration stills (FK only). The real clips live in clips.ts.
import type { Build } from "../body/build";
import { setRot, type Pose } from "../rig/pose";
import { B } from "../rig/skeleton";

/** Relaxed stance: arms down from the A pose, a slight bend everywhere. */
export function stand(p: Pose, b: Build): void {
  const a = b.aPose;
  setRot(p, B.armL, -0.08, 0.1, -a + 0.14);
  setRot(p, B.armR, -0.08, -0.1, a - 0.14);
  setRot(p, B.foreL, -0.3);
  setRot(p, B.foreR, -0.45);
  setRot(p, B.weapon, 0.0);
  setRot(p, B.thighL, -0.04, 0, 0.03);
  setRot(p, B.thighR, -0.04, 0, -0.03);
  setRot(p, B.shinL, 0.08);
  setRot(p, B.shinR, 0.08);
  setRot(p, B.footL, -0.04);
  setRot(p, B.footR, -0.04);
  setRot(p, B.head, 0.05);
  setRot(p, B.tail1, 0.0);
}

/** Mid-stride: right foot forward, arms opposite. */
export function stride(p: Pose, b: Build, s = 1): void {
  stand(p, b);
  const a = b.aPose;
  setRot(p, B.thighR, -0.55 * s, 0, -0.03);
  setRot(p, B.shinR, 0.25);
  setRot(p, B.footR, 0.15);
  setRot(p, B.thighL, 0.4 * s, 0, 0.03);
  setRot(p, B.shinL, 0.55);
  setRot(p, B.footL, -0.2);
  setRot(p, B.armL, -0.55 * s, 0.1, -a + 0.2);
  setRot(p, B.armR, 0.45 * s, -0.1, a - 0.2);
  setRot(p, B.spine, 0.06, 0.12 * s);
  setRot(p, B.chest, 0.04, 0.12 * s);
  setRot(p, B.head, 0.0, -0.2 * s);
  p.off[1] = -0.4;
}

/** The moment after a horizontal slash: arm across, body twisted through, weight forward. */
export function slash(p: Pose, b: Build): void {
  stand(p, b);
  const a = b.aPose;
  setRot(p, B.spine, 0.12, 0.45);
  setRot(p, B.chest, 0.1, 0.45);
  setRot(p, B.head, -0.05, -0.6);
  setRot(p, B.armR, -1.25, 0.9, a - 0.4);
  setRot(p, B.foreR, -0.25);
  setRot(p, B.weapon, 0.2, 0, -0.4);
  setRot(p, B.armL, 0.3, 0, -a + 0.9);
  setRot(p, B.foreL, -0.9);
  setRot(p, B.thighL, -0.65, 0, 0.12);
  setRot(p, B.shinL, 0.5);
  setRot(p, B.thighR, 0.35, 0, -0.1);
  setRot(p, B.shinR, 0.35);
  setRot(p, B.footR, 0.1);
  p.off[1] = -1.4;
  p.off[2] = 1.0;
  p.expr = 5;
}
