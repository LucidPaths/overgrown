/** `?perf`: one DOM line under the debug text, refreshed once per second. Debug only; TEC-015 grows it into the HUD. */
export class PerfReadout {
  private readonly el: HTMLDivElement;
  private periodStart = -1;
  private lastFrame = 0;
  private frames = 0;
  private worstMs = 0;

  /** Creates `<div id="perf">` and appends it to `parent`. */
  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "perf";
    this.el.style.cssText =
      "position: fixed; left: 4px; top: 22px; font: 12px monospace; color: #fff; background: rgba(0, 0, 0, 0.5); padding: 0 2px; pointer-events: none; white-space: pre";
    parent.appendChild(this.el);
  }

  /** Once per animation frame. */
  frame(nowMs: number, facts: { dpr: number; resolution: number; width: number; height: number }): void {
    if (this.periodStart < 0) {
      this.periodStart = nowMs;
      this.lastFrame = nowMs;
      return;
    }
    this.frames += 1;
    this.worstMs = Math.max(this.worstMs, nowMs - this.lastFrame);
    this.lastFrame = nowMs;
    const elapsed = nowMs - this.periodStart;
    if (elapsed < 1000) return;
    const { dpr, resolution, width, height } = facts;
    this.el.textContent = `fps ${Math.round((this.frames * 1000) / elapsed)} · worst ${Math.round(this.worstMs)} ms · dpr ${dpr} → ${trim(resolution)} · ${width}×${height}`;
    this.periodStart = nowMs;
    this.frames = 0;
    this.worstMs = 0;
  }
}

/** At most 4 decimals, no trailing zeros: 1.3125, 1.5, 2. */
function trim(n: number): string {
  return String(Number(n.toFixed(4)));
}
