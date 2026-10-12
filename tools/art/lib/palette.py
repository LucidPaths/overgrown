"""Named, validated palettes loaded from tools/art/palettes/<name>.json.

Format (see docs/specs/ART-002.md): {"name", "ramps": {ramp: [hex, ...]}, "colors": {color: hex}}.
Ramps run dark -> light by WCAG relative luminance, so index 0 is always the shadow shade.
Every rule is checked on load; errors name the file and the key.
"""

import json
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

Rgba = tuple[int, int, int, int]

PALETTE_DIR = Path(__file__).resolve().parents[1] / "palettes"
KEY = re.compile(r"[a-z0-9_]+")
HEX = re.compile(r"#[0-9a-f]{6}")
RAMP_MIN, RAMP_MAX = 2, 8
TOP_LEVEL_KEYS = {"name", "ramps", "colors"}


@dataclass(frozen=True)
class Palette:
    name: str
    _ramps: dict[str, tuple[Rgba, ...]]
    _colors: dict[str, Rgba]

    def ramp(self, name: str) -> list[Rgba]:
        """Shades of one ramp, darkest first."""
        if name not in self._ramps:
            raise KeyError(f"palette {self.name!r} has no ramp {name!r}; has {sorted(self._ramps)}")
        return list(self._ramps[name])

    def color(self, name: str) -> Rgba:
        if name not in self._colors:
            raise KeyError(
                f"palette {self.name!r} has no color {name!r}; has {sorted(self._colors)}"
            )
        return self._colors[name]


def _rgba(hex_color: str) -> Rgba:
    return (int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16), 255)


def _luminance(c: Rgba) -> float:
    """WCAG 2.x relative luminance of an sRGB colour."""

    def lin(v: int) -> float:
        s = v / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])


def _hex(path: Path, where: str, value: object) -> Rgba:
    if not isinstance(value, str) or not HEX.fullmatch(value):
        raise ValueError(f"{path.name}: {where}: {value!r} is not a lowercase #rrggbb hex color")
    return _rgba(value)


def _key(path: Path, section: str, key: str) -> None:
    if not KEY.fullmatch(key):
        raise ValueError(f"{path.name}: {section}.{key}: key must match {KEY.pattern}")


def _section(path: Path, data: dict, section: str, required: bool) -> dict:
    value = data.get(section, None if required else {})
    if not isinstance(value, dict):
        raise TypeError(f"{path.name}: {section}: must be an object")
    return value


def _no_duplicates(path: Path):
    def hook(pairs: list[tuple[str, object]]) -> dict:
        seen: set[str] = set()
        for key, _ in pairs:
            if key in seen:
                raise ValueError(f"{path.name}: {key}: duplicate key")
            seen.add(key)
        return dict(pairs)

    return hook


def load_file(path: Path) -> Palette:
    """Parse and fully validate one palette file."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_no_duplicates(path))
    except (OSError, json.JSONDecodeError) as e:
        raise ValueError(f"{path.name}: cannot read palette: {e}") from e
    if not isinstance(data, dict):
        raise TypeError(f"{path.name}: top level must be an object")
    for key in sorted(set(data) - TOP_LEVEL_KEYS):
        raise ValueError(
            f"{path.name}: {key}: unknown top-level key (allowed: name, ramps, colors)"
        )
    if data.get("name") != path.stem:
        raise ValueError(
            f"{path.name}: name: {data.get('name')!r} must equal file stem {path.stem!r}"
        )
    if "ramps" not in data:
        raise ValueError(f"{path.name}: ramps: missing")

    ramps: dict[str, tuple[Rgba, ...]] = {}
    for rname, shades in _section(path, data, "ramps", True).items():
        _key(path, "ramps", rname)
        if not isinstance(shades, list) or not RAMP_MIN <= len(shades) <= RAMP_MAX:
            n = len(shades) if isinstance(shades, list) else shades
            raise ValueError(
                f"{path.name}: ramps.{rname}: needs {RAMP_MIN}-{RAMP_MAX} colors in a list, got {n!r}"
            )
        parsed = [_hex(path, f"ramps.{rname}[{i}]", s) for i, s in enumerate(shades)]
        for i in range(1, len(parsed)):
            if _luminance(parsed[i]) <= _luminance(parsed[i - 1]):
                raise ValueError(
                    f"{path.name}: ramps.{rname}[{i}]: {shades[i]} is not lighter than "
                    f"{shades[i - 1]}; ramps must run dark to light (strictly rising luminance)"
                )
        ramps[rname] = tuple(parsed)

    colors: dict[str, Rgba] = {}
    for cname, value in _section(path, data, "colors", False).items():
        _key(path, "colors", cname)
        colors[cname] = _hex(path, f"colors.{cname}", value)
    return Palette(path.stem, ramps, colors)


@cache
def load_palette(name: str) -> Palette:
    """Load palettes/<name>.json (cached; palettes are immutable)."""
    return load_file(PALETTE_DIR / f"{name}.json")


def load_all() -> dict[str, Palette]:
    """Load and validate every shipped palette, so a broken file fails even if nothing uses it."""
    return {p.stem: load_palette(p.stem) for p in sorted(PALETTE_DIR.glob("*.json"))}
