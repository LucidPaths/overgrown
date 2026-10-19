class_name OgRules
extends RefCounted
## The rules tick and every tunable rule number (the feel numbers), in metres, seconds and ticks.
## Every duration is a whole number of ticks, round(seconds * TICK_HZ).

## Rules ticks per second. Equals physics/common/physics_ticks_per_second (a test checks): one rules step per
## physics tick.
const TICK_HZ := 60

## Walk speed at full stick (OQ-025: 5 tiles/s; tunable).
const WALK_SPEED_M_S := 5.0
## Sprint speed = walk speed * this (OQ-021; tunable).
const SPRINT_MULTIPLIER := 1.6
## A dodge rolls this far over DODGE_TICKS on open ground (OQ-021; tunable).
const DODGE_DISTANCE_M := 3.0
const DODGE_TICKS := roundi(0.35 * TICK_HZ) # 21
const DODGE_SPEED_M_S := DODGE_DISTANCE_M * TICK_HZ / DODGE_TICKS
## An attack lasts this long, rooted (OQ-021; tunable).
const ATTACK_TICKS := roundi(0.4 * TICK_HZ) # 24
## A press made in the last BUFFER_TICKS of an attack or dodge starts the next action when it ends (tunable).
const BUFFER_TICKS := roundi(0.2 * TICK_HZ) # 12
## Foot box: a square of this half-size centred on the feet point (tunable). Keep it a dyadic fraction
## (k / 2^n): positions are Vector2 (32-bit floats), and only then is a flush stop col - half exact, so
## the stopped box reads as touching the wall, not overlapping it (CLAUDE.md trap "Vector2 is 32-bit").
const FOOT_HALF_M := 0.3125
