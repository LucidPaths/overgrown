"""Ground tiles for a dual grid: every terrain in every biome palette, with corner-mask transition shapes.

Contract: contracts/tile-frames.json (checked by tests/test_tiles.py and client/src/render/tile-frames.test.ts).
A frame is a 16x16 render cell whose corners sit on four world tiles. Mask bits: TL=1 TR=2 BL=4 BR=8.
A terrain's frame with mask m is opaque where the terrain (or any higher one) is nearest, so higher terrains
draw over lower ones and the lowest terrain present is a fully opaque base (mask 15).
"""

import numpy as np

from lib import draw
from lib.atlas import Frame
from lib.context import Context
from lib.rng import Rng

NAME = "tile"
ATLAS = "core"
SIZE = 16
PALETTES = ("meadow", "forest", "river", "mountain", "ocean")
PRECEDENCE = (
    "very_deep_water",
    "deep_water",
    "shallow_water",
    "sand",
    "dirt",
    "grass",
    "stone",
    "cliff",
)
WATER = frozenset({"shallow_water", "deep_water", "very_deep_water"})
TILE_RAMPS = (*PRECEDENCE, "detail")  # ramps every biome palette must have
FULL_MASK, FULL_VARIANTS, EDGE_VARIANTS = 15, 3, 2
EDGE_NOISE = 0.3  # tunable
FACE_H = 4  # cliff face height in px, tunable

_LAST = SIZE - 1
_LATTICE = 5  # edge-noise lattice points per side


def frame_name(palette: str, terrain: str, mask: int, variant: int) -> str:
    """The only place the frame-name format is spelled out in Python."""
    return f"{NAME}/{palette}/{terrain}/{mask}/{variant}"


def masks(terrain: str) -> tuple[int, ...]:
    """The lowest terrain is only ever a mask-15 base; every other terrain needs masks 1..15."""
    return (FULL_MASK,) if terrain == PRECEDENCE[0] else tuple(range(1, FULL_MASK + 1))


def variants(mask: int) -> int:
    return FULL_VARIANTS if mask == FULL_MASK else EDGE_VARIANTS


def coverage(mask: int, rng: Rng) -> np.ndarray:
    """Bool (16, 16) [y, x]: where the terrain is present for the corners in mask.

    On the outer ring only the two corners of that edge matter, so neighbouring cells meet exactly.
    """
    a_tl, a_tr, a_bl, a_br = (mask >> i & 1 for i in range(4))
    ramp = np.arange(SIZE) / _LAST
    u, v = ramp[None, :], ramp[:, None]  # exactly 0 on index 0 and 1 on index 15
    bil = a_tl * (1 - u) * (1 - v) + a_tr * u * (1 - v) + a_bl * (1 - u) * v + a_br * u * v

    lattice = np.array(
        [[rng.next_float() * 2 - 1 for _ in range(_LATTICE)] for _ in range(_LATTICE)]
    )
    gx, gy = u * (_LATTICE - 1), v * (_LATTICE - 1)
    ix = np.minimum(np.floor(gx).astype(np.int64), _LATTICE - 2)
    iy = np.minimum(np.floor(gy).astype(np.int64), _LATTICE - 2)
    fx, fy = gx - ix, gy - iy
    noise = (
        lattice[iy, ix] * (1 - fx) * (1 - fy)
        + lattice[iy, ix + 1] * fx * (1 - fy)
        + lattice[iy + 1, ix] * (1 - fx) * fy
        + lattice[iy + 1, ix + 1] * fx * fy
    )

    idx = np.arange(SIZE)
    edge_dist = np.minimum(idx, _LAST - idx)
    border = np.minimum(edge_dist[None, :], edge_dist[:, None])
    weight = np.minimum(border, 2) / 2  # 0 on the outer ring, 1 from 2 px in
    return bil + EDGE_NOISE * weight * noise > 0.5


# ---- texture ---------------------------------------------------------------------------------


def _speckle(img: np.ndarray, rng: Rng, base, dark, light, dark_p: float, light_p: float) -> None:
    """Fill every pixel with base, or dark / light with the given chances."""
    for y in range(SIZE):
        for x in range(SIZE):
            f = rng.next_float()
            img[y, x] = dark if f < dark_p else light if f > 1 - light_p else base


def _strokes(img, rng: Rng, count: int, length: int, colors, under=None) -> None:
    """Horizontal strokes fully inside rows and columns 1..14, optionally with a 1 px shadow below."""
    for _ in range(count):
        x = rng.int(1, 1 + SIZE - 2 - length)
        y = rng.int(1, SIZE - 3)
        c = colors[rng.int(0, len(colors) - 1)]
        for i in range(length):
            img[y, x + i] = c
            if under is not None:
                img[y + 1, x + i] = under


def _dots(img, rng: Rng, count: int, colors) -> None:
    """Single pixels fully inside rows and columns 1..14."""
    for _ in range(count):
        x, y = rng.int(1, SIZE - 2), rng.int(1, SIZE - 2)
        img[y, x] = colors[rng.int(0, len(colors) - 1)]


def _detail(img, rng: Rng, detail) -> None:
    """Sparse specks (flowers, leaf litter, pebbles, shells): 0-3 per tile, some two pixels wide."""
    for _ in range(rng.int(0, 3)):
        x, y = rng.int(1, SIZE - 3), rng.int(1, SIZE - 2)
        c = detail[rng.int(0, len(detail) - 1)]
        img[y, x] = c
        if rng.int(0, 1):
            img[y, x + 1] = detail[rng.int(0, len(detail) - 1)]


