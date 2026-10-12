"""Actor bodies: every species drawn on the one shared humanoid skeleton (ART-005, ART-024, OQ-020).

Limb positions come only from the Skeleton and sizes only from the Species row, so animation is moving joints.
Heads and tails are the hand-authored templates in gen/heads.py. Every pixel is a (ramp, shade) pair; the final
colours and the selective outline (docs/art/DIRECTION.md section 4) are resolved last, from the actor palette.
Code branches on feature fields (covering, tail), never on species keys.
"""

from dataclasses import dataclass, field

import numpy as np

from gen import heads
from lib import draw
from lib.anims import ANIM_KEYS, Pose, frame_count, pose_for, pose_skeleton
from lib.atlas import Frame
from lib.context import Context
from lib.palette import Palette
from lib.skeleton import CELL, CENTRE_X, SOLE_Y, Point, Skeleton
from lib.species import SPECIES, Species

NAME = "actor"
ATLAS = "core"
PALETTE = "actors"
DRAWN = ("down", "left", "up")  # right frames are np.fliplr of left, never drawn (A-24)
_VIEW = {"down": "front", "left": "side", "up": "back"}

Rgba = draw.Rgba
Mask = np.ndarray
_YS, _XS = np.mgrid[0:CELL, 0:CELL]
_MARK = (255, 255, 255, 255)  # scratch colour for building masks with draw.line; never in a frame

# Shade indices into a six-step actor ramp (docs/art/DIRECTION.md section 1.2).
LINE, DEEP, SHADOW, BASE, LIGHT, HIGH = range(6)


def frame_name(species_key: str, anim: str, direction: str, index: int) -> str:
    """The actor frame-name contract: actor/<species>/<anim>/<dir>/<i>."""
    return f"{NAME}/{species_key}/{anim}/{direction}/{index}"


# --- masks ---------------------------------------------------------------------------------


def _box(x0: int, y0: int, x1: int, y1: int) -> Mask:
    """Inclusive rectangle; parts outside the cell are dropped (the cell check sees the ring)."""
    return (_XS >= x0) & (_XS <= x1) & (_YS >= y0) & (_YS <= y1)


def _shift(mask: Mask, dx: int, dy: int = 0) -> Mask:
    """mask moved by (dx, dy); pixels moved out of the cell are dropped."""
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(dy, 0) : h + min(dy, 0), max(dx, 0) : w + min(dx, 0)] = mask[
        max(-dy, 0) : h + min(-dy, 0), max(-dx, 0) : w + min(-dx, 0)
    ]
    return out


def _limb(a: Point, b: Point, width: int, outward: int) -> Mask:
    """Bresenham segment a..b, thickened to `width` columns from the joint toward `outward` (+1 or -1)."""
    scratch = draw.canvas(CELL, CELL)
    draw.line(scratch, a.x, a.y, b.x, b.y, _MARK)
    seg = scratch[..., 3] == 255
    mask = seg.copy()
    for k in range(1, width):
        mask |= _shift(seg, outward * k)
    return mask


def _top_edge(mask: Mask) -> Mask:
    """Pixels of mask with no mask pixel directly above."""
    return mask & ~_shift(mask, 0, 1)


def _bottom_edge(mask: Mask) -> Mask:
    return mask & ~_shift(mask, 0, -1)


# --- the sheet: every pixel is (ramp, shade) -----------------------------------------------


