// The follow camera, in device pixels. Pure: no DOM, no Pixi.
import { TILE_PX } from "@overgrown/sim/constants";

/** OQ-024: the short axis shows at least this many tiles. Tunable. */
export const MIN_VIEW_TILES = 16;

function assertDeviceSize(deviceW: number, deviceH: number): void {
  if (!Number.isInteger(deviceW) || !Number.isInteger(deviceH) || deviceW < 0 || deviceH < 0) {
    throw new RangeError(`camera: device size must be integers >= 0, got ${deviceW}×${deviceH}`);
  }
}

/**
 * Device px per art px: the largest integer keeping ≥ MIN_VIEW_TILES tiles on the short axis; at least 1.
 * RangeError unless both sizes are integers ≥ 0.
 */
export function integerScale(deviceW: number, deviceH: number): number {
  assertDeviceSize(deviceW, deviceH);
  return Math.max(1, Math.floor(Math.min(deviceW, deviceH) / (MIN_VIEW_TILES * TILE_PX)));
}

export interface CameraLayout {
  /** Integer ≥ 1, device px per world px. */
  scale: number;
  /** Device px where the camera target is drawn: Math.floor(deviceW / 2). */
  anchorX: number;
  /** Math.floor(deviceH / 2). */
  anchorY: number;
  /** Device px where world (0,0) is drawn: anchorX - Math.round(targetX) * scale (an integer). */
  originX: number;
  originY: number;
}

/** Follow camera: the target, rounded to whole world px, lands on the anchor device pixel. No smoothing (A-18). */
export function layoutCamera(deviceW: number, deviceH: number, targetX: number, targetY: number): CameraLayout {
  const scale = integerScale(deviceW, deviceH);
  const anchorX = Math.floor(deviceW / 2);
  const anchorY = Math.floor(deviceH / 2);
  return {
    scale,
    anchorX,
    anchorY,
    originX: anchorX - Math.round(targetX) * scale,
    originY: anchorY - Math.round(targetY) * scale,
  };
}

/** World-px offset of a device-px point from the camera target: ((x - anchorX) / scale, (y - anchorY) / scale). */
export function deviceToTargetOffset(layout: CameraLayout, deviceX: number, deviceY: number): { x: number; y: number } {
  return { x: (deviceX - layout.anchorX) / layout.scale, y: (deviceY - layout.anchorY) / layout.scale };
}
