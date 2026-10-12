"""Atlas packing, naming rules and build determinism."""

import subprocess
import sys
from itertools import combinations
from pathlib import Path
from types import ModuleType

import pytest
from PIL import Image

from build import collect
from lib.atlas import Frame, pack
from lib.rng import Rng

BUILD = Path(__file__).resolve().parents[1] / "build.py"


def _frame(name: str, w: int, h: int) -> Frame:
    return Frame(name, Image.new("RGBA", (w, h)))


def _generator(module_name: str, name: str, frame_names: list[str]) -> ModuleType:
    gen = ModuleType(module_name)
    gen.NAME = name
    gen.ATLAS = "core"
    gen.generate = lambda ctx: [_frame(n, 4, 4) for n in frame_names]
    return gen


def test_pack_no_overlap_and_in_bounds():
    rng = Rng(7)
    frames = [_frame(f"t/f{i}", rng.int(1, 80), rng.int(1, 80)) for i in range(40)]
    size, placements = pack(frames, padding=1)
    assert size in (64, 128, 256, 512, 1024, 2048)
    assert sorted(p.name for p in placements) == sorted(f.name for f in frames)
    for p in placements:
        assert 0 <= p.x and 0 <= p.y and p.x + p.w <= size and p.y + p.h <= size, p
    for a, b in combinations(placements, 2):
        apart = (
            a.x + a.w + 1 <= b.x
            or b.x + b.w + 1 <= a.x
            or a.y + a.h + 1 <= b.y
            or b.y + b.h + 1 <= a.y
        )
        assert apart, (a, b)


def test_duplicate_generator_names_both_modules():
    first = _generator("gen.first", "shared", ["shared/a"])
    second = _generator("gen.second", "shared", ["shared/b"])
    with pytest.raises(ValueError, match=r"generator NAME 'shared' in gen\.first and gen\.second"):
        collect([first, second], 1)


def test_invalid_generator_name_raises():
    # NAME "a/b" could emit "a/b/c", which NAME "a" could also emit.
    bad = _generator("gen.bad", "a/b", ["a/b/c"])
    with pytest.raises(ValueError, match=r"generator gen\.bad: NAME 'a/b' must match"):
        collect([bad], 1)


def test_duplicate_frame_name_raises():
    # Unique NAMEs + the NAME/ prefix rule leave one generator repeating a name as the only clash.
    solo = _generator("gen.solo", "solo", ["solo/a", "solo/a"])
    with pytest.raises(ValueError, match=r"duplicate frame 'solo/a' from generators gen\.solo"):
        collect([solo], 1)


def test_oversize_raises():
    frames = [_frame("t/small", 30, 30), _frame("t/big", 40, 40)]
    with pytest.raises(ValueError, match=r"total area 2500 px.*'t/big' 40x40"):
        pack(frames, max_size=64)


def test_build_is_byte_identical(tmp_path):
    outs = [tmp_path / "a", tmp_path / "b"]
    for out in outs:
        subprocess.run([sys.executable, str(BUILD), "--out", str(out)], check=True)
    for name in ("core.png", "core.json"):
        assert (outs[0] / name).read_bytes() == (outs[1] / name).read_bytes(), name
