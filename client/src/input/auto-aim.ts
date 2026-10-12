// Soft auto-aim for the touch attack (OQ-026): pick the nearest other character in front of the player.
// Pure (no DOM). Reads a render Frame; never mutates it.
import { TILE_PX } from "@overgrown/sim/constants";
import { Action, Kind } from "@overgrown/sim/protocol";
import type { Frame } from "../render/interpolate";

export const AUTO_AIM_RANGE_PX = 4 * TILE_PX; // 64 world px, OQ-026, tunable
export const AUTO_AIM_HALF_ANGLE_DEG = 30; // OQ-026, tunable

const COS_HALF_ANGLE = Math.cos((AUTO_AIM_HALF_ANGLE_DEG * Math.PI) / 180);

/**
 * World-px offset from `frame.you`'s feet to the nearest other living Character within AUTO_AIM_RANGE_PX whose
 * bearing is within ±AUTO_AIM_HALF_ANGLE_DEG of (dirX, dirY); null if there is none, if the direction is (0, 0),
 * or if `you` is not in the frame. Not filtered by hostility. An exact distance tie goes to the smaller EntityId.
 */
export function pickAutoAim(frame: Frame, dirX: number, dirY: number): { x: number; y: number } | null {
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
  if (dirLen === 0) return null;
  const me = frame.ids.subarray(0, frame.count).indexOf(frame.you);
  if (me < 0) return null;
  const youX = frame.x[me]!;
  const youY = frame.y[me]!;

  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  let bestId = Infinity;
  for (let i = 0; i < frame.count; i++) {
    const id = frame.ids[i]!;
    if (frame.kind[i] !== Kind.Character || id === frame.you || frame.action[i] === Action.Death) continue;
    const ox = frame.x[i]! - youX;
    const oy = frame.y[i]! - youY;
    const dist = Math.sqrt(ox * ox + oy * oy);
    if (dist === 0 || dist > AUTO_AIM_RANGE_PX) continue;
    if ((ox * dirX + oy * dirY) / dirLen < COS_HALF_ANGLE * dist) continue;
    if (dist < bestDist || (dist === bestDist && id < bestId)) {
      best = { x: ox, y: oy };
      bestDist = dist;
      bestId = id;
    }
  }
  return best;
}
