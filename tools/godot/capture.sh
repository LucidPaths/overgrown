#!/usr/bin/env bash
# Renders the main scene under Xvfb (software: lavapipe / llvmpipe) and saves a PNG.
#   tools/godot/capture.sh <out.png> [forward_plus|gl_compatibility]
# Exit 0 when the PNG exists; non-zero on a Godot failure, the 120 s timeout or a missing PNG.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:?usage: capture.sh <out.png> [forward_plus|gl_compatibility]}"
RENDERER="${2:-forward_plus}"
case "$RENDERER" in
  forward_plus | gl_compatibility) ;;
  *) echo "capture.sh: unknown renderer '$RENDERER' (forward_plus or gl_compatibility)" >&2; exit 2 ;;
esac
OUT="$(mkdir -p "$(dirname "$OUT")" && cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
rm -f "$OUT"

timeout 120 xvfb-run -a -s "-screen 0 1280x720x24" \
  godot --path "$ROOT/game" --audio-driver Dummy --rendering-method "$RENDERER" -- --capture "$OUT"
code=$?
if [ "$code" -ne 0 ]; then
  echo "capture.sh: godot exited with $code" >&2
  exit "$code"
fi
if [ ! -f "$OUT" ]; then
  echo "capture.sh: $OUT was not written" >&2
  exit 1
fi
echo "capture: $OUT"
