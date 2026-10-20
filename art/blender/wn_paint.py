"""The wanderer's texture atlas, painted in code with numpy (no downloads, no randomness outside a fixed seed).

Layers: a low-frequency colour field, the geometric patterns (hem bands, the back zigzag, diamonds, the gem),
then thousands of brush strokes that each pick up the colour under them and smear it a little along the cloth
drape, so every pattern edge ends up painted rather than vector-crisp. Written as an 8-bit sRGB PNG by our own
zlib writer: the same input always gives the same bytes.

Atlas layout (pixels, origin top-left). `uv(region, a, b)` turns region-local fractions (a across, b down) into
Blender UVs (v up).
"""

import struct
import zlib

import numpy as np

W = 1024
H = 1024
SEED = 20261019

# name: (x0, y0, w, h)
REGIONS = {
    "robe": (0, 0, 1024, 512),
    "cape": (0, 512, 1024, 224),
    "lining": (0, 736, 512, 64),
    "scarf": (512, 736, 512, 128),
    "hair": (0, 800, 256, 224),
    "face": (256, 800, 256, 224),
}
SWATCHES = ["trousers", "leather", "wrap", "glove", "sleeve", "cuff", "sole", "skin"]
for _i, _n in enumerate(SWATCHES):
    REGIONS[_n] = (512 + (_i % 4) * 128, 864 + (_i // 4) * 80, 128, 80)

# Pixel rows/columns the mesh builder needs to agree with.
ROBE_BAND_PX = 54  # robe hem band height (bottom of the robe region)
CAPE_BAND_PX = 40  # cape hem band height
CAPE_GEM_B = 44  # gem centre row in the cape region

# sRGB palette
NAVY = (0.085, 0.165, 0.195)
NAVY_DARK = (0.035, 0.07, 0.095)
NAVY_HI = (0.2, 0.31, 0.33)
ORANGE = (0.85, 0.37, 0.11)
RUST = (0.52, 0.17, 0.06)
GOLD = (0.93, 0.68, 0.26)
SCARF = (0.8, 0.6, 0.22)
SCARF_DARK = (0.46, 0.3, 0.1)
SCARF_HI = (0.98, 0.84, 0.46)
TURQUOISE = (0.2, 0.75, 0.72)


def uv(region: str, a: float, b: float) -> tuple[float, float]:
    x0, y0, w, h = REGIONS[region]
    # half-pixel inset so bilinear filtering never bleeds across region borders
    ax = x0 + 0.5 + a * (w - 1.0)
    by = y0 + 0.5 + b * (h - 1.0)
    return (ax / W, 1.0 - by / H)


# ---------------------------------------------------------------- noise
def value_noise(h: int, w: int, cy: int, cx: int, rng, wrap_x: bool = True) -> np.ndarray:
    """Smooth value noise in [0, 1] on an h x w grid with cy x cx lattice cells (tileable in x if wrap_x)."""
    lat = rng.random((cy + 1, cx + (0 if wrap_x else 1)))
    ys = np.arange(h) * (cy / h)
    xs = np.arange(w) * (cx / w)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = ys - y0
    fx = xs - x0
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    x1 = (x0 + 1) % lat.shape[1] if wrap_x else x0 + 1
    a = lat[y0][:, x0]
    b = lat[y0][:, x1]
    c = lat[y0 + 1][:, x0]
    d = lat[y0 + 1][:, x1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(h: int, w: int, base: int, rng, octaves: int = 4, aspect: float = 1.0) -> np.ndarray:
    out = np.zeros((h, w))
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        cells = base * (2**o)
        out += amp * value_noise(h, w, max(1, int(cells * aspect)), cells, rng)
        tot += amp
        amp *= 0.5
    return out / tot


def mix(c0, c1, t):
    c0 = np.asarray(c0, dtype=float)
    c1 = np.asarray(c1, dtype=float)
    t = np.asarray(t, dtype=float)[..., None]
    return c0 * (1 - t) + c1 * t


def tri(x):
    """Triangle wave in [-1, 1] with period 1."""
    f = x - np.floor(x)
    return 4.0 * np.abs(f - 0.5) - 1.0


# ---------------------------------------------------------------- strokes
def strokes(img: np.ndarray, region: str, n: int, rng, length=(14, 40), width=(2.5, 6.0), angle=0.0, angle_jit=0.35,
            jitter=0.05, wrap_x=True, lift=0.0, pick_offset=0.6, bristle=True) -> None:
    """Stamps n brush strokes into img inside region. Each stroke picks its colour up from the image near its
    tail (pick_offset of its length behind the centre) and carries it forward: patterns get dragged and
    softened like wet paint. `angle` is the mean direction in radians (0 = down the region, the drape)."""
    x0, y0, w, h = REGIONS[region]
    sub = img[y0 : y0 + h, x0 : x0 + w]
    for _ in range(n):
        L = rng.uniform(*length)
        Wd = rng.uniform(*width)
        a = angle + rng.normal(0.0, angle_jit)
        cx = rng.uniform(0, w)
        cy = rng.uniform(0, h)
        dx, dy = np.sin(a), np.cos(a)
        r = int(np.ceil(L * 0.5 + Wd)) + 1
        ys = np.arange(int(cy) - r, int(cy) + r + 1)
        xs = np.arange(int(cx) - r, int(cx) + r + 1)
        ys = ys[(ys >= 0) & (ys < h)]
        if ys.size == 0:
            continue
        if wrap_x:
            xi = xs % w
        else:
            keep = (xs >= 0) & (xs < w)
            xs = xs[keep]
            xi = xs
            if xs.size == 0:
                continue
        gy, gx = np.meshgrid(ys - cy, xs - cx, indexing="ij")
        along = gx * dx + gy * dy
        across = -gx * dy + gy * dx
        m = np.clip(1.0 - (along / (L * 0.5)) ** 2, 0.0, 1.0) ** 0.6
        m *= np.exp(-((across / (Wd * 0.5)) ** 2) * 1.6)
        if bristle:
            ph = rng.uniform(0, 6.28)
            m *= 0.72 + 0.28 * np.sin(across * (5.5 / max(Wd, 1.0)) * 3.0 + ph)
        # colour picked up behind the stroke
        px = int(cx - dx * L * pick_offset * 0.5) % w if wrap_x else int(np.clip(cx - dx * L * pick_offset * 0.5, 0, w - 1))
        py = int(np.clip(cy - dy * L * pick_offset * 0.5, 0, h - 1))
        col = sub[py, px].copy()
        col = col * (1.0 + rng.normal(0.0, jitter)) + lift
        col = np.clip(col, 0.0, 1.0)
        m = m[..., None] * rng.uniform(0.55, 0.95)
        patch = sub[np.ix_(ys, xi)]
        sub[np.ix_(ys, xi)] = patch * (1 - m) + col * m


def specks(img, region, n, rng, colour, size=(0.6, 1.6), alpha=(0.4, 0.9), mask_fn=None):
    x0, y0, w, h = REGIONS[region]
    sub = img[y0 : y0 + h, x0 : x0 + w]
    for _ in range(n):
        cx = rng.uniform(0, w)
        cy = rng.uniform(0, h)
        if mask_fn is not None and not mask_fn(cx, cy):
            continue
        s = rng.uniform(*size)
        r = int(np.ceil(s * 2)) + 1
        ys = np.arange(int(cy) - r, int(cy) + r + 1)
        xs = np.arange(int(cx) - r, int(cx) + r + 1)
        ys = ys[(ys >= 0) & (ys < h)]
        xs = xs % w
        gy, gx = np.meshgrid(ys - cy, np.arange(int(cx) - r, int(cx) + r + 1) - cx, indexing="ij")
        m = np.exp(-(gx**2 + gy**2) / (s * s)) * rng.uniform(*alpha)
        patch = sub[np.ix_(ys, xs)]
        sub[np.ix_(ys, xs)] = patch * (1 - m[..., None]) + np.asarray(colour) * m[..., None]


# ---------------------------------------------------------------- patterns
def stepped(v, step):
    return np.floor(v / step) * step


def band_diamonds(w: int, h: int, period: int, rng, warp) -> np.ndarray:
    """A woven hem band: gold rules at top and bottom, an orange ground, a chain of stepped navy diamonds with
    orange hearts, and small rust triangles between them. Returns RGB (h, w, 3)."""
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    xs = xs + warp[0]
    ys = ys + warp[1]
    out = np.empty((h, w, 3))
    out[:] = ORANGE
    shade = value_noise(h, w, 3, w // 32, rng)
    out = mix(out, RUST, 0.25 * shade)
    # stepped diamond: |dx|/hw + |dy|/hh in 3-px steps (a woven look)
    lx = (xs % period) - period / 2
    cy = h / 2
    dx = np.abs(stepped(lx, 3.0) + 1.5)
    dy = np.abs(stepped(ys - cy, 3.0) + 1.5)
    hw = period * 0.36
    hh = h * 0.33
    d = dx / hw + dy / hh
    ring = (d > 0.55) & (d < 1.0)
    heart = d < 0.28
    out[ring] = NAVY_DARK
    out[heart] = RUST
    # small triangles in the gaps, pointing in from the rules
    gx = np.abs(((xs + period / 2) % period) - period / 2)
    top_tri = (ys < h * 0.3) & (gx < (h * 0.3 - ys) * 0.9)
    bot_tri = (ys > h * 0.7) & (gx < (ys - h * 0.7) * 0.9)
    out[top_tri | bot_tri] = np.asarray(RUST) * 0.8
    # gold rules
    rule = (ys < 4.5) | (ys > h - 5.5)
    out[rule] = GOLD
    inner = ((ys > 6.0) & (ys < 7.5)) | ((ys > h - 9.0) & (ys < h - 7.5))
    out[inner] = NAVY_DARK
    return out


def band_chevrons(w: int, h: int, period: int, rng, warp) -> np.ndarray:
    """The cape's hem band: a running chevron (zigzag) between gold rules, navy teeth on orange."""
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    xs = xs + warp[0]
    ys = ys + warp[1]
    out = np.empty((h, w, 3))
    out[:] = ORANGE
    shade = value_noise(h, w, 3, w // 32, rng)
    out = mix(out, RUST, 0.25 * shade)
    zz = h * 0.5 + tri(xs / period) * h * 0.22
    teeth = np.abs(stepped(ys, 2.0) - zz) < h * 0.12
    out[teeth] = NAVY_DARK
    dots = (np.abs(((xs + period / 4) % (period / 2)) - period / 4) < 2.5) & (np.abs(ys - (h * 0.5 - tri(xs / period) * h * 0.18)) < 2.5)
    out[dots] = GOLD
    rule = (ys < 4.0) | (ys > h - 5.0)
    out[rule] = GOLD
    return out


def paint() -> np.ndarray:
    rng = np.random.default_rng(SEED)
    img = np.zeros((H, W, 3))

    # ---- robe
    x0, y0, w, h = REGIONS["robe"]
    field = fbm(h, w, 6, rng, octaves=4, aspect=0.5)
    streak = value_noise(h, w, 4, 96, rng)  # vertical drape streaks
    base = mix(NAVY_DARK, NAVY, np.clip(field * 1.25 - 0.1, 0, 1))
    base = mix(base, NAVY_HI, np.clip((streak - 0.55) * 1.6, 0, 1) * 0.55)
    # gets darker toward the hem (dust, shadow)
    grad = np.linspace(0.0, 1.0, h)[:, None]
    base = mix(base, NAVY_DARK, 0.25 * grad)
    img[y0 : y0 + h, x0 : x0 + w] = base
    sub = img[y0 : y0 + h, x0 : x0 + w]
    # scattered diamonds (muted rust), on a jittered grid
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    for gy in range(36, h - ROBE_BAND_PX - 20, 74):
        for gx in range(0, w, 86):
            cxp = gx + 43 * ((gy // 74) % 2) + rng.uniform(-10, 10)
            cyp = gy + rng.uniform(-8, 8)
            if abs(((cxp % w) - w / 2)) < 40:  # keep clear of the back stripe
                continue
            s = rng.uniform(4.5, 7.0)
            dxp = np.abs(((xs - cxp + w / 2) % w) - w / 2)
            m = (dxp / s + np.abs(ys - cyp) / (s * 1.4)) < 1.0
            sub[m] = mix(sub[m], RUST, 0.85)
    # the back zigzag: a rust-edged orange line from the top to the band, with a diamond every 120 px
    xc = w / 2 + tri(ys / 38.0) * 9.0
    dist = np.abs(xs - xc)
    above_band = ys < h - ROBE_BAND_PX - 2
    sub[(dist < 5.5) & above_band] = RUST
    sub[(dist < 3.4) & above_band] = ORANGE
    for cyp in range(60, h - ROBE_BAND_PX - 30, 120):
        dd = np.abs(xs - w / 2) / 11.0 + np.abs(ys - cyp) / 14.0
        sub[(dd < 1.0) & (dd > 0.55)] = ORANGE
        sub[dd < 0.3] = GOLD
    # the hem band
    bh = ROBE_BAND_PX
    warp = (value_noise(bh, w, 2, 64, rng) * 3.0, value_noise(bh, w, 2, 64, rng) * 2.0)
    sub[h - bh :] = band_diamonds(w, bh, 64, rng, warp)
    # brushwork: vertical drape strokes, then shorter cross-hatching
    strokes(img, "robe", 5200, rng, length=(16, 46), width=(2.5, 6.5), angle=0.0, angle_jit=0.25, jitter=0.07)
    strokes(img, "robe", 1600, rng, length=(8, 18), width=(2.0, 4.0), angle=1.2, angle_jit=0.5, jitter=0.1, lift=0.012)
    specks(img, "robe", 700, rng, ORANGE, size=(0.5, 1.2), alpha=(0.15, 0.45), mask_fn=lambda x, y: y < 512 - ROBE_BAND_PX)

    # ---- cape (poncho top). u: 0 = front, 0.5 = back.
    x0, y0, w, h = REGIONS["cape"]
    field = fbm(h, w, 6, rng, octaves=4, aspect=0.3)
    streak = value_noise(h, w, 3, 80, rng)
    base = mix(NAVY_DARK, NAVY, np.clip(field * 1.3 - 0.1, 0, 1))
    base = mix(base, NAVY_HI, np.clip((streak - 0.5) * 1.6, 0, 1) * 0.6)
    img[y0 : y0 + h, x0 : x0 + w] = base
    sub = img[y0 : y0 + h, x0 : x0 + w]
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    for gy in range(70, h - CAPE_BAND_PX - 12, 60):
        for gx in range(20, w, 92):
            cxp = gx + 46 * ((gy // 60) % 2) + rng.uniform(-8, 8)
            cyp = gy + rng.uniform(-6, 6)
            if abs(cxp - w / 2) < 40:
                continue
            s = rng.uniform(4.0, 6.0)
            m = (np.abs(xs - cxp) / s + np.abs(ys - cyp) / (s * 1.4)) < 1.0
            sub[m] = mix(sub[m], RUST, 0.85)
    # back: gem, then the zigzag down to the band
    xc = w / 2 + tri((ys - CAPE_GEM_B) / 30.0) * 7.0
    dist = np.abs(xs - xc)
    seg = (ys > CAPE_GEM_B + 12) & (ys < h - CAPE_BAND_PX - 2)
    sub[(dist < 5.0) & seg] = RUST
    sub[(dist < 3.0) & seg] = ORANGE
    rr = np.hypot(xs - w / 2, (ys - CAPE_GEM_B) * 1.1)
    sub[rr < 13.0] = GOLD
    sub[rr < 10.0] = mix(TURQUOISE, (0.05, 0.3, 0.32), np.clip((ys[rr < 10.0] - CAPE_GEM_B + 6) / 14.0, 0, 1))
    sub[(rr < 3.5) & (ys < CAPE_GEM_B - 1)] = (0.75, 0.98, 0.95)
    # front: a short zigzag below the scarf, and the band
    xf = np.minimum(xs, w - xs)  # distance from the front seam (u = 0 and 1)
    fz = np.abs(xf - (6.0 + tri(ys / 26.0) * 5.0))
    segf = (ys > 30) & (ys < h - CAPE_BAND_PX - 2)
    sub[(fz < 2.6) & segf] = ORANGE
    bh = CAPE_BAND_PX
    warp = (value_noise(bh, w, 2, 64, rng) * 3.0, value_noise(bh, w, 2, 64, rng) * 1.5)
    sub[h - bh :] = band_chevrons(w, bh, 48, rng, warp)
    strokes(img, "cape", 2600, rng, length=(14, 36), width=(2.5, 6.0), angle=0.0, angle_jit=0.3, jitter=0.07)
    strokes(img, "cape", 700, rng, length=(8, 16), width=(2.0, 4.0), angle=1.3, angle_jit=0.5, jitter=0.1, lift=0.012)
    specks(img, "cape", 280, rng, ORANGE, size=(0.5, 1.1), alpha=(0.15, 0.4), mask_fn=lambda x, y: y < 224 - CAPE_BAND_PX)

    # ---- lining: dark, warm-shadowed wool
    x0, y0, w, h = REGIONS["lining"]
    field = value_noise(h, w, 2, 16, rng)
    img[y0 : y0 + h, x0 : x0 + w] = mix((0.03, 0.05, 0.065), (0.07, 0.085, 0.09), field)
    strokes(img, "lining", 500, rng, length=(10, 24), width=(2, 5), angle=0.0, angle_jit=0.4, jitter=0.15)

    # ---- scarf: chunky knit. x runs along the scarf, y around the roll.
    x0, y0, w, h = REGIONS["scarf"]
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    rib = 0.5 + 0.5 * np.cos(xs / 9.0 * 2 * np.pi)  # ribs across the scarf every 9 px
    vst = 0.5 + 0.5 * np.cos((ys + np.abs(((xs % 9.0) - 4.5)) * 1.4) / 7.0 * 2 * np.pi)  # V stitches
    roll = np.sin(ys / h * np.pi)  # light on the top of the roll
    field = value_noise(h, w, 3, 24, rng)
    t = 0.35 + 0.35 * rib * vst + 0.2 * roll + 0.15 * (field - 0.5)
    base = mix(SCARF_DARK, SCARF, np.clip(t * 1.3, 0, 1))
    base = mix(base, SCARF_HI, np.clip((t - 0.62) * 2.2, 0, 1))
    # a darker rust weave line every 64 px (a wrapped, hand-made look)
    stripe = np.abs(((xs % 64.0) - 32.0)) < 2.5
    base[stripe] = mix(base[stripe], RUST, 0.55)
    img[y0 : y0 + h, x0 : x0 + w] = base
    strokes(img, "scarf", 900, rng, length=(6, 14), width=(2.0, 3.5), angle=1.5708, angle_jit=0.35, jitter=0.08)

    # ---- hair: blue-black strands, y along the lock (root at the top)
    x0, y0, w, h = REGIONS["hair"]
    field = value_noise(h, w, 2, 12, rng)
    img[y0 : y0 + h, x0 : x0 + w] = mix((0.02, 0.03, 0.04), (0.06, 0.08, 0.1), field)
    strokes(img, "hair", 900, rng, length=(30, 80), width=(1.2, 2.6), angle=0.0, angle_jit=0.08, jitter=0.3, lift=0.0)
    x0, y0, w, h = REGIONS["hair"]
    sub = img[y0 : y0 + h, x0 : x0 + w]
    for _ in range(140):  # teal highlight strands
        cx = rng.uniform(0, w)
        top = rng.uniform(0, h * 0.5)
        ln = rng.uniform(40, 140)
        ys = np.arange(int(top), int(min(h, top + ln)))
        xs = (cx + np.sin(ys / rng.uniform(18, 40)) * 3.0).astype(int) % w
        a = np.sin(np.linspace(0, np.pi, ys.size)) * rng.uniform(0.25, 0.6)
        sub[ys, xs] = sub[ys, xs] * (1 - a[:, None]) + np.asarray((0.16, 0.27, 0.3)) * a[:, None]

    # ---- face: the void, with a few cold stars
    x0, y0, w, h = REGIONS["face"]
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    field = value_noise(h, w, 3, 3, rng, wrap_x=False)
    vign = np.hypot((xs - w / 2) / w, (ys - h * 0.45) / h)
    img[y0 : y0 + h, x0 : x0 + w] = mix((0.03, 0.045, 0.085), (0.01, 0.012, 0.025), np.clip(vign * 1.6 + 0.2 * field, 0, 1))
    mid = lambda x, y: abs(x - w / 2) < w * 0.26 and h * 0.18 < y < h * 0.8  # noqa: E731 - front of the head only
    specks(img, "face", 70, rng, (0.55, 0.75, 1.0), size=(0.45, 0.9), alpha=(0.35, 0.9), mask_fn=mid)
    specks(img, "face", 6, rng, (0.95, 0.85, 0.6), size=(0.9, 1.4), alpha=(0.8, 1.0), mask_fn=mid)

    # ---- swatches
    sw = {
        "trousers": ((0.075, 0.075, 0.075), (0.13, 0.12, 0.11)),
        "leather": ((0.12, 0.07, 0.04), (0.24, 0.15, 0.09)),
        "wrap": ((0.2, 0.16, 0.11), (0.36, 0.3, 0.21)),
        "glove": ((0.05, 0.05, 0.055), (0.11, 0.1, 0.1)),
        "sleeve": (NAVY_DARK, NAVY),
        "cuff": (RUST, ORANGE),
        "sole": ((0.04, 0.03, 0.025), (0.08, 0.06, 0.05)),
        "skin": ((0.02, 0.025, 0.045), (0.05, 0.06, 0.09)),
    }
    for name, (c0, c1) in sw.items():
        x0, y0, w, h = REGIONS[name]
        f = value_noise(h, w, 2, 4, rng)
        img[y0 : y0 + h, x0 : x0 + w] = mix(c0, c1, f)
        sub = img[y0 : y0 + h, x0 : x0 + w]
        ys, xs = np.mgrid[0:h, 0:w].astype(float)
        if name == "wrap":  # bandage turns: diagonal strips with dark gaps
            gap = np.abs(((xs * 0.6 + ys) % 14.0) - 7.0) < 1.2
            sub[gap] = sub[gap] * 0.45
        if name == "cuff":  # a narrow woven band: gold rules, navy diamonds
            dd = np.abs(((xs % 24.0) - 12.0)) / 8.0 + np.abs(ys - h / 2) / (h * 0.28)
            sub[(dd < 1.0) & (dd > 0.5)] = NAVY_DARK
            sub[(ys < 7) | (ys > h - 8)] = GOLD
        strokes(img, name, 120, rng, length=(8, 22), width=(2, 4), angle=0.0, angle_jit=0.5, jitter=0.1, wrap_x=False)

    # canvas grain over everything
    grain = rng.normal(0.0, 0.012, (H, W, 1))
    img = np.clip(img * (1.0 + grain), 0.0, 1.0)
    return img


def write_png(path: str, img: np.ndarray) -> None:
    """8-bit RGB PNG with the Up filter on every row; deterministic bytes."""
    a = np.clip(np.rint(img * 255.0), 0, 255).astype(np.uint8)
    h, w, _ = a.shape
    up = a.astype(np.int16)
    up[1:] -= a[:-1].astype(np.int16)
    rows = (up % 256).astype(np.uint8).reshape(h, w * 3)
    raw = np.concatenate([np.full((h, 1), 2, np.uint8), rows], axis=1).tobytes()

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"sRGB", b"\x00") + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    import sys

    write_png(sys.argv[1] if len(sys.argv) > 1 else "wanderer_albedo.png", paint())
