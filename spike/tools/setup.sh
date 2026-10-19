#!/usr/bin/env bash
# Installs the spike toolchain under /opt (idempotent). Ubuntu 24.04, run as root.
#   Godot 4.7.2-stable (official GitHub release, SHA-512 checked)
#   Blender 4.5.14 LTS (download.blender.org, SHA-256 checked)
#   Mesa software rendering: llvmpipe (OpenGL 4.5) + lavapipe (Vulkan 1.4), Xvfb
set -euo pipefail

GODOT_VER=4.7.2
BLENDER_SERIES=4.5
BLENDER_VER=4.5.14
GODOT_SHA512=9aa00f7a605200940bce3027a567b782f49bd8e940dd06ae9e987bd65aee1b1467edd56ed84fcdcbdd44354bf613bdbb4e5d2913e925850368e150c59ed54c65
BLENDER_SHA256=9ba871ff2ecd36526b77432745980b7e6664ecd0c7ca11c48849073dcfe06da3

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  xvfb mesa-vulkan-drivers libvulkan1 vulkan-tools mesa-utils libgl1-mesa-dri libegl1 libglx-mesa0 \
  libxi6 libxkbcommon0 libxrender1 libxxf86vm1 libxfixes3 libsm6 libxrandr2 libxinerama1 libxcursor1 \
  libfontconfig1 libasound2t64 libpulse0 unzip imagemagick >/dev/null

mkdir -p /opt/dl
cd /opt/dl

if [ ! -x "/opt/godot/Godot_v${GODOT_VER}-stable_linux.x86_64" ]; then
  # Note: api.github.com and the releases/latest page are blocked by the cloud proxy;
  # direct release-asset URLs work.
  curl -sSL -o godot.zip "https://github.com/godotengine/godot/releases/download/${GODOT_VER}-stable/Godot_v${GODOT_VER}-stable_linux.x86_64.zip"
  echo "${GODOT_SHA512}  godot.zip" | sha512sum -c -
  mkdir -p /opt/godot && unzip -qo godot.zip -d /opt/godot
fi
ln -sf "/opt/godot/Godot_v${GODOT_VER}-stable_linux.x86_64" /usr/local/bin/godot

if [ ! -x "/opt/blender-${BLENDER_VER}-linux-x64/blender" ]; then
  curl -sSL -o blender.tar.xz "https://download.blender.org/release/Blender${BLENDER_SERIES}/blender-${BLENDER_VER}-linux-x64.tar.xz"
  echo "${BLENDER_SHA256}  blender.tar.xz" | sha256sum -c -
  tar -xJf blender.tar.xz -C /opt
fi
ln -sfn "/opt/blender-${BLENDER_VER}-linux-x64" /opt/blender
ln -sf /opt/blender/blender /usr/local/bin/blender

godot --version
blender --background --version | head -1
