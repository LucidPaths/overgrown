#!/usr/bin/env bash
# Rebuilds the wanderer (ART-028): paints the texture atlas and builds, rigs, animates and exports the model.
#   bash art/blender/build.sh [--blend out.blend]
# Writes game/assets/wanderer/wanderer.glb and wanderer_albedo.png and prints their sha256 (a rebuild must
# reproduce the committed files byte for byte). Needs Blender 4.5 LTS on the PATH (tools/godot/setup.sh installs it).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/game/assets/wanderer"
blender --background --factory-startup --python "$ROOT/art/blender/wanderer.py" -- \
  --glb "$OUT/wanderer.glb" --png "$OUT/wanderer_albedo.png" "$@" 2>&1 | grep -E '^\[wanderer|Error|Traceback|^  File|Exception' || true
test -s "$OUT/wanderer.glb" && test -s "$OUT/wanderer_albedo.png"
sha256sum "$OUT/wanderer.glb" "$OUT/wanderer_albedo.png"
