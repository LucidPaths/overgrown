// The touch controls as DOM circles over the canvas (crisp at any DPR, no atlas frames). Draws exactly what
// CMB-002's currentTouchLayout() hit-tests; it listens to nothing but `resize`, and decides nothing: whether it is
// visible comes from HostInput.active, via main.ts.
import { currentTouchLayout, type ButtonsDown, type StickView } from "../input/touch";
import type { Circle, TouchLayout } from "../input/touch-controls";
import "./touch-overlay.css";

const STICK_KNOB_PX = 48;

function circle(cls: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  return el;
}

/** Sizes the element 2r x 2r and moves its centre to (x, y). */
function place(el: HTMLElement, x: number, y: number, r: number): void {
  el.style.width = `${2 * r}px`;
  el.style.height = `${2 * r}px`;
  el.style.transform = `translate(${x - r}px, ${y - r}px)`;
}

export class TouchOverlay {
  private readonly root = document.createElement("div");
  private readonly base = circle("tu-stick-base tu-idle");
  private readonly knob = circle("tu-stick-knob tu-idle");
  private readonly slots = [circle("tu-slot"), circle("tu-slot"), circle("tu-slot"), circle("tu-slot")] as const;
  private readonly dodge = circle("tu-dodge");
  private readonly attack = circle("tu-attack");
  private layout: TouchLayout = currentTouchLayout();
  /** What the DOM currently shows (null = not written yet), so a steady state writes nothing. */
  private lastVisible: boolean | null = null;
  private lastStick: string | null = null;
  private lastAttack: boolean | null = null;
  private lastDodge: boolean | null = null;

  /** Builds #touch-ui (hidden) as the last child of `parent`, positioned from currentTouchLayout(); re-lays out on window `resize`. */
  constructor(parent: HTMLElement) {
    this.root.id = "touch-ui";
    this.root.setAttribute("aria-hidden", "true");
    this.root.hidden = true;
    this.root.append(this.base, this.knob, ...this.slots, this.dodge, this.attack);
    parent.appendChild(this.root);
    this.placeStatic();
    window.addEventListener("resize", () => {
      this.layout = currentTouchLayout();
      this.placeStatic();
      // The idle stick rests on the layout, so it must move too.
      this.lastStick = null;
    });
  }

  private placeStatic(): void {
    const l = this.layout;
    place(this.attack, l.attack.x, l.attack.y, l.attack.r);
    place(this.dodge, l.dodge.x, l.dodge.y, l.dodge.r);
    l.ring.forEach((c: Circle, i) => place(this.slots[i]!, c.x, c.y, c.r));
  }

  /** Once per render frame. Writes to the DOM only what changed since the last call. */
  update(visible: boolean, stick: StickView | null, buttonsDown: ButtonsDown): void {
    if (visible !== this.lastVisible) {
      this.root.hidden = !visible;
      this.lastVisible = visible;
    }
    const key = stick === null ? "idle" : `${stick.originX},${stick.originY},${stick.knobX},${stick.knobY}`;
    if (key !== this.lastStick) {
      this.lastStick = key;
      if (stick === null) {
        const rest = this.layout.stickRest;
        place(this.base, rest.x, rest.y, rest.r);
        place(this.knob, rest.x, rest.y, STICK_KNOB_PX / 2);
      } else {
        place(this.base, stick.originX, stick.originY, this.layout.stickRest.r);
        place(this.knob, stick.knobX, stick.knobY, STICK_KNOB_PX / 2);
      }
      this.base.classList.toggle("tu-idle", stick === null);
      this.knob.classList.toggle("tu-idle", stick === null);
    }
    if (buttonsDown.attack !== this.lastAttack) {
      this.attack.classList.toggle("tu-down", buttonsDown.attack);
      this.lastAttack = buttonsDown.attack;
    }
    if (buttonsDown.dodge !== this.lastDodge) {
      this.dodge.classList.toggle("tu-down", buttonsDown.dodge);
      this.lastDodge = buttonsDown.dodge;
    }
  }
}
