// Desktop input: keyboard (by KeyboardEvent.code, so layout-independent) and mouse/pen on the canvas,
// reported to the HostInput, which makes the InputMessage the sim latches. Touch is touch.ts.
import { deviceToTargetOffset, type CameraLayout } from "../render/camera";
import type { HeldInput, HostInput } from "./host-input";

const UP = ["KeyW", "ArrowUp"];
const LEFT = ["KeyA", "ArrowLeft"];
const DOWN = ["KeyS", "ArrowDown"];
const RIGHT = ["KeyD", "ArrowRight"];
const SPRINT = ["ShiftLeft", "ShiftRight"];
const DODGE = "Space";
const BOUND = new Set([...UP, ...LEFT, ...DOWN, ...RIGHT, ...SPRINT, DODGE]);
/** Codes whose browser default (scrolling, button activation) must not happen. */
const PREVENTED = new Set([DODGE, "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

function isPointerAimDevice(event: PointerEvent): boolean {
  return event.pointerType === "mouse" || event.pointerType === "pen";
}

export class KeyboardMouseInput {
  private readonly held = new Set<string>();
  /** Internal edge-detection state for attack presses; not sent. */
  private lmbHeld = false;
  /** Last pointer position in CSS client px, or null before the first pointer event. */
  private pointer: { x: number; y: number } | null = null;
  private layout: CameraLayout | null = null;
  private aimX = 0;
  private aimY = 0;

  /** Attaches the listeners below. Everything is reported to `input`, which owns the press counters. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: HostInput,
  ) {
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
      canvas.addEventListener(type, (e) => this.onPointer(e));
    }
    canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // RMB is reserved for block/aim
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.releaseAll();
    });
  }

  /** Called every frame with the camera in use; re-derives the aim only if scale or anchor changed. */
  setLayout(layout: CameraLayout): void {
    const old = this.layout;
    if (old !== null && old.scale === layout.scale && old.anchorX === layout.anchorX && old.anchorY === layout.anchorY) {
      return;
    }
    this.layout = layout;
    this.updateAim();
    this.input.report("keyboard-mouse", this.heldInput(), false);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!BOUND.has(e.code)) return;
    if (PREVENTED.has(e.code)) e.preventDefault();
    // Modifier chords are browser shortcuts (and on macOS a Meta-held key never sends keyup, so it would stick).
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    this.held.add(e.code);
    if (e.code === DODGE) this.input.press("keyboard-mouse", "dodge", this.heldInput());
    else this.input.report("keyboard-mouse", this.heldInput(), true);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!BOUND.has(e.code)) return;
    if (PREVENTED.has(e.code)) e.preventDefault();
    this.held.delete(e.code);
    this.input.report("keyboard-mouse", this.heldInput(), true);
  }

  private onPointer(e: PointerEvent): void {
    if (!isPointerAimDevice(e)) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    // `buttons` (not `button`) so LMB is seen in chords, where a second button sends pointermove, not pointerdown.
    const lmb = (e.buttons & 1) !== 0;
    const attackEdge = lmb && !this.lmbHeld;
    this.lmbHeld = lmb;
    if (e.type === "pointerdown" && lmb) this.canvas.setPointerCapture(e.pointerId); // see the release outside the canvas
    this.updateAim();
    if (attackEdge) this.input.press("keyboard-mouse", "attack", this.heldInput());
    else this.input.report("keyboard-mouse", this.heldInput(), true);
  }

  private releaseAll(): void {
    this.held.clear();
    this.lmbHeld = false;
    this.input.report("keyboard-mouse", this.heldInput(), false);
  }

  /** Aim = pointer offset from the camera target in world px; (0, 0) until both a pointer and a layout exist. */
  private updateAim(): void {
    if (this.pointer === null || this.layout === null) return;
    const rect = this.canvas.getBoundingClientRect();
    const deviceX = ((this.pointer.x - rect.left) * this.canvas.width) / rect.width;
    const deviceY = ((this.pointer.y - rect.top) * this.canvas.height) / rect.height;
    const aim = deviceToTargetOffset(this.layout, deviceX, deviceY);
    this.aimX = aim.x;
    this.aimY = aim.y;
  }

  private heldBit(codes: readonly string[]): 0 | 1 {
    return codes.some((code) => this.held.has(code)) ? 1 : 0;
  }

  private heldInput(): HeldInput {
    return {
      moveX: this.heldBit(RIGHT) - this.heldBit(LEFT),
      moveY: this.heldBit(DOWN) - this.heldBit(UP),
      aimX: this.aimX,
      aimY: this.aimY,
      sprint: this.heldBit(SPRINT) === 1,
    };
  }
}
