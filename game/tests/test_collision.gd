extends RefCounted
## OgCollision: ports sim/src/world/collision.test.ts in metres, with the game's foot box (OgRules.FOOT_HALF_M).

const H := OgRules.FOOT_HALF_M


## A hand-drawn test ground. Legend: `.` Grass, `#` Cliff, `~` ShallowWater, `D` DeepWater, `V` VeryDeepWater.
## Row k is tile row ty0 + k, column j is tile column tx0 + j; every other tile is `fill`.
## test_character_rules.gd uses it too.
class Ground:
	extends RefCounted
	const LEGEND := {".": OgTile.GRASS, "#": OgTile.CLIFF, "~": OgTile.SHALLOW_WATER, "D": OgTile.DEEP_WATER, "V": OgTile.VERY_DEEP_WATER}
	var _tiles := {} # Vector2i -> tile id
	var _fill := OgTile.GRASS

	func _init(rows: Array, tx0: int, ty0: int, fill: int = OgTile.GRASS) -> void:
		_fill = fill
		for k in rows.size():
			var row: String = rows[k]
			for j in row.length():
				_tiles[Vector2i(tx0 + j, ty0 + k)] = LEGEND[row[j]]

	func tile_at(tx: int, ty: int) -> int:
		return _tiles.get(Vector2i(tx, ty), _fill)


## A one-tile-wide wall column of `ch` at tile column tx, over tile rows -8..8.
static func wall_column(ch: String, tx: int) -> Ground:
	var rows: Array[String] = []
	for k in 17:
		rows.append(ch)
	return Ground.new(rows, tx, -8)


## A one-tile-high wall row of `ch` at tile row ty, over tile columns -8..8.
static func wall_row(ch: String, ty: int) -> Ground:
	return Ground.new([ch.repeat(17)], -8, ty)


func _check_move(t: TestContext, name: String, g: Ground, from: Vector2, d: Vector2, want: Vector2) -> void:
	var got := OgCollision.slide_move(g, from, H, d)
	t.check(got == want, "%s: slide_move from %s by %s = %s, want %s" % [name, from, d, got, want])


func test_stops_flush_on_each_axis_and_direction_without_tunnelling(t: TestContext) -> void:
	var cases := [
		["west wall at tx -1", wall_column("#", -1), Vector2(1.25, 0.5), Vector2(-2.0, 0.0), Vector2(H, 0.5)],
		["east wall at tx 3", wall_column("#", 3), Vector2(1.875, 0.5), Vector2(2.0, 0.0), Vector2(3.0 - H, 0.5)],
		["east wall, destination past it", wall_column("#", 3), Vector2(1.875, 0.5), Vector2(3.0, 0.0), Vector2(3.0 - H, 0.5)],
		["east wall 20 m away in one step", wall_column("D", 20), Vector2(0.5, 0.5), Vector2(40.0, 0.0), Vector2(20.0 - H, 0.5)],
		["south deep water row at ty 2", wall_row("D", 2), Vector2(0.5, 1.25), Vector2(0.0, 2.0), Vector2(0.5, 2.0 - H)],
		["north very deep water row at ty -1", wall_row("V", -1), Vector2(0.5, 0.625), Vector2(0.0, -2.0), Vector2(0.5, H)],
		["negative x: west wall at tx -5", wall_column("#", -5), Vector2(-2.5, -3.5), Vector2(-5.0, 0.0), Vector2(-4.0 + H, -3.5)],
		["negative z: north row at ty -7", wall_row("#", -7), Vector2(-2.5, -3.5), Vector2(0.0, -10.0), Vector2(-2.5, -6.0 + H)],
	]
	for c: Array in cases:
		_check_move(t, c[0], c[1], c[2], c[3], c[4])
		# Pushing again from the flush stop goes nowhere.
		_check_move(t, c[0] + " (again)", c[1], c[4], c[3], c[4])


