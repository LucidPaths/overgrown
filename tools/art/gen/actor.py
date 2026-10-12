"""Actor bodies: every species drawn on the one shared humanoid skeleton (ART-005, OQ-020).

Limb positions come only from the Skeleton and sizes only from the Species row, so ART-006 can
animate by moving joints. Code branches on feature fields, never on species keys.
"""

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from lib import draw
from lib.anims import ANIM_KEYS, frame_count, pose_skeleton
from lib.atlas import Frame
from lib.context import Context
from lib.palette import Palette
from lib.skeleton import CELL, CENTRE_X, SOLE_Y, Point, Skeleton
from lib.species import SPECIES, Species

NAME = "actor"
ATLAS = "core"
# Straight above and in front, so mirrored right frames keep consistent lighting.
LIGHT = (0.0, -0.6, 0.8)

PALETTE = "actors"
DRAWN = ("down", "left", "up")  # right frames are np.fliplr of left, never drawn (A-24)
_VIEW = {"down": "front", "left": "side", "up": "back"}
_MARK = (255, 255, 255, 255)  # scratch colour for building masks with draw.line; never in a frame

Rgba = draw.Rgba
Mask = np.ndarray
_YS, _XS = np.mgrid[0:CELL, 0:CELL]


def frame_name(species_key: str, anim: str, direction: str, index: int) -> str:
    """The actor frame-name contract: actor/<species>/<anim>/<dir>/<i>."""
    return f"{NAME}/{species_key}/{anim}/{direction}/{index}"


# --- masks ---------------------------------------------------------------------------------


def _box(x0: int, y0: int, x1: int, y1: int) -> Mask:
    """Inclusive rectangle; parts outside the cell are dropped (the cell check sees the ring)."""
    return (_XS >= x0) & (_XS <= x1) & (_YS >= y0) & (_YS <= y1)


def _pixels(points: list[tuple[int, int]]) -> Mask:
    mask = np.zeros((CELL, CELL), bool)
    for x, y in points:
        if 0 <= x < CELL and 0 <= y < CELL:
            mask[y, x] = True
    return mask


def _disc(cx: float, cy: float, r: float) -> Mask:
    return draw.ellipse_mask(CELL, CELL, cx, cy, r, r)


def _shift(mask: Mask, dx: int, dy: int = 0) -> Mask:
    """mask moved by (dx, dy); pixels moved out of the cell are dropped."""
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(dy, 0) : h + min(dy, 0), max(dx, 0) : w + min(dx, 0)] = mask[
        max(-dy, 0) : h + min(-dy, 0), max(-dx, 0) : w + min(-dx, 0)
    ]
    return out


def _limb(a: Point, b: Point, width: int, toward: int) -> Mask:
    """Bresenham segment a..b, thickened by width-1 extra pixels in the x direction `toward`."""
    scratch = draw.canvas(CELL, CELL)
    draw.line(scratch, a.x, a.y, b.x, b.y, _MARK)
    seg = scratch[..., 3] == 255
    mask = seg.copy()
    for k in range(1, width):
        mask |= _shift(seg, toward * k)
    return mask


def _ring(mask: Mask) -> Mask:
    """Transparent pixels 4-adjacent to mask."""
    near = _shift(mask, 1) | _shift(mask, -1) | _shift(mask, 0, 1) | _shift(mask, 0, -1)
    return near & ~mask


# --- the body being drawn ------------------------------------------------------------------


