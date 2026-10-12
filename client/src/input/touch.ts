// Touch input: a floating stick anywhere in the left half, an attack button with soft auto-aim, a dodge button.
// Reports to the HostInput like every adapter. Draws nothing (UIX-002 reads `stick` and `buttonsDown`).
import { FACING_UNIT } from "@overgrown/sim/actions";
import type { FacingValue } from "@overgrown/sim/protocol";
import type { Frame } from "../render/interpolate";
import { AUTO_AIM_RANGE_PX, pickAutoAim } from "./auto-aim";
import type { HeldInput, HostInput } from "./host-input";
import {
  hitTest,
  layoutTouchControls,
  STICK_RADIUS_PX,
  stickToMove,
  type Insets,
  type TouchLayout,
} from "./touch-controls";

/** The active stick in CSS client px. */
export interface StickView {
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

export interface ButtonsDown {
  attack: boolean;
  dodge: boolean;
}

let insetProbe: HTMLElement | null = null;

/** The four safe-area insets in CSS px, read through a hidden element whose padding is the `env()` values. */
function readInsets(): Insets {
  if (insetProbe === null) {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) " +
      "env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)";
    document.body.appendChild(probe);
    insetProbe = probe;
  }
  const style = getComputedStyle(insetProbe);
  return {
    top: parseFloat(style.paddingTop),
    right: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    left: parseFloat(style.paddingLeft),
  };
}

/** Layout for the current viewport: window.innerWidth/innerHeight and the env(safe-area-inset-*) values. */
export function currentTouchLayout(): TouchLayout {
  return layoutTouchControls(window.innerWidth, window.innerHeight, readInsets());
}

interface Point {
  x: number;
  y: number;
}

export class TouchInput {
  private stickId: number | null = null;
  private origin: Point = { x: 0, y: 0 };
  private current: Point = { x: 0, y: 0 };
  private readonly downOn = new Map<number, "attack" | "dodge">();
  /** The aim this source carries: set by an attack press, zeroed by a dodge press, otherwise kept. */
  private aimX = 0;
  private aimY = 0;

  /** `frame` is main's reused Frame (updated in place every render frame); read only at press time. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: HostInput,
    private readonly frame: Frame,
  ) {
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerup", (e) => this.onUp(e));
    canvas.addEventListener("pointercancel", (e) => this.onUp(e));
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.releaseAll();
    });
  }

  /** The active stick, knob clamped to STICK_RADIUS_PX from the origin; null when no stick is held. For UIX-002. */
  get stick(): StickView | null {
    if (this.stickId === null) return null;
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const k = d > STICK_RADIUS_PX ? STICK_RADIUS_PX / d : 1;
    return { originX: this.origin.x, originY: this.origin.y, knobX: this.origin.x + dx * k, knobY: this.origin.y + dy * k };
  }

  /** True while at least one touch that went down on that button is still down. For UIX-002 (and CMB-013 later). */
  get buttonsDown(): ButtonsDown {
    const kinds = new Set(this.downOn.values());
    return { attack: kinds.has("attack"), dodge: kinds.has("dodge") };
  }

  private stickMove(): { moveX: number; moveY: number; sprint: boolean } {
    if (this.stickId === null) return { moveX: 0, moveY: 0, sprint: false };
    return stickToMove(this.current.x - this.origin.x, this.current.y - this.origin.y);
  }

  private held(): HeldInput {
    return { ...this.stickMove(), aimX: this.aimX, aimY: this.aimY };
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    const target = hitTest(currentTouchLayout(), e.clientX, e.clientY);
    if (target === "attack") {
      this.downOn.set(e.pointerId, "attack");
      this.aimForAttack();
      this.input.press("touch", "attack", this.held());
    } else if (target === "dodge") {
      // Aim (0, 0): the roll follows the stick if any, else the facing, and the facing is kept.
      this.downOn.set(e.pointerId, "dodge");
      this.aimX = 0;
      this.aimY = 0;
      this.input.press("touch", "dodge", this.held());
    } else {
      if (target === "stick" && this.stickId === null) {
        this.stickId = e.pointerId;
        this.origin = { x: e.clientX, y: e.clientY };
        this.current = this.origin;
        this.canvas.setPointerCapture(e.pointerId);
      }
      // Ring slots do nothing until CMB-003; an empty right half is reserved for tap-to-target.
      this.input.report("touch", this.held(), true);
    }
  }

  /** Attack aim: the auto-aim target, else the stick direction at full reach, else (0, 0), which keeps the facing. */
  private aimForAttack(): void {
    const { moveX, moveY } = this.stickMove();
    const stickActive = moveX !== 0 || moveY !== 0;
    let dir: Point | null = null;
    if (stickActive) {
      dir = { x: moveX, y: moveY };
    } else {
      const me = this.frame.ids.subarray(0, this.frame.count).indexOf(this.frame.you);
      if (me >= 0) {
        const [fx, fy] = FACING_UNIT[this.frame.facing[me]! as FacingValue];
        dir = { x: fx, y: fy };
      }
    }
    const target = dir === null ? null : pickAutoAim(this.frame, dir.x, dir.y);
    if (target !== null) {
      this.aimX = target.x;
      this.aimY = target.y;
    } else if (stickActive) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      this.aimX = (moveX / len) * AUTO_AIM_RANGE_PX;
      this.aimY = (moveY / len) * AUTO_AIM_RANGE_PX;
    } else {
      this.aimX = 0;
      this.aimY = 0;
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType !== "touch" || e.pointerId !== this.stickId) return;
    this.current = { x: e.clientX, y: e.clientY };
    this.input.report("touch", this.held(), true);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    this.downOn.delete(e.pointerId);
    if (e.pointerId === this.stickId) this.stickId = null;
    this.input.report("touch", this.held(), true);
  }

  private releaseAll(): void {
    this.stickId = null;
    this.downOn.clear();
    this.input.report("touch", this.held(), false);
  }
}
