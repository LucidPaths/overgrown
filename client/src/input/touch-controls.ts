// Touch control geometry: where the buttons are, what a touch point hits, and how a stick drag becomes a move.
// Pure (no DOM). All lengths are CSS px in client coordinates, the same space as PointerEvent.clientX/Y and
// window.innerWidth/innerHeight. Every constant is tunable.
export const STICK_RADIUS_PX = 56; // knob travel for full deflection
export const STICK_DEAD_ZONE = 0.15; // fraction of STICK_RADIUS_PX
export const SPRINT_DEFLECTION = 0.9; // OQ-021: full stick deflection sprints
export const EDGE_MARGIN_PX = 16; // from each safe-area edge
export const ATTACK_RADIUS_PX = 44; // 88 px button (A-38)
export const DODGE_RADIUS_PX = 28; // 56 px button (A-38)
export const DODGE_GAP_PX = 12; // horizontal gap between attack and dodge
export const RING_SLOT_RADIUS_PX = 24; // 48 px slots
export const RING_DISTANCE_PX = 128; // slot centre to attack centre
export const RING_ANGLES_DEG = [75, 105, 135, 165] as const; // 0 = right, 90 = up on screen

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Centre + radius. */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface TouchLayout {
  viewW: number;
  viewH: number;
  /** Where UIX-002 draws the idle floating stick. Visual only, not a hit area. r = STICK_RADIUS_PX. */
  stickRest: Circle;
  attack: Circle;
  dodge: Circle;
  /** Ability ring, in RING_ANGLES_DEG order. Disabled until CMB-003. */
  ring: readonly [Circle, Circle, Circle, Circle];
}

export type TouchTarget = "attack" | "dodge" | "ring" | "stick" | null;

export function layoutTouchControls(viewW: number, viewH: number, insets: Insets): TouchLayout {
  const ax = viewW - insets.right - EDGE_MARGIN_PX - ATTACK_RADIUS_PX;
  const ay = viewH - insets.bottom - EDGE_MARGIN_PX - ATTACK_RADIUS_PX;
  const slot = (deg: number): Circle => {
    const rad = (deg * Math.PI) / 180;
    return { x: ax + RING_DISTANCE_PX * Math.cos(rad), y: ay - RING_DISTANCE_PX * Math.sin(rad), r: RING_SLOT_RADIUS_PX };
  };
  const [a0, a1, a2, a3] = RING_ANGLES_DEG;
  return {
    viewW,
    viewH,
    stickRest: {
      x: insets.left + EDGE_MARGIN_PX + STICK_RADIUS_PX,
      y: viewH - insets.bottom - EDGE_MARGIN_PX - STICK_RADIUS_PX,
      r: STICK_RADIUS_PX,
    },
    attack: { x: ax, y: ay, r: ATTACK_RADIUS_PX },
    dodge: {
      x: ax - ATTACK_RADIUS_PX - DODGE_GAP_PX - DODGE_RADIUS_PX,
      y: ay + ATTACK_RADIUS_PX - DODGE_RADIUS_PX,
      r: DODGE_RADIUS_PX,
    },
    ring: [slot(a0), slot(a1), slot(a2), slot(a3)],
  };
}

function inside(c: Circle, x: number, y: number): boolean {
  const dx = x - c.x;
  const dy = y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

/** Circles are inclusive. Buttons beat the stick zone, which is the whole left half of the view. */
export function hitTest(layout: TouchLayout, x: number, y: number): TouchTarget {
  if (inside(layout.attack, x, y)) return "attack";
  if (inside(layout.dodge, x, y)) return "dodge";
  if (layout.ring.some((c) => inside(c, x, y))) return "ring";
  return x < layout.viewW / 2 ? "stick" : null;
}

function clampUnit(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

/**
 * Stick offset from its origin (CSS px) → move axes and sprint. Dead zone, then a linear rescale to full speed at
 * SPRINT_DEFLECTION, where the move is forced to unit length and sprint turns on. Axes are clamped to [-1, 1]
 * because the sim treats an out-of-range axis as a RangeError.
 */
export function stickToMove(dx: number, dy: number): { moveX: number; moveY: number; sprint: boolean } {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new RangeError(`stickToMove: dx and dy must be finite, got dx=${dx}, dy=${dy}`);
  }
  const d = Math.sqrt(dx * dx + dy * dy);
  const m = d / STICK_RADIUS_PX;
  if (m <= STICK_DEAD_ZONE) return { moveX: 0, moveY: 0, sprint: false };
  const sprint = m >= SPRINT_DEFLECTION;
  const mag = sprint ? 1 : (m - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  return { moveX: clampUnit((dx / d) * mag), moveY: clampUnit((dy / d) * mag), sprint };
}