@dataclass(frozen=True)
class _Body:
    img: np.ndarray
    sp: Species
    skel: Skeleton
    view: str  # "front" (down), "side" (left: facing smaller x) or "back" (up)
    pal: Palette
    body: list[Rgba]
    accent: list[Rgba]  # the body ramp for skin species, which have no accent features
    hair: list[Rgba]  # empty when the species has no hair
    hx0: int  # head box, inclusive
    hx1: int
    hy0: int
    hy1: int
    ey: int  # eye row

    @property
    def hx(self) -> int:
        return self.skel["head"].x

    def head_mask(self) -> Mask:
        box = _box(self.hx0, self.hy0, self.hx1, self.hy1)
        if self.sp.head_shape == "square":
            corners = [(x, y) for x in (self.hx0, self.hx1) for y in (self.hy0, self.hy1)]
            return box & ~_pixels(corners)
        w, h = self.sp.head_w, self.sp.head_h
        return box & draw.ellipse_mask(
            CELL, CELL, self.hx0 + w / 2, self.hy0 + h / 2, w / 2 + 0.6, h / 2 + 0.6
        )

    def shade(self, mask: Mask, ramp: list[Rgba]) -> None:
        if mask.any():
            draw.shade_sphere(self.img, mask, ramp, light=LIGHT)

    def shade_behind(self, mask: Mask, ramp: list[Rgba]) -> None:
        """Shade mask as one part, but only where nothing has been drawn yet."""
        scratch = draw.canvas(CELL, CELL)
        draw.shade_sphere(scratch, mask, ramp, light=LIGHT)
        free = mask & (self.img[..., 3] == 0)
        self.img[free] = scratch[free]

    def fill(self, mask: Mask, color: Rgba) -> None:
        draw.fill_mask(self.img, mask, color)

    def darken(self, mask: Mask, ramp: list[Rgba]) -> None:
        """Move every ramp-coloured pixel in mask one shade darker (texture without new colours)."""
        steps = []
        for i in range(1, len(ramp)):
            hit = mask & np.all(self.img == np.array(ramp[i], np.uint8), axis=-1)
            steps.append((hit, ramp[i - 1]))
        for hit, color in steps:
            self.img[hit] = np.array(color, np.uint8)


def _nothing(b: _Body) -> None:
    """Feature value that draws no pixels (ears "none", face "plain", tail "none", ...)."""


# --- covering textures ---------------------------------------------------------------------


def _scallop(mask: Mask) -> Mask:
    """2-shade feather scallops: a dark arc under every 3x2 cell, offset on alternate bands."""
    band = _YS // 2
    u = (_XS + band * 2) % 3
    return mask & (_YS % 2 == 1) & (u != 1)


def _checker(mask: Mask) -> Mask:
    return mask & ((_XS + _YS) % 2 == 0)


def _tufted(mask: Mask) -> Mask:
    """Fur: tufts sticking out of the silhouette at a fixed spacing along its edge."""
    return mask | (_ring(mask) & ((_XS + 2 * _YS) % 4 == 0))


def _texture(b: _Body, part: str, mask: Mask) -> None:
    """Covering texture on an already shaded body-ramp part."""
    match b.sp.covering, part:
        case "scales", ("arm" | "leg" | "tail"):
            b.darken(_checker(mask), b.body)
        case "feathers", ("arm" | "head"):
            b.darken(_scallop(mask), b.body)


# --- limbs, torso, clothes -----------------------------------------------------------------


def _toward_centre(x: int) -> int:
    return 1 if x + 0.5 < CENTRE_X else -1


def _leg_mask(b: _Body, side: str) -> Mask:
    hip, foot = b.skel[f"hip_{side}"], b.skel[f"foot_{side}"]
    width = max(2, b.sp.hip - 1)
    if b.view == "side":
        mask = _limb(hip, foot, width, 1) | _pixels([(foot.x - 1, foot.y)])  # toes point forward
    else:
        inward = _toward_centre(hip.x)
        mask = _limb(hip, foot, width, inward) | _pixels([(foot.x - inward, foot.y)])
    return mask


