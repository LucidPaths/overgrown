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


@pytest.mark.parametrize(
    ("key", "field", "role", "letter"),
    [("rabbitfolk", "extra_ramp", "extra", "H"), ("human", "hair_ramp", "hair", "[a-e]")],
)
def test_template_letter_for_a_missing_ramp_fails_instead_of_painting_body_colour(
    key, field, role, letter
):
    """A species row without the ramp its template draws with must not silently paint in body colour."""
    species = next(sp for sp in SPECIES if sp.key == key)
    broken = dataclasses.replace(species, **{field: None})
    skel = base_skeleton(broken, "down")
    message = (
        rf"{key}/front: template uses '{letter}' \({role} ramp\) but the species has no {role}_ramp"
    )
    with pytest.raises(ValueError, match=message):
        actor.draw_body(Context(1, "actor"), broken, skel, "down")


def test_feathered_species_without_talon_ramp_is_rejected():
    bird = next(sp for sp in SPECIES if sp.covering == "feathers")
    with pytest.raises(ValueError, match=rf"{bird.key}: extra_ramp .* required .* 'feathers'"):
        dataclasses.replace(bird, extra_ramp=None)


def test_painting_a_role_the_sheet_lacks_names_the_species_and_role():
    sheet = actor.Sheet([[(1, 2, 3, 255)] * 6], {"body": 0}, "testfolk")
    with pytest.raises(
        ValueError, match="testfolk: painting needs the extra ramp .* no extra_ramp"
    ):
        sheet.paint(np.ones((32, 32), bool), "extra", 3)
