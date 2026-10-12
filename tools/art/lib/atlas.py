"""Atlas packing and writing. The JSON is TexturePacker "JSON Hash", which PixiJS loads natively."""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

FRAME_NAME = re.compile(r"[a-z0-9_]+/[a-z0-9_/]+")  # matched with fullmatch
MIN_SIZE = 64


@dataclass(frozen=True)
class Frame:
    name: str
    image: Image.Image

    def __post_init__(self) -> None:
        if not FRAME_NAME.fullmatch(self.name):
            raise ValueError(f"frame name {self.name!r} must match {FRAME_NAME.pattern}")
        if self.image.mode != "RGBA":
            raise ValueError(f"frame {self.name!r} must be RGBA, got mode {self.image.mode!r}")


@dataclass(frozen=True)
class Placement:
    name: str
    x: int
    y: int
    w: int
    h: int


def _shelf_pack(frames: list[Frame], size: int, padding: int) -> list[Placement] | None:
    """Place frames (already sorted) on shelves in a size x size square; None if they don't fit."""
    placements = []
    x = y = shelf_h = 0
    for f in frames:
        w, h = f.image.size
        if x > 0 and x + w > size:
            x = 0
            y += shelf_h + padding
            shelf_h = 0
        if x + w > size or y + h > size:
            return None
        placements.append(Placement(f.name, x, y, w, h))
        x += w + padding
        shelf_h = max(shelf_h, h)
    return placements


def pack(
    frames: list[Frame], padding: int = 1, max_size: int = 2048
) -> tuple[int, list[Placement]]:
    """Deterministic shelf packing into the smallest power-of-two square in MIN_SIZE..max_size."""
    ordered = sorted(frames, key=lambda f: (-f.image.height, -f.image.width, f.name))
    size = MIN_SIZE
    while size <= max_size:
        placements = _shelf_pack(ordered, size, padding)
        if placements is not None:
            return size, placements
        size *= 2
    area = sum(f.image.width * f.image.height for f in frames)
    largest = max(frames, key=lambda f: (f.image.width * f.image.height, f.name))
    raise ValueError(
        f"{len(frames)} frames do not fit in {max_size}x{max_size}: total area {area} px, "
        f"largest frame {largest.name!r} {largest.image.width}x{largest.image.height}"
    )


def write_atlas(out_dir: Path, atlas: str, frames: list[Frame]) -> int:
    """Pack frames and write <atlas>.png + <atlas>.json into out_dir. Returns the atlas side length."""
    size, placements = pack(frames)
    images = {f.name: f.image for f in frames}
    sheet = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    entries = {}
    for p in placements:
        sheet.paste(images[p.name], (p.x, p.y))
        entries[p.name] = {
            "frame": {"x": p.x, "y": p.y, "w": p.w, "h": p.h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": p.w, "h": p.h},
            "sourceSize": {"w": p.w, "h": p.h},
        }
    image_name = f"{atlas}.png"
    meta = {
        "app": "overgrown-art",
        "version": "1",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": size, "h": size},
        "scale": "1",
    }
    # Pillow writes no timestamp or other metadata by default; keep it that way.
    sheet.save(out_dir / image_name, format="PNG", compress_level=9)
    text = json.dumps({"frames": entries, "meta": meta}, sort_keys=True, indent=1) + "\n"
    (out_dir / f"{atlas}.json").write_text(text, encoding="utf-8")
    return size
