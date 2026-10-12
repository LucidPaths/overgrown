"""Actor body generator: the frame-name contract, mirrored handedness and the cell check."""

import dataclasses
import json
from pathlib import Path

import numpy as np
import pytest

from gen import actor
from lib.anims import hand_anchor
from lib.context import Context
from lib.skeleton import Point, base_skeleton
from lib.species import SPECIES

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts" / "actor-anims.json").read_text("utf-8")
)


@pytest.fixture(scope="module")
def frames() -> dict[str, np.ndarray]:
    return {f.name: np.array(f.image) for f in actor.generate(Context(1, "actor"))}


def test_actor_frames_match_contract(frames):
    want = {
        f"actor/{s}/{a}/{d}/{i}"
        for s in CONTRACT["species"]
        for d in CONTRACT["dirs"]
        for a, n in CONTRACT["frames"].items()
        for i in range(n)
    }
    assert set(frames) == want
    for name, img in frames.items():
        assert img.shape == (32, 32, 4), name


def test_right_mirrors_left_with_sides_swapped(frames):
    for sp in SPECIES:
        for anim, count in CONTRACT["frames"].items():
            for i in range(count):
                where = f"{sp.key}/{anim}/{i}"
                left_img = frames[actor.frame_name(sp.key, anim, "left", i)]
                right_img = frames[actor.frame_name(sp.key, anim, "right", i)]
                assert np.array_equal(right_img, np.fliplr(left_img)), where
                left = hand_anchor(sp, anim, "left", i)
                assert hand_anchor(sp, anim, "right", i) == Point(31 - left.x, left.y), where

        left, right = base_skeleton(sp, "left"), base_skeleton(sp, "right")
        assert right["hand_r"] == Point(31 - left["hand_l"].x, left["hand_l"].y), sp.key
        assert right.near == "r", sp.key

        down, up = base_skeleton(sp, "down"), base_skeleton(sp, "up")
        assert down["hand_r"].x < down["hand_l"].x, sp.key
        assert up["hand_r"].x > up["hand_l"].x, sp.key


def test_oversized_species_fails_cell_check():
    human = next(sp for sp in SPECIES if sp.key == "human")
    big = dataclasses.replace(human, head_h=16)
    skel = base_skeleton(big, "down")
    with pytest.raises(ValueError, match="human"):
        actor.draw_body(Context(1, "actor"), big, skel, "down")
