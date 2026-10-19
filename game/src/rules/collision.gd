class_name OgCollision
extends RefCounted
## Foot-box collision against tiles. Ports sim/src/world/collision.ts in metres. Characters never collide
## with each other (OQ-025): this reads tiles only. Only + - * /, floor, min and max.
##
## The box of a character at feet point (x, z) with half-size h is the half-open square
## [x - h, x + h) x [z - h, z + h): a box edge exactly on a tile border does not touch the tile beyond it.
## `ground` is anything with tile_at(tx: int, ty: int) -> int (OgChunkStore in the game, fakes in tests).
## Tile (tx, ty) covers x in [tx, tx + 1) and z in [ty, ty + 1) (OgWorld.TILE_M = 1).
##
## Positions are stored in Vector2 (32-bit floats) and computed here in 64-bit floats. With a dyadic half-size
## (OgRules.FOOT_HALF_M) every border position k ± h is exact in both, and rounding to 32 bits is monotonic,
## so the stored box never covers a tile the scan did not check.


## First tile index the half-open span [a, b) touches.
static func _first(a: float) -> int:
	return floori(a / OgWorld.TILE_M)


## Last tile index the half-open span [a, b) touches: one below the smallest tile border at or above b.
static func _last(b: float) -> int:
	return -floori(-b / OgWorld.TILE_M) - 1


static func _blocked(ground: Object, tx: int, ty: int) -> bool:
	return not OgWalkability.TILE_RULES[ground.tile_at(tx, ty)]["walkable"]


## True if any tile of column `col` in rows r0..r1 is blocked.
static func _column_blocked(ground: Object, col: int, r0: int, r1: int) -> bool:
	for row in range(r0, r1 + 1):
		if _blocked(ground, col, row):
			return true
	return false


## True if any tile of row `row` in columns c0..c1 is blocked.
static func _row_blocked(ground: Object, row: int, c0: int, c1: int) -> bool:
	for col in range(c0, c1 + 1):
		if _blocked(ground, col, row):
			return true
	return false


## The x after moving dx at fixed z: stops flush at the first blocked column it newly enters, nearest first.
static func _resolve_x(ground: Object, x: float, z: float, h: float, dx: float) -> float:
	var r0 := _first(z - h)
	var r1 := _last(z + h)
	if dx > 0.0:
		var end := _last(x + dx + h)
		for col in range(_last(x + h) + 1, end + 1):
			if _column_blocked(ground, col, r0, r1):
				return col * OgWorld.TILE_M - h
	elif dx < 0.0:
		var end := _first(x + dx - h)
		for col in range(_first(x - h) - 1, end - 1, -1):
			if _column_blocked(ground, col, r0, r1):
				return (col + 1) * OgWorld.TILE_M + h
	return x + dx


## The z after moving dz at fixed x: stops flush at the first blocked row it newly enters, nearest first.
static func _resolve_z(ground: Object, x: float, z: float, h: float, dz: float) -> float:
	var c0 := _first(x - h)
	var c1 := _last(x + h)
	if dz > 0.0:
		var end := _last(z + dz + h)
		for row in range(_last(z + h) + 1, end + 1):
			if _row_blocked(ground, row, c0, c1):
				return row * OgWorld.TILE_M - h
	elif dz < 0.0:
		var end := _first(z + dz - h)
		for row in range(_first(z - h) - 1, end - 1, -1):
			if _row_blocked(ground, row, c0, c1):
				return (row + 1) * OgWorld.TILE_M + h
	return z + dz


## Moves the box at `pos` by `delta`: x first (at the old z), then z (at the new x). Returns the new feet
## point. Every column or row the box newly enters is scanned, so no speed tunnels through a wall. Only newly
## entered tiles are checked: a box already overlapping a blocked tile is never pushed out and can walk out.
## An axis blocked by a wall keeps the other axis's full displacement (sliding).
static func slide_move(ground: Object, pos: Vector2, half: float, delta: Vector2) -> Vector2:
	var nx := _resolve_x(ground, pos.x, pos.y, half, delta.x)
	var nz := _resolve_z(ground, nx, pos.y, half, delta.y)
	return Vector2(nx, nz)


## TILE_RULES[the tile under the box centre = the feet point].speed
static func speed_factor_at(ground: Object, pos: Vector2) -> float:
	return OgWalkability.TILE_RULES[ground.tile_at(_first(pos.x), _first(pos.y))]["speed"]
