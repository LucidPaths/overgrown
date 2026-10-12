"""Drawing primitives: exact geometry, exact dithering, palette-only shading, binary alpha."""

import numpy as np
import pytest

from lib import draw
from lib.palette import load_palette

RED = (255, 0, 0, 255)
BLUE = (0, 0, 255, 255)


def _opaque(img: np.ndarray) -> set[tuple[int, int]]:
    ys, xs = np.nonzero(img[..., 3] == 255)
    return {(int(x), int(y)) for x, y in zip(xs, ys, strict=True)}


def test_outline_of_single_pixel_is_4_or_8_neighbours():
    for diagonal, expected in ((False, 4), (True, 8)):
        img = draw.canvas(5, 5)
        draw.rect(img, 2, 2, 1, 1, RED)
        draw.outline(img, BLUE, diagonal=diagonal)
        ring = {p for p in _opaque(img) if tuple(img[p[1], p[0]]) == BLUE}
        assert len(ring) == expected
        assert tuple(img[2, 2]) == RED  # the source pixel is untouched
        assert len(_opaque(img)) == expected + 1  # computed from the pre-outline image


def test_even_ellipse_is_mirror_symmetric():
    mask = draw.ellipse_mask(16, 16, 8, 8, 6, 4)
    assert mask.any() and not mask.all()
    assert (mask == mask[:, ::-1]).all()
    assert (mask == mask[::-1, :]).all()


def test_line_hits_exactly_the_bresenham_pixels():
    img = draw.canvas(6, 4)
    draw.line(img, 0, 0, 4, 2, RED)
    # Hand-derived: the ties at x=1 and x=3 round toward the end point.
    assert _opaque(img) == {(0, 0), (1, 1), (2, 1), (3, 2), (4, 2)}


def test_dither_levels():
    mask = np.ones((4, 4), bool)
    counts = {}
    for level in (0, 0.5, 1):
        img = draw.canvas(4, 4)
        draw.dither(img, mask, RED, BLUE, level)
        flat = [tuple(px) for px in img.reshape(-1, 4)]
        counts[level] = (flat.count(RED), flat.count(BLUE))
    assert counts == {0: (16, 0), 0.5: (8, 8), 1: (0, 16)}


def test_shade_sphere_stays_in_ramp_and_is_lit_from_top_left():
    ramp = load_palette("pop").ramp("fire")
    img = draw.canvas(32, 32)
    draw.shade_sphere(img, draw.ellipse_mask(32, 32, 16, 16, 12, 12), ramp)
    assert {tuple(int(v) for v in px) for px in img[img[..., 3] == 255]} <= set(ramp)

    def mean_lum(quadrant: np.ndarray) -> float:
        px = quadrant[quadrant[..., 3] == 255][:, :3].astype(float)
        return float((px @ [0.2126, 0.7152, 0.0722]).mean())

    assert mean_lum(img[:16, :16]) > mean_lum(img[16:, 16:])


def test_to_image_rejects_non_binary_alpha():
    img = draw.canvas(2, 2)
    img[0, 0] = (10, 20, 30, 128)
    with pytest.raises(ValueError, match="non-binary alpha"):
        draw.to_image(img)


def test_out_of_bounds_drawing_is_clipped_and_bad_coords_are_rejected():
    img = draw.canvas(4, 4)
    draw.rect(img, -2, -3, 4, 5, RED)  # overlaps columns 0-1, rows 0-1
    assert len(_opaque(img)) == 4
    img = draw.canvas(4, 4)
    draw.rect(img, 3, 3, 9, 9, RED)
    assert _opaque(img) == {(3, 3)}

    img = draw.canvas(4, 4)
    draw.line(img, -3, 1, 6, 1, RED)  # crosses the whole row, ends outside both sides
    assert _opaque(img) == {(0, 1), (1, 1), (2, 1), (3, 1)}

    src = draw.canvas(3, 3)
    draw.rect(src, 0, 0, 3, 3, BLUE)
    img = draw.canvas(4, 4)
    draw.paste(img, src, -1, -1)  # only the 2x2 corner of src lands
    assert _opaque(img) == {(0, 0), (1, 0), (0, 1), (1, 1)}
    draw.paste(img, src, 3, 3)  # only src's top-left pixel lands
    assert (3, 3) in _opaque(img) and len(_opaque(img)) == 5

    for bad in (3.5, float("nan"), True):
        with pytest.raises(ValueError, match="x1"):
            draw.line(img, 0, 0, bad, 3, RED)
    with pytest.raises(ValueError, match="x1"):
        draw.line(img, 0, 0, 10**9, 3, RED)
    with pytest.raises(ValueError, match="x"):
        draw.rect(img, 1.5, 0, 1, 1, RED)

    # numpy integers (from np.nonzero bounds, pixel reads) are ints; negative sizes are errors
    img = draw.canvas(4, 4)
    draw.rect(
        img, np.int64(1), np.int64(1), np.int64(2), np.int64(1), tuple(np.uint8([9, 8, 7, 255]))
    )
    assert _opaque(img) == {(1, 1), (2, 1)} and tuple(img[1, 1]) == (9, 8, 7, 255)
    draw.rect(img, 0, 0, 0, 3, RED)  # zero size stays a legal no-op
    assert len(_opaque(img)) == 2
    for w, h, name in ((-1, 2, "w"), (2, -1, "h")):
        with pytest.raises(ValueError, match=f"{name}="):
            draw.rect(img, 0, 0, w, h, RED)