def _draw_arm(b: _Body, side: str, far: bool) -> None:
    """A 2 px arm from shoulder to hand, thickened outward (toward the back in profile)."""
    shoulder, hand = b.skel[f"shoulder_{side}"], b.skel[f"hand_{side}"]
    outward = 1 if b.view == "side" else -_toward_centre(shoulder.x)
    mask = _limb(shoulder, hand, 2, outward)
    ramp = b.body[:-1] if far else b.body
    if b.sp.covering == "feathers":
        # Feathered sleeve: a cream fringe hanging off the arm's outer (or back) edge.
        edge = _shift(mask, outward) & ~mask
        fringe = edge & (_YS >= shoulder.y + 2) & (_YS < hand.y) & (_YS % 2 == 0)
        b.fill(fringe, b.accent[1] if far else b.accent[2])
    b.shade(mask, ramp)
    _texture(b, "arm", mask)


def _draw_legs(b: _Body) -> Mask:
    """Both legs and feet; returns their union for the shorts."""
    union = np.zeros((CELL, CELL), bool)
    sides = ("r", "l") if b.skel.near == "l" else ("l", "r")  # far leg first in side views
    for i, side in enumerate(sides):
        mask = _leg_mask(b, side)
        far = b.view == "side" and i == 0
        b.shade(mask, b.body[:-1] if far else b.body)
        _texture(b, "leg", mask)
        union |= mask
    return union


def _torso_mask(b: _Body) -> Mask:
    neck, hips = b.skel["neck"], (b.skel["hip_l"], b.skel["hip_r"])
    shoulders = (b.skel["shoulder_l"], b.skel["shoulder_r"])
    top, bottom = shoulders[0].y, hips[0].y
    if b.view == "side":
        back = b.skel["tail_root"].x
        front = 2 * neck.x - back + 1
        body = _box(front, top, back, bottom)
        neck_row = _box(neck.x - 1, neck.y, neck.x + 1, neck.y)
    else:
        sx0, sx1 = min(p.x for p in shoulders) + 1, max(p.x for p in shoulders) - 1
        hx0, hx1 = min(p.x for p in hips), max(p.x for p in hips)
        body = np.zeros((CELL, CELL), bool)
        for y in range(top, bottom + 1):
            t = (y - top) / max(1, bottom - top)
            x0 = round(sx0 + (hx0 - sx0) * t)
            x1 = round(sx1 + (hx1 - sx1) * t)
            body |= _box(x0, y, x1, y)
        neck_row = _box(neck.x - 2, neck.y, neck.x + 1, neck.y)
    return body | neck_row


def _draw_torso_and_clothes(b: _Body, legs: Mask) -> None:
    torso = _torso_mask(b)
    b.shade(torso, b.body)
    shoulder_y, hip_y = b.skel["shoulder_l"].y, b.skel["hip_l"].y
    top = torso & (_YS >= shoulder_y) & (_YS <= hip_y)
    if b.view == "front":
        neck = b.skel["neck"]
        top &= ~_box(neck.x - 1, shoulder_y, neck.x, shoulder_y)  # V neckline
    b.shade(top, b.pal.ramp("cloth_linen"))
    shorts_rows = (_YS >= hip_y + 1) & (_YS <= hip_y + 2)
    span = legs & shorts_rows & (_YS == hip_y + 1)
    cols = np.nonzero(span.any(axis=0))[0]
    crotch = _box(int(cols.min()), hip_y + 1, int(cols.max()), hip_y + 1)
    b.shade((legs & shorts_rows) | crotch, b.pal.ramp("cloth_brown"))


# --- head features -------------------------------------------------------------------------


def _hair_short_mask(b: _Body) -> Mask:
    head = b.head_mask()
    match b.view:
        case "front":
            sideburns = _box(b.hx0, b.hy0, b.hx0, b.ey - 1) | _box(b.hx1, b.hy0, b.hx1, b.ey - 1)
            fringe = _pixels([(b.hx - 3, b.hy0 + 3), (b.hx - 2, b.hy0 + 3), (b.hx + 1, b.hy0 + 3)])
            return head & (_box(b.hx0, b.hy0, b.hx1, b.hy0 + 2) | sideburns | fringe)
        case "side":
            back = _box(b.hx + 1, b.hy0, b.hx1, b.hy1 - 2)
            fringe = _pixels([(b.hx0 + 1, b.hy0 + 3), (b.hx0 + 2, b.hy0 + 3)])
            return head & (_box(b.hx0, b.hy0, b.hx1, b.hy0 + 2) | back | fringe)
        case _:
            return head & (_YS <= b.hy1 - 2)


