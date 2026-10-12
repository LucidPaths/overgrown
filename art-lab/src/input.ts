// Lab input: keyboard + mouse and touch, merged into one InputMessage (the sim's protocol), posted on change.
// Mirrors client/src/input/host-input.ts in spirit: held fields from the device in use, u32 press counters.
import type { InputMessage } from "../../sim/src/protocol";

export interface InputHost {
  /** called every frame with the player's feet point in CSS px, so the mouse aim can be made relative */
  frame(playerCss: [number, number], cssPerWorldX: number, cssPerWorldY: number): void;
  readonly msg: InputMessage;
  touchActive: boolean;
}

export function createInput(canvas: HTMLCanvasElement, post: (m: InputMessage) => void): InputHost {
  const keys = new Set<string>();
  const msg: InputMessage = { type: "input", moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprint: false, attackPresses: 0, dodgePresses: 0 };
  let last = "";
  let mouse: [number, number] | null = null;
  let stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  const host: InputHost = { msg, touchActive: matchMedia("(pointer: coarse)").matches, frame };

  const press = (k: "attackPresses" | "dodgePresses") => { msg[k] = (msg[k] + 1) >>> 0; };
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "Space" || e.code === "KeyJ") press("attackPresses");
    if (e.code === "KeyK" || e.code === "ControlLeft" || e.code === "KeyL") press("dodgePresses");
    host.touchActive = false;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { mouse = [e.clientX, e.clientY]; host.touchActive = false; } });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    mouse = [e.clientX, e.clientY];
    if (e.button === 0) press("attackPresses");
    if (e.button === 2) press("dodgePresses");
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // touch: a floating stick on the left half; the right half has an attack and a dodge button
  const ui = document.createElement("div");
  ui.className = "touch";
  // icons drawn as pixel rects (crispEdges SVG): a sword and a roll arrow, in the outline colour
  const sword = `<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><path fill="#20202c" d="M9 1h2v2h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h1v-1h1v-1h1v-1h1zM3 7h1v1h1v1h1v1h-1v1h-1v-1h-1v1h-2v-2h1v-1h-1v-1h2z"/></svg>`;
  const roll = `<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><path fill="#20202c" d="M4 2h4v1h1v1h1v4h-1v1h-1v-2h1v-3h-1v-1h-3v1h-1v1h2v1h-4v-4h1v1h1z"/></svg>`;
  ui.innerHTML = `<div class="stick"><div class="knob"></div></div><button class="b atk" aria-label="attack">${sword}</button><button class="b dodge" aria-label="dodge">${roll}</button>`;
  document.body.appendChild(ui);
  const stickEl = ui.querySelector(".stick") as HTMLDivElement, knob = ui.querySelector(".knob") as HTMLDivElement;
  const btn = (sel: string, k: "attackPresses" | "dodgePresses") =>
    (ui.querySelector(sel) as HTMLButtonElement).addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); press(k); host.touchActive = true; });
  btn(".atk", "attackPresses");
  btn(".dodge", "dodgePresses");
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || e.clientX > innerWidth / 2) return;
    host.touchActive = true;
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointermove", (e) => { if (stick && e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; } });
  const end = (e: PointerEvent) => { if (stick && e.pointerId === stick.id) stick = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  function frame(p: [number, number], sx: number, sy: number): void {
    ui.classList.toggle("on", host.touchActive);
    let mx = 0, my = 0;
    if (stick) {
      const R = 46;
      let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      mx = dx / R; my = dy / R;
      if (Math.hypot(mx, my) < 0.18) mx = my = 0;
      stickEl.style.display = "block";
      stickEl.style.left = `${stick.ox}px`; stickEl.style.top = `${stick.oy}px`;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else {
      stickEl.style.display = "none";
      if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
    }
    msg.moveX = Math.max(-1, Math.min(1, mx));
    msg.moveY = Math.max(-1, Math.min(1, my));
    msg.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || (stick !== null && Math.hypot(mx, my) > 0.95);
    if (mouse && !host.touchActive) {
      // the sim's y-down ground plane: screen y shrinks by the camera pitch
      msg.aimX = clampAim((mouse[0] - p[0]) / sx);
      msg.aimY = clampAim((mouse[1] - p[1]) / sy);
    } else {
      msg.aimX = msg.moveX * 32;
      msg.aimY = msg.moveY * 32;
    }
    const key = JSON.stringify(msg);
    if (key !== last) { last = key; post({ ...msg }); }
  }
  return host;
}

const clampAim = (v: number) => Math.max(-4096, Math.min(4096, Math.round(v * 8) / 8));
