"""Crisp, deterministic pixel-art primitives on numpy RGBA arrays.

Images are uint8 arrays of shape (H, W, 4). Colors are RGBA tuples from palettes.
Alpha is binary (0 or 255) everywhere. No anti-aliasing, no randomness, no Pillow ImageDraw:
every pixel is decided here, so generators that pass in rng-derived values stay reproducible.
"""

import math

import numpy as np
from PIL import Image

Rgba = tuple[int, int, int, int]

# Standard 4x4 Bayer matrix; bayer4() normalises it to thresholds in [0, 1).
_BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.int64)
_BAYER4_THRESHOLDS = (_BAYER4 + 0.5) / 16


def _color(color: Rgba) -> np.ndarray:
    """Validate an RGBA tuple (4 ints 0-255, binary alpha) and return it as a uint8 vector."""
    if len(color) != 4 or any(not isinstance(v, int) or not 0 <= v <= 255 for v in color):
        raise ValueError(f"color must be 4 ints in 0..255, got {color!r}")
    if color[3] not in (0, 255):
        raise ValueError(
            f"color alpha must be 0 or 255 (binary alpha), got {color[3]} in {color!r}"
        )
    return np.array(color, np.uint8)


LINE_COORD_MAX = 100_000  # line() walks every pixel of its span, so unbounded spans are refused


def _ints(**values: object) -> None:
    """Every named value must be a real int (bool, float and NaN are rejected)."""
    for name, v in values.items():
        if not isinstance(v, int) or isinstance(v, bool):
            raise ValueError(f"{name} must be an int, got {v!r}")  # noqa: TRY004


def _finite(**values: object) -> None:
    """Every named value must be a finite real number (bool and NaN/inf are rejected)."""
    for name, v in values.items():
        if not isinstance(v, int | float) or isinstance(v, bool) or not math.isfinite(v):
            raise ValueError(f"{name} must be a finite number, got {v!r}")


def _check_image(img: np.ndarray) -> None:
    if img.ndim != 3 or img.shape[2] != 4 or img.dtype != np.uint8:
        raise ValueError(f"image must be uint8 (H, W, 4), got {img.dtype} {img.shape}")


def _check_mask(img: np.ndarray, mask: np.ndarray) -> None:
    _check_image(img)
    if mask.dtype != np.bool_ or mask.shape != img.shape[:2]:
        raise ValueError(
            f"mask must be bool with shape {img.shape[:2]}, got {mask.dtype} {mask.shape}"
        )


def canvas(w: int, h: int) -> np.ndarray:
    """Fully transparent w x h image."""
    _ints(w=w, h=h)
    if w < 1 or h < 1:
        raise ValueError(f"canvas size must be at least 1x1, got {w}x{h}")
    return np.zeros((h, w, 4), np.uint8)


def rect(img: np.ndarray, x: int, y: int, w: int, h: int, color: Rgba) -> None:
    """Filled rectangle with top-left (x, y), clipped to the image."""
    _check_image(img)
    _ints(x=x, y=y, w=w, h=h)
    c = _color(color)
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + w, img.shape[1]), min(y + h, img.shape[0])
    if x0 < x1 and y0 < y1:
        img[y0:y1, x0:x1] = c


