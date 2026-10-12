"""Actor animation poses: small per-frame joint offsets on the shared skeleton (ART-006, OQ-020).

A frame is `draw_body` applied to `pose_skeleton(...)`. Poses are pure, fixed data with no
per-species values, so all species animate through the same tables.

Invariants (they keep every frame inside the 32x32 cell and the body generator's assumptions):
- Nothing but a hand moves up: body, chest and head dy are >= 0. Five species have ear or crest
  tips on row 1, so any rise would clip.
- tail_root never moves: the profile torso depth mirrors from tail_root.x, and low tails hang to
  rows 29-30.
- Shoulders and hips have no per-side offset: the torso and clothes read only shoulder_l.y and
  hip_l.y.
- Neck, shoulders, hips and tail_root never move in x. Only head, hands and feet do.
- At least one foot stays on SOLE_Y, and hands are clamped to y <= SOLE_Y.
"""

from dataclasses import dataclass

from lib.skeleton import SOLE_Y, Point, Skeleton, base_skeleton
from lib.species import Species

Offset = tuple[int, int]  # (dx, dy) in screen pixels, y down


def _check_range(field: str, value: object, lo: int, hi: int) -> None:
    is_int = isinstance(value, int) and not isinstance(value, bool)
    if not is_int or not lo <= value <= hi:
        raise ValueError(f"pose {field}: {value!r} must be an int in {lo}..{hi}")


def _check_offset(
    field: str, offset: object, dx_range: tuple[int, int], dy_range: tuple[int, int]
) -> None:
    if not isinstance(offset, tuple) or len(offset) != 2:
        raise ValueError(f"pose {field}: {offset!r} must be a (dx, dy) tuple")
    _check_range(f"{field} dx", offset[0], *dx_range)
    _check_range(f"{field} dy", offset[1], *dy_range)


@dataclass(frozen=True)
class Pose:
    body: int = 0  # dy >= 0: hips, neck, shoulders, head and hands sink (crouch, bob)
    chest: int = 0  # extra dy >= 0: neck, shoulders, head and hands sink (squash, slump)
    head: Offset = (0, 0)  # extra offset on the head joint only
    hand_l: Offset = (0, 0)  # extra offsets on top of body + chest
    hand_r: Offset = (0, 0)
    foot_l: Offset = (0, 0)  # feet ignore body and chest
    foot_r: Offset = (0, 0)
    tail: Offset = (
        0,
        0,
    )  # cosmetic shift of the tail drawing; the tail_root joint itself never moves

    def __post_init__(self) -> None:
        _check_range("body", self.body, 0, 3)
        _check_range("chest", self.chest, 0, 4)
        _check_offset("head", self.head, (-1, 1), (0, 3))
        _check_offset("hand_l", self.hand_l, (-10, 10), (-10, 10))
        _check_offset("hand_r", self.hand_r, (-10, 10), (-10, 10))
        _check_offset("foot_l", self.foot_l, (-3, 3), (-3, 0))
        _check_offset("foot_r", self.foot_r, (-3, 3), (-3, 0))
        _check_offset("tail", self.tail, (-2, 2), (-2, 2))
        if self.foot_l[1] != 0 and self.foot_r[1] != 0:
            raise ValueError(
                f"pose foot_l/foot_r: dy {self.foot_l[1]} and {self.foot_r[1]}; "
                "at least one foot must stay on the ground (dy 0)"
            )


BODY_SINKS = ("hip_l", "hip_r", "neck", "shoulder_l", "shoulder_r", "head", "hand_l", "hand_r")
CHEST_SINKS = ("neck", "shoulder_l", "shoulder_r", "head", "hand_l", "hand_r")


