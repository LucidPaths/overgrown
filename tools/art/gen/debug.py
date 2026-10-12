"""Placeholder frames that exercise the pipeline end to end, RNG path included."""

import colorsys

import numpy as np
from PIL import Image

from lib.atlas import Frame
from lib.context import Context

NAME = "debug"
ATLAS = "core"


def _checker16(ctx: Context) -> Image.Image:
    grass = ctx.palette("meadow").ramp("grass")
    green_dark, green_light = grass[1], grass[3]
    ys, xs = np.mgrid[0:16, 0:16]
    light = ((xs // 4 + ys // 4) % 2 == 0)[..., None]
    px = np.where(light, np.array(green_light, np.uint8), np.array(green_dark, np.uint8))
    return Image.fromarray(px.astype(np.uint8), "RGBA")


def _rgba(hue: float, value: float) -> np.ndarray:
    r, g, b = colorsys.hsv_to_rgb(hue, 0.65, value)
    return np.array([round(r * 255), round(g * 255), round(b * 255), 255], np.uint8)


def _mover32(ctx: Context) -> Image.Image:
    hue = ctx.rng("mover").int(0, 359) / 360
    # Squared distance from the centre (16, 16) in half-pixel units, integers only.
    ys, xs = np.mgrid[0:32, 0:32]
    d2 = (2 * xs + 1 - 32) ** 2 + (2 * ys + 1 - 32) ** 2
    disk = d2 <= 24**2  # radius 12
    outline = disk & (d2 > 22**2)  # outermost 1 px ring
    px = np.zeros((32, 32, 4), np.uint8)
    px[disk] = _rgba(hue, 0.9)
    px[outline] = ctx.palette("pop").ramp("shadow")[0]
    return Image.fromarray(px, "RGBA")


def generate(ctx: Context) -> list[Frame]:
    return [
        Frame(f"{NAME}/checker16", _checker16(ctx)),
        Frame(f"{NAME}/mover32", _mover32(ctx)),
    ]
