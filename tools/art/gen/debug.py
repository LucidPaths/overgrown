"""Placeholder frames that exercise the pipeline end to end, until real tiles and actors replace them.

First consumer of lib.draw: if a primitive is wrong, these frames show it.
"""

from PIL import Image

from lib import draw
from lib.atlas import Frame
from lib.context import Context

NAME = "debug"
ATLAS = "core"


def _character32(ctx: Context) -> Image.Image:
    """An upright figure whose feet reach the bottom row in the centre columns (anchor = feet point)."""
    ramp = ctx.palette("pop").ramp("frost")
    darkest, shade, lit = ramp[0], ramp[1], ramp[2]
    img = draw.canvas(32, 32)
    # Lit from the top left, like shade_sphere: left halves use the lighter shade.
    draw.rect(img, 7, 14, 3, 8, lit)  # left arm
    draw.rect(img, 22, 14, 3, 8, shade)  # right arm
    draw.rect(img, 10, 13, 6, 10, lit)  # torso, left half
    draw.rect(img, 16, 13, 6, 10, shade)  # torso, right half
    draw.rect(img, 11, 23, 5, 2, lit)  # hips
    draw.rect(img, 16, 23, 5, 2, shade)
    # Legs down to row 31; the outline fills the 2 px gap, so the centre columns are opaque there too.
    draw.rect(img, 11, 25, 4, 7, lit)
    draw.rect(img, 17, 25, 4, 7, shade)
    draw.shade_sphere(img, draw.ellipse_mask(32, 32, 16, 8, 5, 5), ramp)  # head
    draw.rect(img, 14, 8, 1, 2, darkest)  # eyes: the placeholder faces the viewer
    draw.rect(img, 17, 8, 1, 2, darkest)
    draw.outline(img, darkest)
    return draw.to_image(img)


def generate(ctx: Context) -> list[Frame]:
    return [
        Frame(f"{NAME}/character32", _character32(ctx)),
    ]
