class_name OgSim
extends RefCounted
## The host's rules world: the tick counter, the characters, the chunk store and one input latch per driven
## character. Plain class (no scene tree, no devices). step() is the one rule step every character shares; no line
## here knows which character is the local player (`you` is only for the views).

var tick := 0
var characters: Array[OgCharacter] = []
var store: OgChunkStore
## The spawn feet point in metres: the centre of OgSpawn.find_spawn's tile.
var spawn := Vector2.ZERO
## The local player's character, for the views. Rules never read it.
var you: OgCharacter = null
var _latches := {} # OgCharacter -> OgInputLatch, the characters a host input channel drives


## A sim for world seed `seed`, or null if find_spawn failed (it reported why).
static func create(seed: int) -> OgSim:
	var p := OgSpawn.find_spawn(seed)
	if p.is_empty():
		return null
	var sim := OgSim.new()
	sim.store = OgChunkStore.new(seed)
	sim.spawn = Vector2(p["x"], p["y"]) / OgWorld.TILE_PX * OgWorld.TILE_M
	return sim


## A new character at feet point `at` (metres), IDLE since this tick. The only way to make one.
func add_character(at: Vector2) -> OgCharacter:
	var c := OgCharacter.new(at, tick)
	characters.append(c)
	return c


## Makes c a driven character (an input channel feeds it, and the world streams around it). Returns its latch.
func drive(c: OgCharacter) -> OgInputLatch:
	var latch := OgInputLatch.new()
	_latches[c] = latch
	return latch


## One rules tick (1 / OgRules.TICK_HZ seconds).
func step() -> void:
	for c: OgCharacter in _latches:
		_latches[c].latch(c)
	OgActionRules.step_actions(characters, tick)
	OgMovement.step_movement(characters, tick, store)
	var anchors: Array[Vector2] = []
	for c: OgCharacter in _latches:
		anchors.append(c.pos)
	store.set_anchors(anchors)
	store.step()
	tick += 1