def _grass(img, rng: Rng, ramp, detail) -> None:
    mid = len(ramp) // 2
    _speckle(img, rng, ramp[mid], ramp[mid - 1], ramp[mid + 1], 0.14, 0.12)
    for _ in range(6):  # blades: a light tip over a shaded stem
        x, y = rng.int(1, SIZE - 2), rng.int(1, SIZE - 3)
        img[y, x] = ramp[-1]
        img[y + 1, x] = ramp[mid - 1]
    _detail(img, rng, detail)


def _dirt(img, rng: Rng, ramp, detail) -> None:
    mid = len(ramp) // 2
    _speckle(img, rng, ramp[mid], ramp[mid - 1], ramp[mid + 1], 0.16, 0.12)
    for _ in range(3):  # pebbles: light top, shadow below right
        x, y = rng.int(1, SIZE - 3), rng.int(1, SIZE - 3)
        img[y, x] = ramp[-1]
        img[y, x + 1] = ramp[-2]
        img[y + 1, x + 1] = ramp[0]
    _detail(img, rng, detail)


def _sand(img, rng: Rng, ramp, detail) -> None:
    mid = len(ramp) // 2
    _speckle(img, rng, ramp[mid], ramp[mid - 1], ramp[mid + 1], 0.12, 0.12)
    _strokes(img, rng, 4, 3, [ramp[-1]], under=ramp[mid - 1])  # wind ripples


def _stone(img, rng: Rng, ramp, detail) -> None:
    mid = len(ramp) // 2
    _speckle(img, rng, ramp[mid], ramp[mid - 1], ramp[mid + 1], 0.16, 0.1)
    for _ in range(5):  # slabs: lit top row, shaded bottom row
        x, y = rng.int(1, SIZE - 4), rng.int(1, SIZE - 3)
        for i in range(3):
            img[y, x + i] = ramp[-1]
            img[y + 1, x + i] = ramp[0]


def _cliff(img, rng: Rng, ramp, detail) -> None:
    top = ramp[2:]  # the top surface uses the upper shades; the face uses the two darkest
    _speckle(img, rng, top[1], top[0], top[-1], 0.2, 0.04)
    for y in range(SIZE):  # horizontal strata
        if rng.int(0, 5) == 0:
            for x in range(SIZE):
                if rng.next_float() < 0.4:
                    img[y, x] = top[-1]
    _dots(img, rng, 6, [ramp[1]])  # pits


def _water(img, rng: Rng, ramp, ripples: int) -> None:
    mid = len(ramp) // 2
    _speckle(img, rng, ramp[mid], ramp[mid - 1], ramp[mid + 1], 0.14, 0.1)
    _strokes(img, rng, ripples, 3, [ramp[-1]])


def _shallow(img, rng: Rng, ramp, detail) -> None:
    _water(img, rng, ramp, 5)


def _deep(img, rng: Rng, ramp, detail) -> None:
    _water(img, rng, ramp, 2)


def _very_deep(img, rng: Rng, ramp, detail) -> None:
    _water(img, rng, ramp, 0)


_TEXTURES = {
    "grass": _grass,
    "dirt": _dirt,
    "sand": _sand,
    "stone": _stone,
    "cliff": _cliff,
    "shallow_water": _shallow,
    "deep_water": _deep,
    "very_deep_water": _very_deep,
}


# ---- shape ------------------------------------------------------------------------------------


def _uncovered_neighbour(covered: np.ndarray) -> np.ndarray:
    """True where a pixel has an uncovered 4-neighbour inside the frame (outside counts as covered)."""
    padded = np.pad(covered, 1, constant_values=True)
    near = np.zeros_like(covered)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        near |= ~padded[1 + dy : 1 + dy + SIZE, 1 + dx : 1 + dx + SIZE]
    return near & covered


def _cliff_face(covered: np.ndarray) -> np.ndarray:
    """Uncovered pixels with covered ground 1..FACE_H rows directly above; row 15 is never face."""
    face = np.zeros_like(covered)
    for k in range(1, FACE_H + 1):
        face[k:] |= covered[:-k]
    face &= ~covered
    face[_LAST] = False
    return face


def draw_tile(ctx: Context, palette: str, terrain: str, mask: int, variant: int) -> np.ndarray:
    """One (16, 16, 4) uint8 frame."""
    pal = ctx.palette(palette)
    ramp, detail = pal.ramp(terrain), pal.ramp("detail")
    covered = coverage(mask, ctx.rng("edge", terrain, mask, variant))

    tex = draw.canvas(SIZE, SIZE)
    _TEXTURES[terrain](tex, ctx.rng(palette, terrain, mask, variant), ramp, detail)
    rim = _uncovered_neighbour(covered)
    tex[rim] = ramp[-1] if terrain in WATER else ramp[0]  # water: foam shelf; land: dark lip

    img = draw.canvas(SIZE, SIZE)
    img[covered] = tex[covered]
    if terrain == "cliff":
        face = _cliff_face(covered)
        stripes = ctx.rng(palette, terrain, mask, variant, "face")
        stripe = [stripes.int(0, 2) for _ in range(SIZE)]
        for x in range(SIZE):
            for y in range(SIZE):
                if face[y, x]:
                    lowest = not face[y + 1, x]  # row 15 is never face, so y + 1 is in frame
                    dark = stripe[x] == 0 or (stripe[x] == 1 and y % 2 == 0)
                    img[y, x] = ramp[0] if lowest or dark else ramp[1]
    return img


def generate(ctx: Context) -> list[Frame]:
    frames = []
    for palette in PALETTES:
        for terrain in PRECEDENCE:
            for mask in masks(terrain):
                for variant in range(variants(mask)):
                    image = draw.to_image(draw_tile(ctx, palette, terrain, mask, variant))
                    frames.append(Frame(frame_name(palette, terrain, mask, variant), image))
    return frames
