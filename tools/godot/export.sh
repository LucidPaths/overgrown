#!/usr/bin/env bash
# Exports the Windows and Linux release builds into game/export/ (GOD-002).
#   tools/godot/export.sh
# Installs the Godot export templates if they are missing, stamps game/build_info.gd with the commit and
# time, runs both export presets and prints the sizes. Exits non-zero if an export fails or an output is
# missing or empty. The stamp is put back to the committed "dev" default on exit, so the tree stays clean.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GAME="$ROOT/game"
TEMPLATES_MARKER="${HOME}/.local/share/godot/export_templates/4.7.2.stable/version.txt"
# preset name | output path under game/
BUILDS=(
  "Windows Desktop|export/windows/overgrown-windows.exe"
  "Linux|export/linux/overgrown-linux.x86_64"
)

# write_stamp <commit> <built-utc>: the one place that knows the build_info.gd format.
write_stamp() {
  cat > "$GAME/build_info.gd" <<STAMP
class_name BuildInfo
extends RefCounted
## Stamped by tools/godot/export.sh. The committed file is the local "dev" default.

const COMMIT := "$1"
const BUILT_UTC := "$2"
STAMP
}

if [ ! -f "$TEMPLATES_MARKER" ]; then
  bash "$ROOT/tools/godot/setup.sh" --no-blender --templates
fi

trap 'write_stamp dev unbuilt' EXIT
write_stamp "$(git -C "$ROOT" rev-parse --short=8 HEAD)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# A fresh checkout needs an import pass (class names, resources) before an export.
godot --headless --path "$GAME" --import

for build in "${BUILDS[@]}"; do
  preset="${build%%|*}"
  out="${build#*|}"
  rm -f "$GAME/$out"
  mkdir -p "$GAME/$(dirname "$out")"
  godot --headless --path "$GAME" --export-release "$preset" "$out"
  if [ ! -s "$GAME/$out" ]; then
    echo "export.sh: $preset export did not produce a non-empty $GAME/$out" >&2
    exit 1
  fi
done

for build in "${BUILDS[@]}"; do
  out="${build#*|}"
  echo "export: $GAME/$out ($(du -h "$GAME/$out" | cut -f1))"
done