def apply_pose(skel: Skeleton, pose: Pose) -> Skeleton:
    """skel with the pose's offsets applied. `near` is copied, never chosen."""
    xy = {j: [p.x, p.y] for j, p in skel.joints.items()}

    def move(joint: str, dx: int, dy: int) -> None:
        xy[joint][0] += dx
        xy[joint][1] += dy

    for joint in BODY_SINKS:
        move(joint, 0, pose.body)
    for joint in CHEST_SINKS:
        move(joint, 0, pose.chest)
    move("head", *pose.head)
    for joint, offset in (
        ("hand_l", pose.hand_l),
        ("hand_r", pose.hand_r),
        ("foot_l", pose.foot_l),
        ("foot_r", pose.foot_r),
    ):
        move(joint, *offset)
    for joint in ("hand_l", "hand_r"):
        xy[joint][1] = min(xy[joint][1], SOLE_Y)
    return Skeleton({j: Point(x, y) for j, (x, y) in xy.items()}, skel.near)


ANIM_KEYS = ("idle", "walk", "attack_blade", "attack_unarmed", "dodge", "hurt", "death")
_DIRECTIONS = ("down", "left", "right", "up")
_AUTHORED = ("down", "left", "up")  # right is the mirror of left

# fmt: off
ANIMS: dict[str, dict[str, tuple[Pose, ...]]] = {
    "idle": {  # 0 base pose (must stay Pose()); 1 breath: chest sinks 1, tail and ears catch up a frame later
        "down": (Pose(), Pose(chest=1, tail=(0, -1))),
        "left": (Pose(), Pose(chest=1, tail=(0, -1))),
        "up":   (Pose(), Pose(chest=1, tail=(0, -1))),
    },
    "walk": {  # down/up: 0 lift L foot (R hand forward), 1 contact (body low), 2 lift R foot, 3 contact
               # left: 0 contact stride (near foot forward), 1 passing, 2 other stride, 3 passing
        "down": (Pose(foot_l=(0, -2), hand_r=(0, 1), hand_l=(0, -1)),
                 Pose(body=1, tail=(0, -1)),
                 Pose(foot_r=(0, -2), hand_l=(0, 1), hand_r=(0, -1)),
                 Pose(body=1, tail=(0, -1))),
        "left": (Pose(body=1, foot_l=(-3, 0), foot_r=(3, 0), hand_l=(3, -1), hand_r=(-3, -1), tail=(0, -1)),
                 Pose(foot_r=(-1, -2)),
                 Pose(body=1, foot_l=(3, 0), foot_r=(-3, 0), hand_l=(-3, -1), hand_r=(3, -1), tail=(0, -1)),
                 Pose(foot_l=(1, -2))),
        "up":   (Pose(foot_l=(0, -2), hand_r=(0, 1), hand_l=(0, -1)),
                 Pose(body=1, tail=(0, -1)),
                 Pose(foot_r=(0, -2), hand_l=(0, 1), hand_r=(0, -1)),
                 Pose(body=1, tail=(0, -1))),
    },
    "attack_blade": {  # 0 wind-up (main hand high, outside), 1 overhead, 2 strike across the front + lunge, 3 recover
        "down": (Pose(hand_r=(-2, -9), hand_l=(0, -1)), Pose(hand_r=(2, -7)),
                 Pose(body=2, hand_r=(7, 0), head=(0, 1)), Pose(body=1, hand_r=(3, -1))),
        "left": (Pose(hand_l=(3, -9)), Pose(hand_l=(-3, -9)),
                 Pose(body=2, hand_l=(-7, -3), foot_l=(-2, 0), foot_r=(2, 0), head=(-1, 1)), Pose(body=1, hand_l=(-2, -1))),
        "up":   (Pose(hand_r=(2, -9), hand_l=(0, -1)), Pose(hand_r=(-2, -8)),
                 Pose(body=2, hand_r=(-7, -2), head=(0, 1)), Pose(body=1, hand_r=(-3, -1))),
    },
    "attack_unarmed": {  # 0 chamber (fist pulled up and back), 1 swing in, 2 full extension + lunge (held), 3 recover
        "down": (Pose(hand_r=(-1, -5), hand_l=(0, -1)),
                 Pose(body=1, hand_r=(4, -2)),
                 Pose(body=2, hand_r=(6, 0), head=(0, 1)),
                 Pose(body=1, hand_r=(3, -1))),
        "left": (Pose(hand_l=(3, -6), foot_l=(1, 0)),
                 Pose(body=1, hand_l=(-2, -4), foot_l=(-1, 0)),
                 Pose(body=2, hand_l=(-7, -3), foot_l=(-2, 0), foot_r=(2, 0), head=(-1, 1)),
                 Pose(body=1, hand_l=(-3, -1), foot_l=(-1, 0))),
        "up":   (Pose(hand_r=(1, -5), hand_l=(0, -1)),
                 Pose(body=1, hand_r=(0, -8)),
                 Pose(body=2, hand_r=(-1, -9), head=(0, 1)),
                 Pose(body=1, hand_r=(0, -3))),
    },
    "dodge": {  # 0 crouch, 1 tuck into a ball, 2 deepest tuck (head down), 3 rise
        "down": (Pose(body=2, hand_l=(-1, -2), hand_r=(1, -2)),
                 Pose(body=3, chest=3, head=(0, 1), hand_l=(-2, -3), hand_r=(2, -3)),
                 Pose(body=3, chest=3, head=(0, 2), hand_l=(-2, -2), hand_r=(2, -2)),
                 Pose(body=1, hand_l=(0, -1), hand_r=(0, -1))),
        "left": (Pose(body=2, hand_l=(-2, -2), hand_r=(-2, -2)),
                 Pose(body=3, chest=3, head=(-1, 1), hand_l=(-2, -3), hand_r=(-2, -3),
                      foot_l=(-1, 0), foot_r=(1, 0)),
                 Pose(body=3, chest=3, head=(-1, 2), hand_l=(-1, -2), hand_r=(-1, -2),
                      foot_l=(-1, 0), foot_r=(1, 0)),
                 Pose(body=1, hand_l=(-1, -1), hand_r=(-1, -1))),
        "up":   (Pose(body=2, hand_l=(1, -2), hand_r=(-1, -2)),
                 Pose(body=3, chest=3, head=(0, 1), hand_l=(2, -3), hand_r=(-2, -3)),
                 Pose(body=3, chest=3, head=(0, 2), hand_l=(2, -2), hand_r=(-2, -2)),
                 Pose(body=1, hand_l=(0, -1), hand_r=(0, -1))),
    },
    "hurt": {  # 0 flinch (head knocked back, arms up), 1 sag
        "down": (Pose(head=(0, 1), hand_l=(1, -2), hand_r=(-1, -2), tail=(1, -1)),
                 Pose(body=1, chest=1, head=(0, 1))),
        "left": (Pose(head=(1, 0), hand_l=(2, -2), hand_r=(2, -2), foot_l=(1, 0), tail=(1, -1)),
                 Pose(body=1, chest=1, head=(1, 1))),
        "up":   (Pose(head=(0, 1), hand_l=(-1, -2), hand_r=(1, -2), tail=(1, -1)),
                 Pose(body=1, chest=1, head=(0, 1))),
    },
    "death": {  # 0 flinch, 1 knees buckle, 2 kneel, 3 slumped heap with hands on the ground (held by the renderer)
        "down": (Pose(head=(0, 1), hand_l=(1, -2), hand_r=(-1, -2)),
                 Pose(body=2, chest=1, head=(0, 1)),
                 Pose(body=3, chest=2, head=(0, 2), hand_l=(1, 2), hand_r=(-1, 2)),
                 Pose(body=3, chest=4, head=(0, 3), hand_l=(2, 9), hand_r=(-2, 9))),
        "left": (Pose(head=(1, 0), hand_l=(2, -2), hand_r=(2, -2), foot_l=(1, 0)),
                 Pose(body=2, chest=1, head=(1, 1), foot_l=(-1, 0), foot_r=(1, 0)),
                 Pose(body=3, chest=2, head=(-1, 2), hand_l=(-1, 2), hand_r=(-1, 2),
                      foot_l=(-1, 0), foot_r=(2, 0)),
                 Pose(body=3, chest=4, head=(-1, 3), hand_l=(-3, 9), hand_r=(-2, 9),
                      foot_l=(-1, 0), foot_r=(2, 0))),
        "up":   (Pose(head=(0, 1), hand_l=(-1, -2), hand_r=(1, -2)),
                 Pose(body=2, chest=1, head=(0, 1)),
                 Pose(body=3, chest=2, head=(0, 2), hand_l=(-1, 2), hand_r=(1, 2)),
                 Pose(body=3, chest=4, head=(0, 3), hand_l=(-2, 9), hand_r=(2, 9))),
    },
}
# fmt: on


