/** Starting cap for the render resolution (01-tech, OQ-023). Tunable; `?maxdpr=1..4` overrides it for measuring. */
export const MAX_RENDER_DPR = 2;

/**
 * The render resolution for a devicePixelRatio: dpr / k with k = Math.ceil(dpr / maxDpr), the smallest integer
 * that brings it to ≤ maxDpr. So the browser upscales the backing store by exactly k and every art pixel stays a
 * whole number of device pixels. dpr ≤ maxDpr → dpr unchanged.
 * RangeError unless dpr is finite and > 0 and maxDpr is an integer ≥ 1.
 */
export function renderResolution(dpr: number, maxDpr: number = MAX_RENDER_DPR): number {
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError(`renderResolution: dpr must be finite and > 0, got ${dpr}`);
  }
  if (!Number.isInteger(maxDpr) || maxDpr < 1) {
    throw new RangeError(`renderResolution: maxDpr must be an integer >= 1, got ${maxDpr}`);
  }
  return dpr / Math.ceil(dpr / maxDpr);
}
