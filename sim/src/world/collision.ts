// Foot-box collision against tiles. Contract: CLAUDE.md "Tile walkability, speed factor and water depth".
// Characters never collide with each other (OQ-025): this file reads tiles only.
// Only + - * / and Math.floor/abs/min/max are used (lint-enforced in sim/src/world/), so every JS engine computes the same bits.
//
// The box of a character at feet point (x, y) with Collider (hw, hh) is the half-open span
// [x - hw, x + hw) × [y - 2hh, y): a box edge exactly on a tile border does not touch the tile beyond it.
import { TILE_PX } from "../constants";
import { TILE_RULES, type TileLookup } from "./walkability";

/** First tile index the half-open span [a, b) touches. */
function first(a: number): number {
  return Math.floor(a / TILE_PX);
}

/** Last tile index the half-open span [a, b) touches: one below the smallest tile border at or above b. */
function last(b: number): number {
  return -Math.floor(-b / TILE_PX) - 1;
}

function blocked(tileAt: TileLookup, tx: number, ty: number): boolean {
  return !TILE_RULES[tileAt(tx, ty)].walkable;
}

/** True if any tile of column `col` in rows r0..r1 is blocked. */
function columnBlocked(tileAt: TileLookup, col: number, r0: number, r1: number): boolean {
  for (let row = r0; row <= r1; row++) if (blocked(tileAt, col, row)) return true;
  return false;
}

/** True if any tile of row `row` in columns c0..c1 is blocked. */
function rowBlocked(tileAt: TileLookup, row: number, c0: number, c1: number): boolean {
  for (let col = c0; col <= c1; col++) if (blocked(tileAt, col, row)) return true;
  return false;
}

/** The x after moving dx at fixed y: stops flush at the first blocked column it newly enters, nearest first. */
function resolveX(tileAt: TileLookup, x: number, y: number, hw: number, hh: number, dx: number): number {
  const r0 = first(y - 2 * hh);
  const r1 = last(y);
  if (dx > 0) {
    const end = last(x + dx + hw);
    for (let col = last(x + hw) + 1; col <= end; col++) {
      if (columnBlocked(tileAt, col, r0, r1)) return col * TILE_PX - hw;
    }
  } else if (dx < 0) {
    const end = first(x + dx - hw);
    for (let col = first(x - hw) - 1; col >= end; col--) {
      if (columnBlocked(tileAt, col, r0, r1)) return (col + 1) * TILE_PX + hw;
    }
  }
  return x + dx;
}

/** The y after moving dy at fixed x: stops flush at the first blocked row it newly enters, nearest first. */
function resolveY(tileAt: TileLookup, x: number, y: number, hw: number, hh: number, dy: number): number {
  const c0 = first(x - hw);
  const c1 = last(x + hw);
  if (dy > 0) {
    const end = last(y + dy);
    for (let row = last(y) + 1; row <= end; row++) {
      if (rowBlocked(tileAt, row, c0, c1)) return row * TILE_PX;
    }
  } else if (dy < 0) {
    const end = first(y + dy - 2 * hh);
    for (let row = first(y - 2 * hh) - 1; row >= end; row--) {
      if (rowBlocked(tileAt, row, c0, c1)) return (row + 1) * TILE_PX + 2 * hh;
    }
  }
  return y + dy;
}

/**
 * Moves the box by (dx, dy): x first (at the old y), then y (at the new x). Returns the new feet point.
 * Every column/row the box newly enters is scanned, so no speed tunnels through a wall. Only newly entered tiles are
 * checked: a box already overlapping a blocked tile is never pushed out and can walk out. An axis blocked by a wall
 * keeps the other axis's full displacement (sliding).
 */
export function slideMove(
  tileAt: TileLookup,
  x: number,
  y: number,
  hw: number,
  hh: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const nx = resolveX(tileAt, x, y, hw, hh, dx);
  const ny = resolveY(tileAt, nx, y, hw, hh, dy);
  return { x: nx, y: ny };
}

/** TILE_RULES[tile under the box centre (x, y − hh)].speed */
export function speedFactorAt(tileAt: TileLookup, x: number, y: number, hh: number): number {
  return TILE_RULES[tileAt(first(x), first(y - hh))].speed;
}