def _hair_short(b: _Body) -> None:
    b.shade(_hair_short_mask(b), b.hair)


def _hair_long(b: _Body) -> None:
    head = b.head_mask()
    neck_y, shoulder_y = b.skel["neck"].y, b.skel["shoulder_l"].y
    match b.view:
        case "front":
            curtains = _box(b.hx0 - 1, b.hy0 + 2, b.hx0, b.hy1) | _box(
                b.hx1, b.hy0 + 2, b.hx1 + 1, b.hy1
            )
            hanging = _box(b.hx0 - 1, neck_y, b.hx0 + 1, shoulder_y + 3) | _box(
                b.hx1 - 1, neck_y, b.hx1 + 1, shoulder_y + 3
            )
            b.shade_behind(hanging, b.hair)
            b.shade(_hair_short_mask(b) | curtains, b.hair)
        case "side":
            hanging = _box(b.hx + 1, b.hy1 - 1, b.hx1 + 1, shoulder_y + 3)
            b.shade_behind(hanging, b.hair)
            b.shade(_hair_short_mask(b) | (head & _box(b.hx + 1, b.hy0, b.hx1, b.hy1)), b.hair)
        case _:
            hanging = _box(b.hx0 + 1, b.hy1 - 1, b.hx1 - 1, shoulder_y + 3)
            b.shade(head | hanging, b.hair)


def _hair_short_beard(b: _Body) -> None:
    head = b.head_mask()
    match b.view:
        case "front":
            beard = head & (
                (_YS >= b.ey + 2)
                | _box(b.hx0, b.ey, b.hx0 + 1, b.hy1)
                | _box(b.hx1 - 1, b.ey, b.hx1, b.hy1)
            )
            b.shade(beard, b.hair)
            b.fill(_box(b.hx - 1, b.ey + 2, b.hx, b.ey + 2), b.body[1])  # mouth
        case "side":
            b.shade(head & _box(b.hx0, b.ey + 1, b.hx, b.hy1), b.hair)
    _hair_short(b)


def _hair_crest(b: _Body) -> None:
    x, y = b.hx, b.hy0
    if b.view == "side":
        crest = [(x - 1, y - 1), (x, y - 1), (x + 1, y - 1), (x + 1, y - 2), (x + 2, y - 2)]
        crest += [(x + 2, y - 3), (x + 3, y - 3), (x + 3, y - 1), (x + 4, y - 2)]
    else:
        crest = [(x - 1, y - 1), (x, y - 1), (x - 1, y - 2), (x, y - 2), (x - 1, y - 3)]
        crest += [(x, y - 3), (x - 3, y - 1), (x - 3, y - 2), (x + 2, y - 1), (x + 2, y - 2)]
    b.shade(_pixels(crest) | (b.head_mask() & (_YS <= y + 1)), b.hair)


_HAIR: dict[str, Callable[[_Body], None]] = {
    "none": _nothing,
    "short": _hair_short,
    "long": _hair_long,
    "short_beard": _hair_short_beard,
    "crest": _hair_crest,
}


