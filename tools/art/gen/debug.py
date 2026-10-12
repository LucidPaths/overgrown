"""Placeholder frames that exercise the pipeline end to end, RNG path included.

First consumer of lib.draw: if a primitive is wrong, these frames show it.
"""

from PIL import Image

from lib import draw
from lib.atlas import Frame
from lib.context import Context

NAME = "debug"
ATLAS = "core"

ELEMENT_RAMPS = ("fire", "frost", "stone", "storm", "life", "shadow")


def _checker16(ctx: Context) -> Image.Image:
    grass = ctx.palette("meadow").ramp("grass")
    dark, light = grass[0], grass[-1]
    img = draw.canvas(16, 16)
    for by in range(4):
        for bx in range(4):
            draw.rect(img, bx * 4, by * 4, 4, 4, light if (bx + by) % 2 == 0 else dark)
    return draw.to_image(img)


def _mover32(ctx: Context) -> Image.Image:
    ramp = ctx.palette("pop").ramp(ELEMENT_RAMPS[ctx.rng("mover").int(0, len(ELEMENT_RAMPS) - 1)])
    img = draw.canvas(32, 32)
    mask = draw.ellipse_mask(32, 32, 16, 16, 12, 12)
    draw.shade_sphere(img, mask, ramp)
    draw.outline(img, ramp[0])
    return draw.to_image(img)


def generate(ctx: Context) -> list[Frame]:
    return [
        Frame(f"{NAME}/checker16", _checker16(ctx)),
        Frame(f"{NAME}/mover32", _mover32(ctx)),
    ]
