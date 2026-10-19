#!/usr/bin/env bash
# Imports the project, then runs the GDScript tests (game/tests/test_*.gd).
# Exits 1 if the runner fails, if either step times out, or if either step prints "SCRIPT ERROR" or a line
# starting "ERROR:": Godot carries on after runtime and parse errors in game scripts, and a script error in
# the runner itself can leave it hanging, so neither the exit code nor termination can be trusted.
#   tools/godot/test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TIMEOUT_S="${GODOT_TEST_TIMEOUT:-300}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

# run_godot <args...>: runs godot with a timeout, output tee'd to $LOG; exits 1 on a timeout.
run_godot() {
  timeout "$TIMEOUT_S" godot "$@" 2>&1 | tee -a "$LOG"
  local code=${PIPESTATUS[0]}
  if [ "$code" -eq 124 ]; then
    echo "test.sh: godot timed out" >&2
    exit 1
  fi
  return "$code"
}

run_godot --headless --path "$ROOT/game" --import
import_code=$?
run_godot --headless --path "$ROOT/game" --script res://tests/run.gd
run_code=$?

if [ "$import_code" -ne 0 ]; then
  echo "test.sh: godot --import exited with $import_code" >&2
  exit 1
fi
if grep -qE 'SCRIPT ERROR|^ERROR:' "$LOG"; then
  echo "test.sh: Godot printed script errors (see SCRIPT ERROR / ERROR: lines above)" >&2
  exit 1
fi
exit "$run_code"