def line(img: np.ndarray, x0: int, y0: int, x1: int, y1: int, color: Rgba) -> None:
    """Bresenham line, both endpoints inclusive, clipped to the image.

    Exact ties (the line passes between two pixels) round toward the line's end point.
    """
    _check_image(img)
    _ints(x0=x0, y0=y0, x1=x1, y1=y1)
    for name, v in (("x0", x0), ("y0", y0), ("x1", x1), ("y1", y1)):
        if abs(v) > LINE_COORD_MAX:
            raise ValueError(f"{name}={v} is outside +-{LINE_COORD_MAX}")
    c = _color(color)
    h, w = img.shape[:2]
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        if 0 <= x < w and 0 <= y < h:
            img[y, x] = c
        if x == x1 and y == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def ellipse_mask(w: int, h: int, cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    """Bool (h, w) mask: pixel (x, y) is inside iff ((x+0.5-cx)/rx)^2 + ((y+0.5-cy)/ry)^2 <= 1."""
    _ints(w=w, h=h)
    _finite(cx=cx, cy=cy, rx=rx, ry=ry)
    if rx <= 0 or ry <= 0:
        raise ValueError(f"ellipse radii must be positive, got rx={rx} ry={ry}")
    ys, xs = np.mgrid[0:h, 0:w]
    return ((xs + 0.5 - cx) / rx) ** 2 + ((ys + 0.5 - cy) / ry) ** 2 <= 1


def fill_mask(img: np.ndarray, mask: np.ndarray, color: Rgba) -> None:
    """Set every pixel inside mask to color."""
    _check_mask(img, mask)
    img[mask] = _color(color)


def outline(img: np.ndarray, color: Rgba, diagonal: bool = False) -> None:
    """Turn transparent pixels 4-adjacent (8-adjacent if diagonal) to opaque ones into color.

    Computed from the image as it was before the call, so the outline is exactly 1 px thick.
    """
    _check_image(img)
    c = _color(color)
    opaque = img[..., 3] == 255
    padded = np.pad(opaque, 1)
    h, w = opaque.shape
    offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if diagonal:
        offsets += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    near = np.zeros_like(opaque)
    for oy, ox in offsets:
        near |= padded[1 + oy : 1 + oy + h, 1 + ox : 1 + ox + w]
    img[near & ~opaque] = c


def bayer4(x: int, y: int) -> float:
    """Standard 4x4 Bayer threshold in [0, 1): (M[y%4][x%4] + 0.5) / 16."""
    return float(_BAYER4_THRESHOLDS[y % 4, x % 4])


def _bayer_grid(h: int, w: int) -> np.ndarray:
    """bayer4(x, y) for every pixel of an (h, w) image."""
    ys, xs = np.mgrid[0:h, 0:w]
    return _BAYER4_THRESHOLDS[ys % 4, xs % 4]


def dither(img: np.ndarray, mask: np.ndarray, color_a: Rgba, color_b: Rgba, level: float) -> None:
    """Inside mask: color_b where bayer4(x, y) < level, else color_a. level is in [0, 1]."""
    _check_mask(img, mask)
    if not 0 <= level <= 1:
        raise ValueError(f"dither level must be in 0..1, got {level}")
    use_b = _bayer_grid(*mask.shape) < level
    img[mask & ~use_b] = _color(color_a)
    img[mask & use_b] = _color(color_b)


def shade_sphere(
    img: np.ndarray,
    mask: np.ndarray,
    ramp: list[Rgba],
    light: tuple[float, float, float] = (-0.6, -0.6, 0.53),
) -> None:
    """Shade mask as a lit hemisphere using only colors from ramp (dark to light).

    The mask's bounding ellipse gives the surface normals; Lambert light picks a position along
    the ramp, and the fractional part is resolved by ordered dithering between neighbours.
    """
    _check_mask(img, mask)
    if not ramp:
        raise ValueError("ramp must contain at least one color")
    colors = np.array([_color(c) for c in ramp])
    lx, ly, lz = light
    norm = math.sqrt(lx * lx + ly * ly + lz * lz)
    if norm == 0:
        raise ValueError("light vector must be non-zero")
    if not mask.any():
        return

    rows, cols = np.nonzero(mask)
    x0, x1, y0, y1 = cols.min(), cols.max() + 1, rows.min(), rows.max() + 1
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2

    ys, xs = np.mgrid[0 : mask.shape[0], 0 : mask.shape[1]]
    nx = (xs + 0.5 - cx) / rx
    ny = (ys + 0.5 - cy) / ry
    nz = np.sqrt(np.maximum(0.0, 1 - nx * nx - ny * ny))
    lambert = np.clip((nx * lx + ny * ly + nz * lz) / norm, 0, 1)

    v = lambert * (len(ramp) - 1)
    lo = np.floor(v)
    upper = _bayer_grid(*mask.shape) < (v - lo)
    index = np.minimum(lo.astype(np.int64) + upper, len(ramp) - 1)
    img[mask] = colors[index[mask]]


def paste(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    """Copy src pixels with alpha 255 onto dst at (x, y), clipped to dst."""
    _check_image(dst)
    _check_image(src)
    _ints(x=x, y=y)
    sh, sw = src.shape[:2]
    dh, dw = dst.shape[:2]
    cx0, cy0 = max(x, 0), max(y, 0)
    cx1, cy1 = min(x + sw, dw), min(y + sh, dh)
    if cx0 >= cx1 or cy0 >= cy1:
        return
    part = src[cy0 - y : cy1 - y, cx0 - x : cx1 - x]
    region = dst[cy0:cy1, cx0:cx1]
    solid = part[..., 3] == 255
    region[solid] = part[solid]


def to_image(arr: np.ndarray) -> Image.Image:
    """Convert to a Pillow RGBA image, refusing any pixel whose alpha is not 0 or 255."""
    _check_image(arr)
    bad = (arr[..., 3] != 0) & (arr[..., 3] != 255)
    if bad.any():
        ys, xs = np.nonzero(bad)
        raise ValueError(
            f"{int(bad.sum())} pixel(s) have non-binary alpha, first at "
            f"({xs[0]}, {ys[0]}) alpha={arr[ys[0], xs[0], 3]}"
        )
    return Image.fromarray(arr, "RGBA")
