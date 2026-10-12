"""Actor body generator: the frame-name contract, mirrored handedness and the cell check."""

import dataclasses
import itertools
import json
from pathlib import Path

import numpy as np
import pytest

from gen import actor
from lib.anims import hand_anchor
from lib.context import Context
from lib.skeleton import SOLE_Y, Point, base_skeleton
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
    big = dataclasses.replace(human, torso=13)  # the head would poke out of the top of the cell
    skel = base_skeleton(big, "down")
    with pytest.raises(ValueError, match="off the cell|outer ring"):
        actor.draw_body(Context(1, "actor"), big, skel, "down")


def test_every_frame_fits_the_cell_and_stands_on_the_sole_line(frames):
    for name, img in frames.items():
        opaque = img[..., 3] == 255
        assert not (
            opaque[0].any() or opaque[-1].any() or opaque[:, 0].any() or opaque[:, -1].any()
        ), name
        lowest = int(np.nonzero(opaque.any(axis=1))[0].max())
        assert lowest == SOLE_Y + 1, f"{name}: lowest row {lowest}"


def test_actors_use_only_actor_palette_colours(frames):
    pal = Context(1, "actor").palette("actors")
    allowed = {c for name in pal._ramps for c in pal.ramp(name)} | set(pal._colors.values())
    for name, img in frames.items():
        colours = {tuple(int(v) for v in px) for px in img[img[..., 3] == 255]}
        assert colours <= allowed, f"{name}: {sorted(colours - allowed)[:3]}"


def test_idle_silhouettes_are_distinct_per_species(frames):
    """Species are told apart by shape alone (docs/art/DIRECTION.md section 6): every pair differs in many pixels."""
    masks = {
        sp.key: frames[actor.frame_name(sp.key, "idle", "down", 0)][..., 3] == 255 for sp in SPECIES
    }
    for a, b in itertools.combinations(masks, 2):
        differing = int((masks[a] ^ masks[b]).sum())
        assert differing >= 40, f"{a} and {b} differ in only {differing} px"


def test_silhouettes_have_no_orphan_pixels(frames):
    """A one-pixel island is noise (docs/art/DIRECTION.md section 9): every opaque pixel touches another."""
    for name, img in frames.items():
        opaque = img[..., 3] == 255
        padded = np.pad(opaque, 1)
        neighbours = sum(
            padded[1 + dy : 33 + dy, 1 + dx : 33 + dx].astype(int)
            for dy, dx in itertools.product((-1, 0, 1), repeat=2)
            if (dy, dx) != (0, 0)
        )
        assert not (opaque & (neighbours == 0)).any(), name
