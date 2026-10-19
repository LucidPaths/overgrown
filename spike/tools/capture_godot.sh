#!/usr/bin/env bash
# Captures the spike scene with each Godot renderer under Xvfb (software: lavapipe / llvmpipe).
#   spike/tools/capture_godot.sh [out_dir] [renderer ...]
# renderers: forward_plus mobile gl_compatibility (default: all three)
# Writes <out>/<renderer>_{still,walk_0..7}.png, _timing.json, .log. Exit 1 if any renderer failed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/spike/build/cap}"
shift || true
RENDERERS=("$@")
[ ${#RENDERERS[@]} -eq 0 ] && RENDERERS=(forward_plus mobile gl_compatibility)
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

fail=0
for r in "${RENDERERS[@]}"; do
  case "$r" in
    forward_plus) drv=vulkan ;;
    mobile) drv=vulkan ;;
    gl_compatibility) drv=opengl3 ;;
    *) echo "unknown renderer $r"; exit 2 ;;
  esac
  rm -f "$OUT/${r}"_*.png "$OUT/${r}_timing.json"
  t0=$(date +%s.%N)
  timeout 600 xvfb-run -a -s '-screen 0 1280x720x24' \
    godot --audio-driver Dummy --path "$ROOT/spike/godot" --rendering-method "$r" --rendering-driver "$drv" \
    -- --capture "$OUT/$r" --tag "$r" >"$OUT/$r.log" 2>&1
  code=$?
  t1=$(date +%s.%N)
  if [ $code -eq 0 ] && [ -f "$OUT/${r}_timing.json" ]; then
    printf '[capture] %-17s ok   %6.1fs  %s\n' "$r" "$(echo "$t1 - $t0" | bc)" \
      "$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(f\"{d['rendering_driver']} on {d['adapter']}: median frame {d['frame_ms_median']:.0f} ms ({d['fps_median']:.1f} fps), first frame {d['first_frame_ms']:.0f} ms\")" "$OUT/${r}_timing.json")"
  else
    fail=1
    printf '[capture] %-17s FAIL exit=%s (see %s)\n' "$r" "$code" "$OUT/$r.log"
    grep -E 'ERROR|error|Error' "$OUT/$r.log" | head -5
  fi
done
exit $fail