@dataclass
class Sheet:
    ramps: list[list[Rgba]]
    roles: dict[str, int]
    species: str  # the species key, for error messages
    own: np.ndarray = field(default_factory=lambda: np.full((CELL, CELL), -1, np.int16))
    sh: np.ndarray = field(default_factory=lambda: np.zeros((CELL, CELL), np.int16))

    def filled(self) -> Mask:
        return self.own >= 0

    def paint(self, mask: Mask, role: str, shade: int | np.ndarray) -> None:
        if role not in self.roles:
            raise ValueError(
                f"{self.species}: painting needs the {role} ramp but the species has no {role}_ramp"
            )
        self.own[mask] = self.roles[role]
        self.sh[mask] = shade[mask] if isinstance(shade, np.ndarray) else shade

    def paint_template(self, rows: list[str], x0: int, y0: int, where: str) -> Mask:
        """Draw a template with its top-left cell at (x0, y0); returns the mask it covered.

        `where` names the template (species/view) in errors. A letter whose role the species has no ramp for raises.
        """
        for ch in sorted({c for row in rows for c in row} - set(heads.BLANK)):
            role = heads.LEGEND[ch][0]
            if role not in self.roles:
                raise ValueError(
                    f"{where}: template uses {ch!r} ({role} ramp) but the species has no {role}_ramp"
                )
        covered = np.zeros((CELL, CELL), bool)
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch in heads.BLANK:
                    continue
                x, y = x0 + dx, y0 + dy
                if y > SOLE_Y:  # hanging beards and hair are cut at the sole line (a deep crouch)
                    continue
                if not (0 <= x < CELL and 0 <= y):
                    raise ValueError(f"template pixel {ch!r} at ({x}, {y}) is off the cell")
                role, shade = heads.LEGEND[ch]
                self.own[y, x] = self.roles[role]
                self.sh[y, x] = shade
                covered[y, x] = True
        return covered

    def darken(self, mask: Mask, steps: int = 1) -> None:
        """Move every filled pixel in mask `steps` shades toward the line colour (min DEEP: never the line)."""
        hit = mask & self.filled() & (self.sh > DEEP)
        self.sh[hit] = np.maximum(self.sh[hit] - steps, DEEP)

    def lighten(self, mask: Mask, steps: int = 1) -> None:
        hit = mask & self.filled()
        top = np.array([len(r) - 1 for r in self.ramps])
        self.sh[hit] = np.minimum(self.sh[hit] + steps, top[self.own[hit]])

    def outline(self) -> None:
        """Selective outline: 1 px around the silhouette in the ramp's own line colour (docs section 4).

        A pixel above a filled one (a lit top edge) uses the ramp's deep shade instead of its line colour.
        """
        solid = self.filled()
        pad_own = np.pad(self.own, 1, constant_values=-1)
        pad_solid = np.pad(solid, 1)
        h, w = solid.shape
        ring = np.zeros_like(solid)
        owner = np.full((h, w), -1, np.int16)
        shade = np.zeros((h, w), np.int16)
        # order = priority: the part below wins (it owns the shadow the line belongs to), then the sides, then above
        for dy, dx, line in ((1, 0, DEEP), (0, -1, LINE), (0, 1, LINE), (-1, 0, LINE)):
            nb_solid = pad_solid[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
            nb_own = pad_own[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
            take = ~solid & ~ring & nb_solid
            owner[take] = nb_own[take]
            shade[take] = line
            ring |= take
        self.own[ring] = owner[ring]
        self.sh[ring] = shade[ring]

    def render(self) -> np.ndarray:
        img = draw.canvas(CELL, CELL)
        for rid, ramp in enumerate(self.ramps):
            hit = self.own == rid
            if hit.any():
                colours = np.array(ramp, np.uint8)
                img[hit] = colours[np.minimum(self.sh[hit], len(ramp) - 1)]
        return img


def _sheet(pal: Palette, sp: Species) -> Sheet:
    ramps: list[list[Rgba]] = []
    roles: dict[str, int] = {}

    def add(role: str, ramp: list[Rgba]) -> None:
        roles[role] = len(ramps)
        ramps.append(ramp)

    body = pal.ramp(sp.body_ramp)
    add("body", body)
    # Only the roles the species has a ramp for are registered: a template letter for any other role is an
    # error in paint_template, never a silent body-colour pixel.
    for role, name in (
        ("accent", sp.accent_ramp),
        ("hair", sp.hair_ramp),
        ("extra", sp.extra_ramp),
    ):
        if name is not None:
            add(role, pal.ramp(name))
    add("cloth", pal.ramp(sp.cloth_ramp))
    add("legwear", pal.ramp(sp.legwear_ramp))
    add("boot", pal.ramp("cloth_leather"))
    add("pink", pal.ramp("pink"))
    add("tusk", pal.ramp("tusk"))
    add("eye", [pal.color("eye")])
    add("shine", [pal.color("eye_shine")])
    return Sheet(ramps, roles, sp.key)


def _shape_shade(mask: Mask, light_rows: int = 1, shadow_rows: int = 1) -> np.ndarray:
    """Shade map for one rounded part lit from above: light on its top rows, shadow on its bottom rows."""
    shade = np.full((CELL, CELL), BASE, np.int16)
    top = mask.copy()
    for _ in range(light_rows):
        edge = _top_edge(top)
        shade[edge & mask] = LIGHT
        top &= ~edge
    bottom = mask.copy()
    for _ in range(shadow_rows):
        edge = _bottom_edge(bottom)
        shade[edge & mask] = SHADOW
        bottom &= ~edge
    return shade


# --- the body ------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Body:
    sheet: Sheet
    sp: Species
    skel: Skeleton
    view: str  # "front" (down), "side" (left: facing smaller x) or "back" (up)
    pose: Pose


def _texture(b: _Body, mask: Mask) -> None:
    """The covering's material on a limb: scales are a sparse diagonal of shaded pixels, feathers a scalloped edge."""
    body = b.sheet.own == b.sheet.roles["body"]
    if b.sp.covering == "scales":
        b.sheet.darken(mask & body & ((_XS + 2 * _YS) % 4 == 0))
    elif b.sp.covering == "feathers":
        b.sheet.lighten(mask & body & (_XS % 2 == 0) & _bottom_edge(mask & body))


def _outward(b: _Body, joint_x: int) -> int:
    """Which way a limb at joint_x thickens: toward the back in profile, away from the centre line otherwise."""
    if b.view == "side":
        return 1
    return -1 if joint_x + 0.5 < CENTRE_X else 1


def _draw_legs(b: _Body) -> None:
    """Both legs with shorts, feet and, for skin species, boots."""
    sp, sheet = b.sp, b.sheet
    sides = ("r", "l") if b.skel.near == "l" else ("l", "r")  # far leg first in profile
    hip_y = b.skel["hip_l"].y
    legs = np.zeros((CELL, CELL), bool)
    for i, side in enumerate(sides):
        hip, foot = b.skel[f"hip_{side}"], b.skel[f"foot_{side}"]
        out = _outward(b, hip.x)
        leg = _limb(Point(hip.x, hip.y + 1), foot, sp.leg_w, out)
        # the foot: one column wider than the leg and two rows tall; in profile the toes point forward
        toe = -1 if b.view == "side" else out
        toe_cols = _limb(Point(foot.x, foot.y - 1), foot, sp.leg_w, out)
        leg |= toe_cols | _shift(toe_cols, toe)
        legs |= leg
        shade = _shape_shade(leg, light_rows=0, shadow_rows=1)
        if b.view != "side":  # the inner column faces the gap between the legs
            shade[leg & (_XS == hip.x)] = np.minimum(shade[leg & (_XS == hip.x)], SHADOW)
        sheet.paint(
            leg, "extra" if sp.covering == "feathers" else "body", shade
        )  # birds stand on talons
        if sp.covering == "skin":  # boots: the lower three rows
            boot = leg & (_YS >= foot.y - 2) & (_YS > hip.y + 2)
            sheet.paint(boot, "boot", _shape_shade(boot, light_rows=1, shadow_rows=1))
        _texture(b, leg)
        if b.view == "side" and i == 0:
            sheet.darken(leg)  # the far leg sits in shade
    # shorts: one garment over both legs, with the crotch filled between them in front and back views
    cover = legs & (_YS >= hip_y + 1) & (_YS <= hip_y + 2)
    if b.view != "side":
        cols = np.nonzero(cover.any(axis=0))[0]
        cover = _box(int(cols.min()), hip_y + 1, int(cols.max()), hip_y + 2)
    sheet.paint(cover, "legwear", _shape_shade(cover, 0, 1))
    sheet.darken(legs & (_YS == hip_y + 3))  # the hem's contact shadow


def _torso_mask(b: _Body) -> Mask:
    sp = b.sp
    hip_y = b.skel["hip_l"].y
    top = b.skel["shoulder_l"].y
    c = int(CENTRE_X)
    mask = np.zeros((CELL, CELL), bool)
    if b.view == "side":
        front = c - sp.depth // 2
        mask |= _box(front, top, front + sp.depth - 1, hip_y)
    else:
        for y in range(top, hip_y + 1):
            t = (y - top) / max(1, hip_y - top)
            half = round(sp.shoulder + (sp.hip - sp.shoulder) * t)
            mask |= _box(c - half, y, c + half - 1, y)
    return mask


def _draw_torso(b: _Body) -> None:
    sheet = b.sheet
    torso = _torso_mask(b)
    hip_y = b.skel["hip_l"].y
    sheet.paint(torso, "cloth", _shape_shade(torso, light_rows=1, shadow_rows=1))
    belt = torso & (_YS == hip_y - 1)
    sheet.paint(belt, "boot", BASE)


def _draw_arm(b: _Body, side: str, far: bool) -> None:
    sp, sheet = b.sp, b.sheet
    shoulder, hand = b.skel[f"shoulder_{side}"], b.skel[f"hand_{side}"]
    out = _outward(b, shoulder.x)
    arm = _limb(shoulder, hand, sp.arm_w, out)
    sheet.paint(arm, "body", _shape_shade(arm, 0, 1))
    sleeve = arm & (_YS <= shoulder.y + 2)
    shade = _shape_shade(sleeve, 1, 1)
    sheet.paint(sleeve, "cloth", shade)
    if b.view != "side":  # the inner column faces the torso
        inner = arm & (_XS == shoulder.x)
        sheet.darken(inner & ~(_YS == shoulder.y))
    _texture(b, arm & (_YS > shoulder.y + 2))
    handpx = arm & (_YS >= hand.y - 1)
    sheet.paint(handpx, "body", np.where(_YS == hand.y, BASE, LIGHT))
    if far:
        sheet.darken(arm)


def _draw_head(b: _Body) -> None:
    tpl = heads.template(b.sp.key, b.view)
    head = b.skel["head"]
    x0 = head.x - tpl.width // 2
    y0 = head.y - tpl.chin_row
    covered = b.sheet.paint_template(tpl.rows, x0, y0, f"{b.sp.key}/{b.view}")
    # the head's bottom edge shades the collar and the shoulders under it
    b.sheet.darken(_shift(covered, 0, 1) & ~covered)


def _draw_tail(b: _Body) -> None:
    tpl = heads.tail(b.sp.tail, b.view)
    if tpl is None:
        return
    root = b.skel["tail_root"]
    x0 = root.x - tpl.anchor[0] + b.pose.tail[0]
    y0 = root.y - tpl.anchor[1] + b.pose.tail[1]
    b.sheet.paint_template(list(tpl.rows), x0, y0, f"{b.sp.key} tail/{b.view}")


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


def draw_body(
    ctx: Context, species: Species, skel: Skeleton, direction: str, pose: Pose | None = None
) -> np.ndarray:
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
    b = _Body(_sheet(pal, species), species, skel, _VIEW[direction], pose or Pose())
    if b.view != "back":
        _draw_tail(b)  # behind the body
    if skel.near is not None:
        _draw_arm(b, "r" if skel.near == "l" else "l", far=True)
    _draw_legs(b)
    _draw_torso(b)
    if skel.near is not None:
        _draw_arm(b, skel.near, far=False)
    else:
        _draw_arm(b, "l", far=False)
        _draw_arm(b, "r", far=False)
    if b.view == "back":
        _draw_tail(b)  # over the back
    _draw_head(b)
    b.sheet.outline()
    img = b.sheet.render()
    _cell_check(img, species, direction)
    return img


def generate(ctx: Context) -> list[Frame]:
    frames = []
    for species in SPECIES:
        for anim in ANIM_KEYS:
            for index in range(frame_count(anim)):
                images: dict[str, np.ndarray] = {}
                for direction in DRAWN:
                    try:
                        skel = pose_skeleton(species, anim, direction, index)
                        pose = pose_for(anim, direction, index)
                        images[direction] = draw_body(ctx, species, skel, direction, pose)
                    except ValueError as err:
                        name = frame_name(species.key, anim, direction, index)
                        raise ValueError(f"{name}: {err}") from err
                images["right"] = np.fliplr(images["left"]).copy()  # A-24: mirrored, never drawn
                for direction in ("down", "left", "right", "up"):
                    name = frame_name(species.key, anim, direction, index)
                    frames.append(Frame(name, draw.to_image(images[direction])))
    return frames
