#!/usr/bin/env bash
# Imports the project, then runs the GDScript tests (game/tests/test_*.gd). Exits with the runner's code.
#   tools/godot/test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

godot --headless --path "$ROOT/game" --import
exec godot --headless --path "$ROOT/game" --script res://tests/run.gd