def _validate_anims() -> None:
    if tuple(ANIMS) != ANIM_KEYS:
        raise ValueError(f"anims: ANIMS keys {tuple(ANIMS)} must equal {ANIM_KEYS}")
    for anim, by_dir in ANIMS.items():
        if tuple(sorted(by_dir)) != _AUTHORED:
            raise ValueError(f"anims: {anim!r} must have exactly the directions {_AUTHORED}")
        if len({len(poses) for poses in by_dir.values()}) != 1:
            raise ValueError(f"anims: {anim!r} has a different pose count per direction")
    for direction, poses in ANIMS["idle"].items():
        if poses[0] != Pose():
            raise ValueError(f"anims: idle/{direction}/0 must be Pose(), the ART-005 base pose")


_validate_anims()


def frame_count(anim: str) -> int:
    if anim not in ANIMS:
        raise ValueError(f"anims: unknown anim {anim!r}; expected one of {ANIM_KEYS}")
    return len(ANIMS[anim]["down"])


def pose_skeleton(species: Species, anim: str, direction: str, index: int) -> Skeleton:
    """The skeleton of one frame: the pose on base_skeleton, or the mirror of the left frame."""
    where = f"anims: {species.key}/{anim}/{direction}/{index}"
    if anim not in ANIMS:
        raise ValueError(f"{where}: unknown anim; expected one of {ANIM_KEYS}")
    if direction not in _DIRECTIONS:
        raise ValueError(f"{where}: unknown direction; expected one of {_DIRECTIONS}")
    if not 0 <= index < frame_count(anim):
        raise ValueError(f"{where}: index out of range 0..{frame_count(anim) - 1}")
    if direction == "right":
        return pose_skeleton(species, anim, "left", index).mirrored()
    pose = ANIMS[anim][direction][index]
    if species.leg - pose.body < 2:
        raise ValueError(
            f"{where}: leg {species.leg} minus body {pose.body} leaves under 2 rows of leg"
        )
    if species.torso - pose.chest < 2:
        raise ValueError(
            f"{where}: torso {species.torso} minus chest {pose.chest} leaves under 2 rows of torso"
        )
    return apply_pose(base_skeleton(species, direction), pose)


def pose_for(anim: str, direction: str, index: int) -> Pose:
    """The Pose of an authored frame (down, left or up); right frames are mirrors and have none of their own."""
    if anim not in ANIMS:
        raise ValueError(f"anims: unknown anim {anim!r}; expected one of {ANIM_KEYS}")
    if direction not in _AUTHORED:
        raise ValueError(f"anims: pose_for takes one of {_AUTHORED}, got {direction!r}")
    if not 0 <= index < frame_count(anim):
        raise ValueError(
            f"anims: {anim}/{direction}/{index}: index out of range 0..{frame_count(anim) - 1}"
        )
    return ANIMS[anim][direction][index]


MAIN_HAND = {"down": "hand_r", "left": "hand_l", "right": "hand_r", "up": "hand_r"}


def hand_anchor(species: Species, anim: str, direction: str, index: int) -> Point:
    """The main-hand pixel of a frame, where weapons attach (ART-009)."""
    return pose_skeleton(species, anim, direction, index)[MAIN_HAND[direction]]
