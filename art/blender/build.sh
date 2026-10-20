#!/usr/bin/env bash
# Rebuilds the wanderer (ART-028): paints the texture atlas and builds, rigs, animates and exports the model.
#   bash art/blender/build.sh [--blend out.blend]
# Writes game/assets/wanderer/wanderer.glb and wanderer_albedo.png and prints their sha256 (a rebuild must
# reproduce the committed files byte for byte). Needs Blender 4.5 LTS on the PATH (tools/godot/setup.sh installs it).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/game/assets/wanderer"
# Removes the outputs first and fails on a Blender error, so a failed build can't pass off the committed files.
rm -f "$OUT/wanderer.glb" "$OUT/wanderer_albedo.png"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
status=0
PYTHONDONTWRITEBYTECODE=1 blender --background --factory-startup --python-exit-code 1 --python "$ROOT/art/blender/wanderer.py" -- \
  --glb "$OUT/wanderer.glb" --png "$OUT/wanderer_albedo.png" "$@" >"$LOG" 2>&1 || status=$?
grep -E '^\[wanderer|Error|Traceback|^  File|Exception' "$LOG" || true
if [ "$status" -ne 0 ] || grep -q 'Traceback' "$LOG"; then
  echo "build.sh: Blender failed (exit $status); see the lines above" >&2
  exit 1
fi
test -s "$OUT/wanderer.glb" && test -s "$OUT/wanderer_albedo.png"
sha256sum "$OUT/wanderer.glb" "$OUT/wanderer_albedo.png"
