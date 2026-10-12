"""Ground tiles for a dual grid: every terrain in every biome palette, with corner-mask transition shapes.

Contract: contracts/tile-frames.json (checked by tests/test_tiles.py and client/src/render/tile-frames.test.ts).
A frame is a 16x16 render cell whose corners sit on four world tiles. Mask bits: TL=1 TR=2 BL=4 BR=8.
A terrain's frame with mask m is opaque where the terrain (or any higher one) is nearest, so higher terrains
draw over lower ones and the lowest terrain present is a fully opaque base (mask 15).

Look (docs/art/DIRECTION.md section 8): quiet centres (one base tone plus a few deliberate clusters, never per-pixel
speckle), organic low-frequency transition shapes, a lit top lip and a dark bottom lip on raised edges, foam on
water edges, all colours from the biome palette's ramps.
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
TILE_RAMPS = (*PRECEDENCE, "detail", "grass_alt")  # ramps every biome palette must have
FULL_MASK, FULL_VARIANTS, EDGE_VARIANTS = 15, 10, 2
EDGE_NOISE = 0.26  # amplitude of the low-frequency edge wobble, tunable
EDGE_FADE = 5  # px from the frame's outer ring over which the wobble fades in
FACE_H = 4  # cliff face height in px, tunable

_LAST = SIZE - 1
_LATTICE = 4  # edge-noise lattice points per side


def frame_name(palette: str, terrain: str, mask: int, variant: int) -> str:
    """The only place the frame-name format is spelled out in Python."""
    return f"{NAME}/{palette}/{terrain}/{mask}/{variant}"


def masks(terrain: str) -> tuple[int, ...]:
    """The lowest terrain is only ever a mask-15 base; every other terrain needs masks 1..15."""
    return (FULL_MASK,) if terrain == PRECEDENCE[0] else tuple(range(1, FULL_MASK + 1))


def variants(mask: int) -> int:
    return FULL_VARIANTS if mask == FULL_MASK else EDGE_VARIANTS


# ---- shape ------------------------------------------------------------------------------------


def _despeckle(cov: np.ndarray) -> np.ndarray:
    """Flip pixels that have at most one 4-neighbour of their own value (orphans, 1 px necks); frame edge counts as same."""
    for _ in range(2):
        padded = np.pad(cov, 1, mode="edge")
        same = np.zeros(cov.shape, np.int64)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            same += padded[1 + dy : 1 + dy + SIZE, 1 + dx : 1 + dx + SIZE] == cov
        cov = np.where(same <= 1, ~cov, cov)
    return cov


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
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)  # smoothstep: no lattice creases
    noise = (
        lattice[iy, ix] * (1 - fx) * (1 - fy)
        + lattice[iy, ix + 1] * fx * (1 - fy)
        + lattice[iy + 1, ix] * (1 - fx) * fy
        + lattice[iy + 1, ix + 1] * fx * fy
    )

    idx = np.arange(SIZE)
    edge_dist = np.minimum(idx, _LAST - idx)
    border = np.minimum(edge_dist[None, :], edge_dist[:, None])
    t = np.minimum(border, EDGE_FADE) / EDGE_FADE  # 0 on the outer ring, 1 from EDGE_FADE px in
    weight = t * t * (3 - 2 * t)
    cov = bil + EDGE_NOISE * weight * noise > 0.5
    ring = border == 0
    cleaned = _despeckle(cov)
    return np.where(ring, cov, cleaned)  # the ring is exact; everything inside is cleaned


def _neighbour(covered: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """covered shifted so each pixel sees its neighbour at (dy, dx); outside the frame counts as covered."""
    padded = np.pad(covered, 1, constant_values=True)
    return padded[1 + dy : 1 + dy + SIZE, 1 + dx : 1 + dx + SIZE]


def _cliff_face(covered: np.ndarray) -> np.ndarray:
    """Uncovered pixels with covered ground 1..FACE_H rows directly above; row 15 is never face."""
    face = np.zeros_like(covered)
    for k in range(1, FACE_H + 1):
        face[k:] |= covered[:-k]
    face &= ~covered
    face[_LAST] = False
    return face


# ---- texture ----------------------------------------------------------------------------------


def _scatter(
    rng: Rng, n: int, ext: tuple[int, int] = (2, 2), min_d: int = 5
) -> list[tuple[int, int]]:
    """Up to n anchor points at least min_d apart, for features extending ext = (dx, dy) px right and down.

    Every feature lands inside columns and rows 1..14, so no cluster is ever cut at a tile seam, and the
    spread is even, so visual weight is balanced.
    """
    points: list[tuple[int, int]] = []
    for _ in range(n * 12):
        if len(points) == n:
            break
        x, y = rng.int(1, SIZE - 2 - ext[0]), rng.int(1, SIZE - 2 - ext[1])
        if all((x - px) ** 2 + (y - py) ** 2 >= min_d * min_d for px, py in points):
            points.append((x, y))
    return points


def _put(img: np.ndarray, x: int, y: int, color) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        img[y, x] = color


def _stamp(img: np.ndarray, x: int, y: int, shape: list[tuple[int, int, object]]) -> None:
    for dx, dy, color in shape:
        _put(img, x + dx, y + dy, color)


def _grass(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    g, det = p["grass"], p["detail"]
    img[:] = g[2]
    tufts = [3, 3, 4, 3, 4, 3][v % 6]
    flowers = [0, 0, 0, 0, 0, 1][v % 6]
    for i, (x, y) in enumerate(_scatter(rng, tufts + flowers, ext=(2, 2), min_d=5)):
        if i < tufts:  # a blade tuft seen from above: two lit tips over a shaded root
            if rng.int(0, 1):
                _stamp(img, x, y, [(0, 0, g[3]), (2, 0, g[3]), (1, 1, g[1])])
            else:
                _stamp(img, x, y, [(1, 0, g[3]), (0, 1, g[3]), (1, 1, g[1])])
        else:  # a flower: two petals over a bright heart
            c = det[rng.int(0, 2)]
            _stamp(img, x, y, [(0, 0, c), (1, 0, c), (0, 1, det[3])])


def _dirt(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    d = p["dirt"]
    img[:] = d[2]
    pebbles = [1, 2, 1, 2, 3, 1][v % 6]
    cracks = [0, 1, 1, 0, 1, 1][v % 6]
    spots = _scatter(rng, pebbles + cracks, ext=(3, 1), min_d=5)
    for i, (x, y) in enumerate(spots):
        if i < pebbles:  # a pebble: lit top, shaded underside
            _stamp(
                img, x, y, [(0, 0, d[3]), (1, 0, d[3]), (0, 1, d[1]), (1, 1, d[1]), (2, 1, d[1])]
            )
        else:  # a short crack with a lit lip
            _stamp(
                img,
                x,
                y,
                [
                    (0, 0, d[1]),
                    (1, 0, d[1]),
                    (2, 1, d[1]),
                    (3, 1, d[1]),
                    (0, 1, d[3]),
                    (1, 1, d[3]),
                ],
            )
    for x, y in _scatter(rng, 3, ext=(0, 0), min_d=4):  # a few light grains
        _put(img, x, y, d[3])


def _sand(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    s, det = p["sand"], p["detail"]
    img[:] = s[2]
    ripples = [2, 3, 2, 3, 4, 2][v % 6]
    for x, y in _scatter(
        rng, ripples, ext=(5, 1), min_d=5
    ):  # a wind ripple: lit crest over a shaded trough
        n = rng.int(3, 4)
        for i in range(n):
            _put(img, x + i, y, s[3])
            _put(img, x + i + 1, y + 1, s[1])
    if v % 3 == 2:  # a shell glint
        x, y = _scatter(rng, 1, ext=(1, 1))[0]
        _stamp(img, x, y, [(0, 0, det[3]), (1, 0, det[2]), (0, 1, s[1])])


def _stone(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    st = p["stone"]
    img[:] = st[2]
    for x, y in _scatter(rng, [1, 2, 1, 2, 2][v % 5], ext=(5, 3), min_d=6):
        # a slab seam: a dark run with one step in it, lit along its lower edge
        n = rng.int(4, 6)
        step = rng.int(2, n - 2)
        for i in range(n):
            dy = 1 if i >= step else 0
            _put(img, x + i, y + dy, st[1])
            _put(img, x + i, y + dy + 1, st[3])
        if rng.int(0, 1):  # and a short vertical joint from the end of the seam
            _put(img, x + n - 1, y + 2, st[1])
            _put(img, x + n - 1, y + 3, st[1])
    for x, y in _scatter(rng, 2, ext=(1, 0), min_d=5):  # a lit chip
        _stamp(img, x, y, [(0, 0, st[3]), (1, 0, st[3])])


def _cliff(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    cl = p["cliff"]
    img[:] = cl[3]  # the lit top of the ledge
    for x, y in _scatter(rng, 2, ext=(4, 0), min_d=6):
        n = rng.int(3, 5)
        for i in range(n):
            _put(img, x + i, y, cl[2])
    for x, y in _scatter(rng, 2, ext=(0, 0), min_d=5):
        _put(img, x, y, cl[4])


def _water(
    img: np.ndarray, rng: Rng, p: dict, base: str, base_i: int, ripples: int, v: int
) -> None:
    w = p[base]
    img[:] = w[base_i]
    if base_i + 1 >= len(w):
        return
    light = w[min(base_i + 1, len(w) - 1)]
    spark = w[-1]
    for x, y in _scatter(rng, ripples, ext=(5, 1), min_d=5):  # a ripple dash and its shadow
        n = rng.int(3, 4)
        for i in range(n):
            _put(img, x + i, y, light)
        _put(img, x + 1, y + 1, w[base_i - 1] if base_i > 0 else w[0])
        _put(img, x + 2, y + 1, w[base_i - 1] if base_i > 0 else w[0])
    if base == "shallow_water" and v % 2 == 1:
        x, y = _scatter(rng, 1, ext=(0, 0))[0]
        _put(img, x, y, spark)


def _shallow(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    _water(img, rng, p, "shallow_water", 2, [2, 3, 3, 2, 3, 2][v % 6], v)


def _deep(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    _water(img, rng, p, "deep_water", 1, [1, 2, 1, 2, 1, 2][v % 6], v)


def _very_deep(img: np.ndarray, rng: Rng, p: dict, v: int) -> None:
    _water(img, rng, p, "very_deep_water", 1, [0, 1, 0, 1, 0, 1][v % 6], v)


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


# ---- edges ------------------------------------------------------------------------------------


def _rims(img: np.ndarray, covered: np.ndarray, terrain: str, ramp) -> None:
    """The edge treatment: a lit top lip and a dark bottom lip on land, foam on water, wet pale sand on shores."""
    top = covered & ~_neighbour(covered, -1, 0)
    bottom = covered & ~_neighbour(covered, 1, 0)
    side = covered & (~_neighbour(covered, 0, -1) | ~_neighbour(covered, 0, 1))
    if terrain in WATER:
        foam = ramp[-1]
        img[top | bottom | side] = foam
    elif terrain == "sand":
        img[top | side] = ramp[3]
        img[bottom] = ramp[1]
    elif terrain == "cliff":
        img[top | side] = ramp[4]
    else:
        img[side] = ramp[1]
        img[top] = ramp[3]
        img[bottom] = ramp[0]
        under = np.zeros_like(bottom)
        under[:-1] = bottom[1:]  # the row above a bottom lip is in shade too
        img[under & covered & ~bottom & ~top] = ramp[1]


def draw_tile(ctx: Context, palette: str, terrain: str, mask: int, variant: int) -> np.ndarray:
    """One (16, 16, 4) uint8 frame."""
    pal = ctx.palette(palette)
    ramps = {name: pal.ramp(name) for name in TILE_RAMPS}
    ramp = ramps[terrain]
    covered = coverage(mask, ctx.rng("edge", terrain, mask, variant))

    tex = draw.canvas(SIZE, SIZE)
    _TEXTURES[terrain](tex, ctx.rng(palette, terrain, mask, variant), ramps, variant)
    if mask != FULL_MASK:
        _rims(tex, covered, terrain, ramp)

    img = draw.canvas(SIZE, SIZE)
    img[covered] = tex[covered]
    if terrain == "cliff":
        face = _cliff_face(covered)
        stripes = ctx.rng(palette, terrain, mask, variant, "face")
        stripe = [stripes.int(0, 3) for _ in range(SIZE)]
        for x in range(SIZE):
            for y in range(SIZE):
                if face[y, x]:
                    lowest = not face[y + 1, x]  # row 15 is never face, so y + 1 is in frame
                    first = covered[y - 1, x]
                    shade = ramp[0] if lowest or stripe[x] == 0 else ramp[1]
                    if first:
                        shade = ramp[2] if stripe[x] == 3 else ramp[1]
                    img[y, x] = shade
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
