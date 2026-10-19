#!/usr/bin/env bash
# One-command round trip: Blender (build + rig + animate + export .glb + Cycles preview)
#   -> Godot headless import -> Godot asset test -> Godot captures (Xvfb, software GPU)
#   -> contact sheets in spike/img/.
#
#   spike/tools/rebuild.sh [--renderers "forward_plus mobile gl_compatibility"] [--no-preview] [--eevee]
#
# Needs the tools from spike/tools/setup.sh. Exit code != 0 if any stage fails.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
RENDERERS="forward_plus mobile gl_compatibility"
PREVIEW=1
EEVEE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --renderers) RENDERERS="$2"; shift 2 ;;
    --no-preview) PREVIEW=0; shift ;;
    --eevee) EEVEE=1; shift ;;
    *) echo "unknown arg $1"; exit 2 ;;
  esac
done
BUILD=spike/build
IMG=spike/img
CAP=$BUILD/cap
mkdir -p "$BUILD" "$IMG" "$CAP"
TIMES="$IMG/timings.txt"
: >"$TIMES"

stage() { # stage <name> <cmd...>: run, time, log; abort on failure
  local name="$1"; shift
  local t0 t1
  t0=$(date +%s.%N)
  if ! "$@" >"$BUILD/$name.log" 2>&1; then
    echo "[rebuild] $name FAILED (log: $BUILD/$name.log)"; tail -20 "$BUILD/$name.log"; exit 1
  fi
  t1=$(date +%s.%N)
  printf '[rebuild] %-22s %7.1fs\n' "$name" "$(echo "$t1 - $t0" | bc)" | tee -a "$TIMES"
}

stage blender_build blender --background --factory-startup --python spike/blender/build_character.py -- \
  --blend "$BUILD/character.blend" --glb spike/godot/assets/character.glb
grep -E '^\[build\]' "$BUILD/blender_build.log" | sed 's/^/    /' | tee -a "$TIMES"
sha256sum spike/godot/assets/character.glb | sed 's/^/    glb sha256 /' | tee -a "$TIMES"

if [ "$PREVIEW" = 1 ]; then
  stage blender_cycles blender --background "$BUILD/character.blend" --python spike/blender/render_preview.py -- \
    --out "$BUILD/cy" --engine CYCLES --samples 32 --res 640
  grep -E '^\[render\]' "$BUILD/blender_cycles.log" | sed 's/^/    /' | tee -a "$TIMES"
  convert "$BUILD/cy_front.png" -resize 512x512 "$IMG/blender_cycles_front.png"
  montage "$BUILD"/cy_walk_0{0,3,6,9}.png -tile 4x1 -geometry 360x360+2+2 "$IMG/blender_cycles_walk.png"
fi
if [ "$EEVEE" = 1 ]; then
  stage blender_eevee xvfb-run -a -s '-screen 0 1280x720x24' blender --background "$BUILD/character.blend" \
    --python spike/blender/render_preview.py -- --out "$BUILD/ee" --engine EEVEE --samples 16 --res 640
  grep -E '^\[render\]' "$BUILD/blender_eevee.log" | sed 's/^/    /' | tee -a "$TIMES"
  montage "$BUILD/cy_front.png" "$BUILD/ee_front.png" "$BUILD/cy_walk_06.png" "$BUILD/ee_walk_06.png" \
    -tile 4x1 -geometry 360x360+2+2 "$IMG/blender_cycles_vs_eevee.png"
fi

stage godot_import godot --headless --path spike/godot --import
stage godot_test godot --headless --path spike/godot --script res://tests/test_character.gd
grep -E '^(PASS|FAIL|RESULT)' "$BUILD/godot_test.log" | sed 's/^/    /' | tee -a "$TIMES"

# shellcheck disable=SC2086
stage godot_capture spike/tools/capture_godot.sh "$CAP" $RENDERERS
grep -E '^\[capture\]' "$BUILD/godot_capture.log" | sed 's/^/    /' | tee -a "$TIMES"

for r in $RENDERERS; do
  convert "$CAP/${r}_still.png" "$IMG/godot_${r}_still.png"
  # 8-frame walk cycle, cropped around the character (the camera follows it, so it stays put)
  montage $(for i in 0 1 2 3 4 5 6 7; do echo "$CAP/${r}_walk_$i.png[280x320+500+220]"; done) \
    -tile 8x1 -geometry +2+2 "$IMG/godot_${r}_walk8.png"
  cp "$CAP/${r}_timing.json" "$IMG/godot_${r}_timing.json"
done
echo "[rebuild] done; images in $IMG ($(du -sh "$IMG" | cut -f1))" | tee -a "$TIMES"
