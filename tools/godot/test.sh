#!/usr/bin/env bash
# Imports the project, then runs the GDScript tests (game/tests/test_*.gd).
# Exits 1 if the runner fails, or if either step prints "SCRIPT ERROR" or a line starting "ERROR:":
# Godot carries on after runtime and parse errors in game scripts, so the exit code alone can't be trusted.
#   tools/godot/test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

godot --headless --path "$ROOT/game" --import 2>&1 | tee "$LOG"
import_code=${PIPESTATUS[0]}
godot --headless --path "$ROOT/game" --script res://tests/run.gd 2>&1 | tee -a "$LOG"
run_code=${PIPESTATUS[0]}

if [ "$import_code" -ne 0 ]; then
  echo "test.sh: godot --import exited with $import_code" >&2
  exit 1
fi
if grep -qE 'SCRIPT ERROR|^ERROR:' "$LOG"; then
  echo "test.sh: Godot printed script errors (see SCRIPT ERROR / ERROR: lines above)" >&2
  exit 1
fi
exit "$run_code"