def _mirror_pairs(b: _Body, offsets: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """(outward, dy) offsets from the head's sides, placed on both sides around the eye row."""
    out = []
    for o, dy in offsets:
        out += [(b.hx0 - o, b.ey + dy), (b.hx1 + o, b.ey + dy)]
    return out


def _top_pairs(b: _Body, offsets: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """(inward, dy) offsets from the head box's top corners, placed on both sides."""
    out = []
    for i, dy in offsets:
        out += [(b.hx0 + i, b.hy0 + dy), (b.hx1 - i, b.hy0 + dy)]
    return out


def _ears_pointed(b: _Body) -> None:
    if b.view == "side":
        x, y = b.hx + 1, b.ey
        ear = [(x, y), (x, y - 1), (x + 1, y - 1), (x + 1, y - 2), (x + 2, y - 2), (x + 3, y - 3)]
        b.shade(_pixels(ear), b.body[:-1])
        return
    tip = [(1, 0), (1, -1), (2, -1), (2, -2), (3, -2), (3, -3)]
    b.shade(_pixels(_mirror_pairs(b, tip)), b.body)


def _ears_fox(b: _Body) -> None:
    if b.view == "side":
        x, y = b.hx - 1, b.hy0
        rows = [
            (0, x, x + 4),
            (-1, x, x + 3),
            (-2, x + 1, x + 3),
            (-3, x + 2, x + 3),
            (-4, x + 3, x + 3),
        ]
        ear = np.zeros((CELL, CELL), bool)
        for dy, x0, x1 in rows:
            ear |= _box(x0, y + dy, x1, y + dy)
        b.shade(ear, b.body)
        b.fill(_pixels([(x + 1, y - 1), (x + 2, y - 1), (x + 2, y - 2)]), b.pal.color("ear_inner"))
        return
    widths = [(1, 5), (0, 4), (-1, 3), (-2, 2), (-3, 1), (-4, 1)]
    ear = _pixels(_top_pairs(b, [(i, dy) for dy, w in widths for i in range(w)]))
    b.shade(ear, b.body)
    if b.view == "front":
        inner = _top_pairs(b, [(1, -1), (2, -1), (1, -2)])
        b.fill(_pixels(inner), b.pal.color("ear_inner"))


def _ears_rabbit(b: _Body) -> None:
    x, y = b.hx, b.hy0
    if b.view == "side":
        cols = [(x, x + 2), (x + 1, x + 3)]
    else:
        cols = [(x - 4, x - 2), (x + 1, x + 3)]
    for x0, x1 in cols:
        ear = _box(x0, y - 3, x1, y + 1) | _box(x0 + 1, y - 4, x1 - 1, y - 4)
        b.shade(ear, b.body)
        if b.view != "back":
            b.fill(_box(x0 + 1, y - 3, x0 + 1, y - 1), b.pal.color("ear_inner"))


def _ears_bear(b: _Body) -> None:
    x, y = b.hx, b.hy0
    if b.view == "side":
        centres = [x + 1.5]
    else:
        centres = [b.hx0 + 1.5, b.hx1 - 0.5]
    for cx in centres:
        b.shade(_disc(cx, y, 2.0), b.body)
        if b.view != "back":
            b.fill(_pixels([(int(cx - 0.5), y - 1)]), b.body[0])


_EARS: dict[str, Callable[[_Body], None]] = {
    "none": _nothing,
    "pointed": _ears_pointed,
    "fox": _ears_fox,
    "rabbit": _ears_rabbit,
    "bear": _ears_bear,
}


def _snout(b: _Body, rows: list[tuple[int, int, int]], ramp: list[Rgba]) -> Mask:
    """Side-view snout: (dy from the eye row, first x, last x) rows; returns the mask."""
    mask = np.zeros((CELL, CELL), bool)
    for dy, x0, x1 in rows:
        mask |= _box(x0, b.ey + dy, x1, b.ey + dy)
    b.shade(mask, ramp)
    return mask


def _face_tusks(b: _Body) -> None:
    if b.view == "front":
        tusks = [(b.hx - 3, b.hy1), (b.hx - 3, b.hy1 - 1), (b.hx + 2, b.hy1), (b.hx + 2, b.hy1 - 1)]
    else:
        tusks = [(b.hx0 + 1, b.hy1), (b.hx0 + 1, b.hy1 - 1)]
    b.fill(_pixels(tusks), b.pal.color("tusk"))


def _face_muzzle(b: _Body) -> None:
    eye = b.pal.color("eye")
    if b.view == "front":
        b.shade(
            b.head_mask() & draw.ellipse_mask(CELL, CELL, float(b.hx), b.ey + 2.5, 2.6, 1.8),
            b.accent,
        )
        b.fill(_box(b.hx - 1, b.ey + 1, b.hx, b.ey + 1), eye)
    else:
        _snout(
            b,
            [(1, b.hx0 - 1, b.hx0 + 2), (2, b.hx0 - 1, b.hx0 + 2), (3, b.hx0, b.hx0 + 1)],
            b.accent,
        )
        b.fill(_pixels([(b.hx0 - 1, b.ey + 1)]), eye)


def _face_snout_fox(b: _Body) -> None:
    eye = b.pal.color("eye")
    if b.view == "front":
        cheeks = b.head_mask() & (_YS >= b.ey + 1) & ~_box(b.hx - 1, b.ey + 1, b.hx, b.ey + 1)
        b.shade(cheeks, b.accent)
        b.fill(_box(b.hx - 1, b.ey + 2, b.hx, b.ey + 2), eye)
    else:
        _snout(b, [(0, b.hx0 - 2, b.hx0), (1, b.hx0 - 3, b.hx0)], b.body)
        _snout(b, [(2, b.hx0 - 2, b.hx0 + 2), (3, b.hx0, b.hx0 + 3)], b.accent)
        b.fill(_pixels([(b.hx0 - 3, b.ey + 1)]), eye)


def _face_snout_bear(b: _Body) -> None:
    eye = b.pal.color("eye")
    if b.view == "front":
        b.shade(draw.ellipse_mask(CELL, CELL, float(b.hx), b.ey + 2.5, 3.0, 2.0), b.accent)
        b.fill(_box(b.hx - 1, b.ey + 1, b.hx, b.ey + 1), eye)
    else:
        _snout(
            b,
            [(1, b.hx0 - 2, b.hx0 + 1), (2, b.hx0 - 2, b.hx0 + 1), (3, b.hx0 - 1, b.hx0 + 1)],
            b.accent,
        )
        b.fill(_pixels([(b.hx0 - 2, b.ey + 1)]), eye)


def _face_snout_lizard(b: _Body) -> None:
    eye = b.pal.color("eye")
    if b.view == "front":
        b.shade(b.head_mask() & (_YS >= b.hy1 - 1) & _box(b.hx - 3, 0, b.hx + 2, CELL), b.accent)
        b.fill(_pixels([(b.hx - 2, b.ey + 2), (b.hx + 1, b.ey + 2)]), eye)
    else:
        _snout(b, [(0, b.hx0 - 3, b.hx0), (1, b.hx0 - 4, b.hx0), (2, b.hx0 - 4, b.hx0)], b.body)
        _snout(b, [(3, b.hx0 - 3, b.hx0 + 3)], b.accent)
        b.fill(_pixels([(b.hx0 - 3, b.ey + 1)]), eye)


def _face_beak(b: _Body) -> None:
    beak = b.pal.ramp("beak")
    if b.view == "front":
        rows = _box(b.hx - 2, b.ey + 1, b.hx + 1, b.ey + 1) | _box(
            b.hx - 1, b.ey + 2, b.hx, b.ey + 3
        )
        b.shade(rows, beak)
    else:
        _snout(b, [(0, b.hx0 - 2, b.hx0), (1, b.hx0 - 3, b.hx0), (2, b.hx0 - 2, b.hx0 - 1)], beak)


_FACES: dict[str, Callable[[_Body], None]] = {
    "plain": _nothing,
    "tusks": _face_tusks,
    "muzzle": _face_muzzle,
    "snout_fox": _face_snout_fox,
    "snout_bear": _face_snout_bear,
    "snout_lizard": _face_snout_lizard,
    "beak": _face_beak,
}


def _draw_eyes(b: _Body) -> None:
    eye = b.pal.color("eye")
    if b.view == "front":
        e = (b.sp.head_w - 1) // 4
        b.fill(_pixels([(b.hx - 1 - e, b.ey), (b.hx + e, b.ey)]), eye)
    else:
        b.fill(_pixels([(b.hx0 + 2, b.ey)]), eye)


def _draw_head(b: _Body) -> None:
    head = b.head_mask()
    if b.sp.covering == "fur":
        # Fur: tufted cheeks, at the sides in front and back views and the jaw's back in profile.
        if b.view == "side":
            tufts = [(b.hx1, b.hy1 - 1), (b.hx1 + 1, b.hy1 - 2), (b.hx1 - 1, b.hy1 + 1)]
        else:
            tufts = _mirror_pairs(b, [(1, 1), (1, 2), (2, 2)])
        head |= _pixels(tufts)
    b.shade(head, b.body[1:])  # faces stay light: the darkest shade is for far limbs and edges
    if b.view == "back":
        _texture(b, "head", head)
    _HAIR[b.sp.hair](b)
    _EARS[b.sp.ears](b)
    if b.view != "back":
        _FACES[b.sp.face](b)
        _draw_eyes(b)


# --- tails ---------------------------------------------------------------------------------

# Disc paths (dx, dy, r) from tail_root. dx is backward in profile, toward the character's own
# left in front and back views. The last `tip` discs use the accent ramp.
_TAIL_PATHS: dict[str, dict[str, list[tuple[int, int, float]]]] = {
    "fox": {
        "side": [(1, 0, 2.0), (3, -1, 2.5), (5, -3, 2.5), (6, -5, 2.0)],
        "front": [(3, 1, 2.0), (5, 0, 2.5), (7, -2, 2.5), (8, -4, 2.0)],
        "back": [(0, 1, 2.0), (1, 2, 2.5), (3, 3, 2.2), (5, 2, 2.0)],
    },
    "rabbit": {
        "side": [(1, 0, 2.2)],
        "front": [(0, 0, 2.2)],
        "back": [(0, 0, 2.2)],
    },
    "bear": {
        "side": [(1, 0, 1.6)],
        "front": [(0, 0, 1.6)],
        "back": [(0, 0, 1.6)],
    },
    "lizard": {
        "side": [(1, 1, 2.5), (3, 3, 2.2), (5, 5, 1.8), (7, 6, 1.5), (9, 6, 1.0)],
        "front": [(2, 2, 2.2), (4, 4, 2.0), (6, 5, 1.6), (8, 6, 1.2)],
        "back": [(0, 1, 2.0), (0, 3, 1.9), (1, 5, 1.7), (3, 6, 1.3), (5, 6, 1.0)],
    },
}
_TAIL_TIP = {"fox": 1, "rabbit": 1, "bear": 0, "lizard": 0}  # discs drawn in the accent ramp


def _draw_tail(b: _Body) -> None:
    if b.sp.tail == "none":
        return
    root = b.skel["tail_root"]
    # The character's own left is screen-right facing down and screen-left facing up.
    sign = -1 if b.view == "back" else 1
    path = _TAIL_PATHS[b.sp.tail][b.view]
    tip = _TAIL_TIP[b.sp.tail]
    discs = [_disc(root.x + sign * dx + 0.5, root.y + dy + 0.5, r) for dx, dy, r in path]
    base = np.zeros((CELL, CELL), bool)
    for d in discs[: len(discs) - tip]:
        base |= d
    end = np.zeros((CELL, CELL), bool)
    for d in discs[len(discs) - tip :]:
        end |= d
    if b.sp.covering == "fur":
        base, end = _tufted(base), _tufted(end)
    b.shade(base & ~end, b.body)
    b.shade(end, b.accent)
    _texture(b, "tail", base & ~end)


# --- the body ------------------------------------------------------------------------------


def _cell_check(img: np.ndarray, species: Species, direction: str) -> None:
    opaque = img[..., 3] == 255
    ring = opaque[0].any() or opaque[-1].any() or opaque[:, 0].any() or opaque[:, -1].any()
    if ring:
        ys, xs = np.nonzero(opaque & ~_box(1, 1, CELL - 2, CELL - 2))
        raise ValueError(
            f"actor {species.key}/{direction}: opaque pixel on the cell's outer ring at "
            f"({xs[0]}, {ys[0]}); the body was clipped"
        )
    lowest = int(np.nonzero(opaque.any(axis=1))[0].max())
    if lowest != SOLE_Y + 1:
        raise ValueError(
            f"actor {species.key}/{direction}: lowest opaque row is {lowest}, "
            f"expected {SOLE_Y + 1} (outline under the soles)"
        )


def draw_body(ctx: Context, species: Species, skel: Skeleton, direction: str) -> np.ndarray:
    """CELL x CELL RGBA body for one direction, outline applied, cell check passed."""
    if direction not in DRAWN:
        raise ValueError(
            f"actor {species.key}/{direction}: draw_body draws {DRAWN}; "
            "right frames are np.fliplr of left frames"
        )
    if (skel.near is None) != (direction != "left"):
        raise ValueError(
            f"actor {species.key}/{direction}: skeleton near={skel.near!r} does not fit the view"
        )
    pal = ctx.palette(PALETTE)
    head = skel["head"]
    hx0 = head.x - species.head_w // 2
    hy0 = head.y - species.head_h // 2
    body_ramp = pal.ramp(species.body_ramp)
    b = _Body(
        img=draw.canvas(CELL, CELL),
        sp=species,
        skel=skel,
        view=_VIEW[direction],
        pal=pal,
        body=body_ramp,
        accent=body_ramp if species.accent_ramp is None else pal.ramp(species.accent_ramp),
        hair=[] if species.hair_ramp is None else pal.ramp(species.hair_ramp),
        hx0=hx0,
        hx1=hx0 + species.head_w - 1,
        hy0=hy0,
        hy1=hy0 + species.head_h - 1,
        ey=head.y + 1,
    )
    if b.view != "back":
        _draw_tail(b)  # behind the body
    if skel.near is not None:
        _draw_arm(b, "r" if skel.near == "l" else "l", far=True)
    legs = _draw_legs(b)
    _draw_torso_and_clothes(b, legs)
    if skel.near is not None:
        _draw_arm(b, skel.near, far=False)
    else:
        _draw_arm(b, "l", far=False)
        _draw_arm(b, "r", far=False)
    _draw_head(b)
    if b.view == "back":
        _draw_tail(b)  # over the back
    draw.outline(b.img, pal.color("outline"))
    _cell_check(b.img, species, direction)
    return b.img


def generate(ctx: Context) -> list[Frame]:
    frames = []
    for species in SPECIES:
        for anim in ANIM_KEYS:
            for index in range(frame_count(anim)):
                images: dict[str, np.ndarray] = {}
                for direction in DRAWN:
                    try:
                        skel = pose_skeleton(species, anim, direction, index)
                        images[direction] = draw_body(ctx, species, skel, direction)
                    except ValueError as err:
                        name = frame_name(species.key, anim, direction, index)
                        raise ValueError(f"{name}: {err}") from err
                images["right"] = np.fliplr(images["left"]).copy()  # A-24: mirrored, never drawn
                for direction in ("down", "left", "right", "up"):
                    name = frame_name(species.key, anim, direction, index)
                    frames.append(Frame(name, draw.to_image(images[direction])))
    return frames
