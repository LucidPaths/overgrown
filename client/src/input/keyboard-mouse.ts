// Desktop input: keyboard (by KeyboardEvent.code, so layout-independent) and mouse/pen on the canvas,
// turned into the InputMessage the sim latches. Touch is CMB-002's.
import type { InputMessage } from "@overgrown/sim/protocol";
import { deviceToTargetOffset, type CameraLayout } from "../render/camera";

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

function sameInput(a: InputMessage, b: InputMessage): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveY === b.moveY &&
    a.aimX === b.aimX &&
    a.aimY === b.aimY &&
    a.sprint === b.sprint &&
    a.attackPresses === b.attackPresses &&
    a.dodgePresses === b.dodgePresses
  );
}

export class KeyboardMouseInput {
  private readonly held = new Set<string>();
  /** Internal edge-detection state for attack presses; not sent. */
  private lmbHeld = false;
  private attackPresses = 0;
  private dodgePresses = 0;
  /** Last pointer position in CSS client px, or null before the first pointer event. */
  private pointer: { x: number; y: number } | null = null;
  private layout: CameraLayout | null = null;
  private aimX = 0;
  private aimY = 0;
  private lastPosted: InputMessage | null = null;

  /** Attaches the listeners below. `post` receives a fresh InputMessage whenever any field changes. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly post: (msg: InputMessage) => void,
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
    this.flush();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!BOUND.has(e.code)) return;
    if (PREVENTED.has(e.code)) e.preventDefault();
    // Modifier chords are browser shortcuts (and on macOS a Meta-held key never sends keyup, so it would stick).
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    this.held.add(e.code);
    if (e.code === DODGE) this.dodgePresses = (this.dodgePresses + 1) >>> 0;
    this.flush();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!BOUND.has(e.code)) return;
    if (PREVENTED.has(e.code)) e.preventDefault();
    this.held.delete(e.code);
    this.flush();
  }

  private onPointer(e: PointerEvent): void {
    if (!isPointerAimDevice(e)) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    // `buttons` (not `button`) so LMB is seen in chords, where a second button sends pointermove, not pointerdown.
    const lmb = (e.buttons & 1) !== 0;
    if (lmb && !this.lmbHeld) this.attackPresses = (this.attackPresses + 1) >>> 0;
    this.lmbHeld = lmb;
    if (e.type === "pointerdown" && lmb) this.canvas.setPointerCapture(e.pointerId); // see the release outside the canvas
    this.updateAim();
    this.flush();
  }

  private releaseAll(): void {
    this.held.clear();
    this.lmbHeld = false;
    this.flush();
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

  /** Posts the current input if any field differs from the last posted message. */
  private flush(): void {
    const msg: InputMessage = {
      type: "input",
      moveX: this.heldBit(RIGHT) - this.heldBit(LEFT),
      moveY: this.heldBit(DOWN) - this.heldBit(UP),
      aimX: this.aimX,
      aimY: this.aimY,
      sprint: this.heldBit(SPRINT) === 1,
      attackPresses: this.attackPresses,
      dodgePresses: this.dodgePresses,
    };
    if (this.lastPosted !== null && sameInput(msg, this.lastPosted)) return;
    this.lastPosted = msg;
    this.post(msg);
  }
}