## Guards the 32-bit Vector2 trap: a flush stop must read back as touching the wall, never overlapping it, at every
## column and row, or the next step skips the wall and walks through it.
func test_flush_stops_hold_at_every_border(t: TestContext) -> void:
	for k in range(-64, 65):
		var col := wall_column("#", k)
		_check_move(t, "east into column %d" % k, col, Vector2(k - 2.5, 0.5), Vector2(5.0, 0.0), Vector2(k - H, 0.5))
		_check_move(t, "east again at column %d" % k, col, Vector2(k - H, 0.5), Vector2(0.01, 0.0), Vector2(k - H, 0.5))
		_check_move(t, "west into column %d" % k, col, Vector2(k + 3.5, 0.5), Vector2(-5.0, 0.0), Vector2(k + 1 + H, 0.5))
		_check_move(t, "west again at column %d" % k, col, Vector2(k + 1 + H, 0.5), Vector2(-0.01, 0.0), Vector2(k + 1 + H, 0.5))
		var row := wall_row("#", k)
		_check_move(t, "south into row %d" % k, row, Vector2(0.5, k - 2.5), Vector2(0.0, 5.0), Vector2(0.5, k - H))
		_check_move(t, "south again at row %d" % k, row, Vector2(0.5, k - H), Vector2(0.0, 0.01), Vector2(0.5, k - H))
		_check_move(t, "north into row %d" % k, row, Vector2(0.5, k + 3.5), Vector2(0.0, -5.0), Vector2(0.5, k + 1 + H))
		_check_move(t, "north again at row %d" % k, row, Vector2(0.5, k + 1 + H), Vector2(0.0, -0.01), Vector2(0.5, k + 1 + H))


func test_slides_along_walls_and_resolves_x_before_z_at_an_outside_corner(t: TestContext) -> void:
	var wall := wall_column("#", 3)
	_check_move(t, "slide along the east wall", wall, Vector2(2.5, 0.5), Vector2(0.25, 0.25), Vector2(3.0 - H, 0.75))
	_check_move(t, "parallel to a flush wall", wall, Vector2(3.0 - H, 0.5), Vector2(0.0, 1.0), Vector2(3.0 - H, 1.5))
	# A single cliff at tile (2, 2): x is free alone (at the old z), then z stops flush on top of it.
	# Resolving z first would give (2 - H, 2.0) instead.
	var corner := Ground.new(["#"], 2, 2)
	_check_move(t, "outside corner", corner, Vector2(1.5, 1.5), Vector2(0.5, 0.5), Vector2(2.0, 2.0 - H))


func test_box_straddling_two_rows_is_stopped_by_either_row(t: TestContext) -> void:
	# Feet z 1.0: the box covers z 1 - H .. 1 + H, so tile rows 0 and 1.
	_check_move(t, "cliff in the upper row only", Ground.new(["#"], 3, 0), Vector2(1.5, 1.0), Vector2(3.0, 0.0), Vector2(3.0 - H, 1.0))
	_check_move(t, "cliff in the lower row only", Ground.new(["#"], 3, 1), Vector2(1.5, 1.0), Vector2(3.0, 0.0), Vector2(3.0 - H, 1.0))


## Only newly entered tiles are checked: a box placed overlapping a blocked tile is never pushed out and walks out.
func test_box_inside_a_blocked_tile_walks_out(t: TestContext) -> void:
	var cliff := Ground.new(["#"], 3, 3)
	_check_move(t, "east out of the cliff", cliff, Vector2(3.5, 3.5), Vector2(1.0, 0.0), Vector2(4.5, 3.5))
	_check_move(t, "west out of the cliff", cliff, Vector2(3.5, 3.5), Vector2(-1.0, 0.0), Vector2(2.5, 3.5))
	_check_move(t, "south out of the cliff", cliff, Vector2(3.5, 3.5), Vector2(0.0, 1.0), Vector2(3.5, 4.5))
	_check_move(t, "north out of the cliff", cliff, Vector2(3.5, 3.5), Vector2(0.0, -1.0), Vector2(3.5, 2.5))


func test_speed_factor_samples_the_tile_under_the_feet_point(t: TestContext) -> void:
	var row := wall_row("~", 2)
	var water := OgWalkability.SHALLOW_WATER_SPEED
	for c: Array in [[Vector2(0.5, 1.99), 1.0], [Vector2(0.5, 2.0), water], [Vector2(0.5, 2.99), water], [Vector2(0.5, 3.0), 1.0]]:
		var f := OgCollision.speed_factor_at(row, c[0])
		t.check(f == c[1], "row: speed_factor_at(%s) = %s, want %s" % [c[0], f, c[1]])
	# Shallow water in column 2 only: the box centre decides, not an x-edge of the box.
	var col := Ground.new(["~"], 2, 0)
	for c: Array in [[Vector2(1.9, 0.5), 1.0], [Vector2(2.1, 0.5), water], [Vector2(2.9, 0.5), water], [Vector2(3.1, 0.5), 1.0]]:
		var f := OgCollision.speed_factor_at(col, c[0])
		t.check(f == c[1], "column: speed_factor_at(%s) = %s, want %s" % [c[0], f, c[1]])
