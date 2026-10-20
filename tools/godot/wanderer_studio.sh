#!/usr/bin/env bash
# Renders the wanderer (ART-028) in a studio scene under Xvfb (software rendering): turnarounds, contact sheets,
# close-ups and single frames, with the game's shader and the main scene's light.
#   tools/godot/wanderer_studio.sh turnaround|sheet|closeup OUT.png
#   tools/godot/wanderer_studio.sh frame OUT.png CLIP PROGRESS [AZIMUTH_DEG]
# Run tools/godot/test.sh once first after script changes (a studio run does not import).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
timeout 300 xvfb-run -a -s "-screen 0 1280x720x24" \
  godot --path "$ROOT/game" --audio-driver Dummy --rendering-method forward_plus \
  --script "$ROOT/tools/godot/wanderer_studio.gd" -- "$@"
