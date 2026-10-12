"""Ground tile frames against contracts/tile-frames.json (the TS lookup is checked against the same file)."""

import json
from pathlib import Path

import numpy as np
import pytest

from gen import tiles
from lib.context import Context

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts" / "tile-frames.json").read_text("utf-8")
)


def _expected_names() -> set[str]:
    names = set()
    for p in FIXTURE["palettes"]:
        for t in FIXTURE["terrains"]:
            masks = [15] if t == FIXTURE["precedence"][0] else range(1, 16)
            for m in masks:
                n = FIXTURE["full_variants"] if m == 15 else FIXTURE["edge_variants"]
                names.update(f"tile/{p}/{t}/{m}/{v}" for v in range(n))
    return names


@pytest.fixture(scope="module")
def frames():
    return tiles.generate(Context(1, "tile"))


def test_tile_frames_match_contract(frames):
    names = [f.name for f in frames]
    assert len(names) == len(set(names))
    assert set(names) == _expected_names()
    for f in frames:
        assert f.image.size == (16, 16) and f.image.mode == "RGBA", f.name
        if f.name.split("/")[3] == "15":
            assert (np.array(f.image)[..., 3] == 255).all(), f"{f.name} has holes"


def test_tile_edges_follow_corner_rule(frames):
    """Outer-ring opacity depends only on the two corners of that edge, so neighbouring cells meet."""
    face_h = tiles.FACE_H
    for f in frames:
        _, _, terrain, mask_s, _ = f.name.split("/")
        mask = int(mask_s)
        if mask == 15:
            continue
        tl, tr, bl, br = (bool(mask >> i & 1) for i in range(4))
        opaque = np.array(f.image)[..., 3] == 255  # [y, x]
        want = np.zeros((16, 16), bool)
        want[0:8, 0], want[8:16, 0] = tl, bl
        want[0:8, 15], want[8:16, 15] = tr, br
        want[0, 0:8], want[0, 8:16] = tl, tr
        want[15, 0:8], want[15, 8:16] = bl, br
        if terrain == "cliff":  # the south-facing face hangs below the covered half of a side edge
            if tl and not bl:
                want[8 : 8 + face_h, 0] = True
            if tr and not br:
                want[8 : 8 + face_h, 15] = True
        ring = np.ones((16, 16), bool)
        ring[1:15, 1:15] = False
        assert (opaque[ring] == want[ring]).all(), f.name
