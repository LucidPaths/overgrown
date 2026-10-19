#!/usr/bin/env bash
# Installs the overgrown toolchain (idempotent). Ubuntu 24.04: the cloud container (root) and GitHub's ubuntu-latest.
#   Godot 4.7.2-stable   official GitHub release asset, SHA-512 checked
#   Blender 4.5.14 LTS   download.blender.org, SHA-256 checked
#   Mesa software rendering (llvmpipe + lavapipe), Xvfb and the runtime libraries, via apt
#
#   tools/godot/setup.sh [--no-blender] [--templates]
#     --no-blender  skip Blender (CI, quick sessions)
#     --templates   also install the matching Godot export templates (GOD-002)
#
# Root installs under /opt and links into /usr/local/bin. A normal user installs under ~/.local/opt
# and links into ~/.local/bin (also appended to $GITHUB_PATH when set) and uses sudo for apt.
# Note: api.github.com and the releases/latest page are blocked by the cloud proxy; direct release-asset URLs work.
set -euo pipefail

GODOT_VER=4.7.2
GODOT_DIR="Godot_v${GODOT_VER}-stable_linux.x86_64"
GODOT_BASE="https://github.com/godotengine/godot/releases/download/${GODOT_VER}-stable"
GODOT_SHA512=9aa00f7a605200940bce3027a567b782f49bd8e940dd06ae9e987bd65aee1b1467edd56ed84fcdcbdd44354bf613bdbb4e5d2913e925850368e150c59ed54c65
TEMPLATES_SHA512=ca4d71c4d7b81dfc15d1a98baa07534aa95b03fdda78a0075b06672e1648d2e5f40980c9adc28d23e1b92e732ee7bf3461997aa804af74ec2fcd7a93ccb84079
TEMPLATES_DIR="${HOME}/.local/share/godot/export_templates/${GODOT_VER}.stable"
BLENDER_SERIES=4.5
BLENDER_VER=4.5.14
BLENDER_SHA256=9ba871ff2ecd36526b77432745980b7e6664ecd0c7ca11c48849073dcfe06da3

WITH_BLENDER=1
WITH_TEMPLATES=0
for arg in "$@"; do
  case "$arg" in
    --no-blender) WITH_BLENDER=0 ;;
    --templates) WITH_TEMPLATES=1 ;;
    *) echo "setup.sh: unknown flag '$arg' (use --no-blender, --templates)" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  PREFIX=/opt
  BIN=/usr/local/bin
else
  SUDO="sudo"
  PREFIX="${HOME}/.local/opt"
  BIN="${HOME}/.local/bin"
fi
mkdir -p "$PREFIX" "$BIN"
if [ -n "${GITHUB_PATH:-}" ]; then echo "$BIN" >> "$GITHUB_PATH"; fi

# --- apt packages (skipped when all are present) ---
PACKAGES=(
  xvfb mesa-vulkan-drivers libvulkan1 libgl1-mesa-dri libegl1 libglx-mesa0
  libxi6 libxkbcommon0 libxrender1 libxxf86vm1 libxfixes3 libsm6 libxrandr2 libxinerama1 libxcursor1
  libfontconfig1 libasound2t64 libpulse0 curl unzip xz-utils
)
missing=0
for p in "${PACKAGES[@]}"; do
  dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || missing=1
done
if [ "$missing" -eq 1 ]; then
  $SUDO apt-get update -qq
  $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${PACKAGES[@]}" >/dev/null
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK" "${STAGE:-}"' EXIT

# --- Godot ---
if [ ! -x "${PREFIX}/godot/${GODOT_DIR}" ]; then
  curl -fsSL -o "$WORK/godot.zip" "${GODOT_BASE}/${GODOT_DIR}.zip"
  echo "${GODOT_SHA512}  $WORK/godot.zip" | sha512sum -c -
  # Atomic: extract aside, then move into place, so the -x check above never sees a partial install.
  mkdir -p "${PREFIX}/godot" "$WORK/godot"
  unzip -qo "$WORK/godot.zip" -d "$WORK/godot"
  chmod +x "$WORK/godot/${GODOT_DIR}"
  mv -f "$WORK/godot/${GODOT_DIR}" "${PREFIX}/godot/${GODOT_DIR}"
fi
ln -sf "${PREFIX}/godot/${GODOT_DIR}" "${BIN}/godot"

# --- Export templates (optional) ---
if [ "$WITH_TEMPLATES" -eq 1 ] && [ ! -f "${TEMPLATES_DIR}/version.txt" ]; then
  curl -fsSL -o "$WORK/templates.tpz" "${GODOT_BASE}/Godot_v${GODOT_VER}-stable_export_templates.tpz"
  echo "${TEMPLATES_SHA512}  $WORK/templates.tpz" | sha512sum -c -
  unzip -qo "$WORK/templates.tpz" -d "$WORK/templates"
  # Atomic: copy to a sibling temp dir, then move into place (version.txt is the "installed" marker).
  mkdir -p "$(dirname "$TEMPLATES_DIR")"
  STAGE="$(mktemp -d "$(dirname "$TEMPLATES_DIR")/.stage.XXXXXX")"
  cp -a "$WORK/templates/templates/." "$STAGE/"
  rm -rf "$TEMPLATES_DIR"
  mv "$STAGE" "$TEMPLATES_DIR"
fi

# --- Blender (optional) ---
if [ "$WITH_BLENDER" -eq 1 ]; then
  if [ ! -x "${PREFIX}/blender-${BLENDER_VER}-linux-x64/blender" ]; then
    curl -fsSL -o "$WORK/blender.tar.xz" "https://download.blender.org/release/Blender${BLENDER_SERIES}/blender-${BLENDER_VER}-linux-x64.tar.xz"
    echo "${BLENDER_SHA256}  $WORK/blender.tar.xz" | sha256sum -c -
    # Atomic: extract into a temp dir under $PREFIX (same filesystem), then move into place.
    STAGE="$(mktemp -d "${PREFIX}/.blender-stage.XXXXXX")"
    tar -xJf "$WORK/blender.tar.xz" -C "$STAGE"
    rm -rf "${PREFIX}/blender-${BLENDER_VER}-linux-x64"
    mv "$STAGE/blender-${BLENDER_VER}-linux-x64" "${PREFIX}/blender-${BLENDER_VER}-linux-x64"
    rmdir "$STAGE"
  fi
  ln -sfn "${PREFIX}/blender-${BLENDER_VER}-linux-x64" "${PREFIX}/blender"
  ln -sf "${PREFIX}/blender/blender" "${BIN}/blender"
fi

# --- Report ---
echo "godot:   $("${BIN}/godot" --version)"
if [ "$WITH_BLENDER" -eq 1 ]; then echo "blender: $("${BIN}/blender" --background --version | head -1)"; fi
if [ "$WITH_TEMPLATES" -eq 1 ]; then echo "templates: ${TEMPLATES_DIR}"; fi
