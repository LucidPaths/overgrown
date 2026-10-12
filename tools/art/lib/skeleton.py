"""The shared humanoid actor skeleton: named anchor joints in the 32x32 actor cell.

Every species body, and later every animation frame, weapon and paper-doll layer, is drawn
against these joints. `_l` and `_r` always mean the character's own left and right, never the
screen's: facing down, `hand_r` is on screen-left; facing up, it is on screen-right.

Limb joints are the limb's *inner edge* column (the column nearest the body's centre line in front and back views,
the front edge in profile): a limb of width w covers w columns outward (toward +x in a left-facing profile) from
its joint, so mirroring a joint across the centre line (x -> 31 - x) mirrors the limb exactly.
"""

from dataclasses import dataclass
from typing import Literal

from lib.species import Species

CELL = 32  # actor frames are CELL x CELL
CENTRE_X = 16.0  # continuous centre line of the cell (between columns 15 and 16)
SOLE_Y = (
    29  # every foot joint sits on this row; the outline puts the lowest opaque row at SOLE_Y + 1
)
HEAD_OVERLAP = 2  # the head joint (the chin row) sits this many rows below the neck row
DIRECTIONS = ("down", "left", "right", "up")  # the contract's dir keys
JOINTS = (
    "head",
    "neck",
    "shoulder_l",
    "shoulder_r",
    "hand_l",
    "hand_r",
    "hip_l",
    "hip_r",
    "foot_l",
    "foot_r",
    "tail_root",
)


@dataclass(frozen=True)
class Point:
    x: int
    y: int  # pixel indices in the cell, y down


def _other_side(joint: str) -> str:
    """shoulder_l <-> shoulder_r; joints without a side map to themselves."""
    if joint.endswith("_l"):
        return joint[:-2] + "_r"
    if joint.endswith("_r"):
        return joint[:-2] + "_l"
    return joint


@dataclass(frozen=True)
class Skeleton:
    joints: dict[str, Point]  # exactly the JOINTS keys; treat as immutable
    near: Literal["l", "r"] | None  # side facing the camera in profile views; None for down and up

    def __post_init__(self) -> None:
        for joint in JOINTS:
            if joint not in self.joints:
                raise ValueError(f"skeleton: joint {joint!r} is missing")
        for joint in sorted(set(self.joints) - set(JOINTS)):
            raise ValueError(f"skeleton: joint {joint!r} is not one of {JOINTS}")
        for joint in JOINTS:
            p = self.joints[joint]
            for axis, v in (("x", p.x), ("y", p.y)):
                in_cell = isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= CELL - 2
                if not in_cell:
                    raise ValueError(
                        f"skeleton: joint {joint!r} {axis}={v!r} must be an int in 1..{CELL - 2}"
                    )
        if self.near not in ("l", "r", None):
            raise ValueError(f"skeleton: near must be 'l', 'r' or None, got {self.near!r}")

    def __getitem__(self, joint: str) -> Point:
        return self.joints[joint]

    def mirrored(self) -> "Skeleton":
        """Flip across the cell's centre line: x -> CELL-1-x, and _l/_r joints and near swap."""
        joints = {
            j: Point(CELL - 1 - self.joints[_other_side(j)].x, self.joints[_other_side(j)].y)
            for j in JOINTS
        }
        near = None if self.near is None else ("r" if self.near == "l" else "l")
        return Skeleton(joints, near)


def base_skeleton(species: Species, direction: str) -> Skeleton:
    """The idle base pose: arms hang straight down and both feet stand on SOLE_Y."""
    if direction not in DIRECTIONS:
        raise ValueError(f"unknown direction {direction!r}; expected one of {DIRECTIONS}")
    if direction == "right":
        return base_skeleton(species, "left").mirrored()

    hip_y = SOLE_Y - species.leg
    neck_y = hip_y - species.torso
    shoulder_y = neck_y + 1
    hand_y = shoulder_y + species.arm - 1
    rows = {
        "head": neck_y + HEAD_OVERLAP,
        "neck": neck_y,
        "shoulder_l": shoulder_y,
        "shoulder_r": shoulder_y,
        "hand_l": hand_y,
        "hand_r": hand_y,
        "hip_l": hip_y,
        "hip_r": hip_y,
        "foot_l": SOLE_Y,
        "foot_r": SOLE_Y,
        "tail_root": hip_y,
    }

    c = int(CENTRE_X)  # the column just right of the centre line
    if direction == "left":
        # Facing smaller x; the character's left side faces the camera. The torso spans `depth` columns
        # centred on the line; limbs hang from their front edge toward the back (+x), and the far
        # limb stands one column behind the near one.
        front = c - species.depth // 2
        arm_x = front + (species.depth - species.arm_w) // 2
        leg_x = front + (species.depth - species.leg_w) // 2
        cols = {
            "head": c,
            "neck": c,
            "shoulder_l": arm_x,
            "shoulder_r": arm_x + 1,
            "hand_l": arm_x,
            "hand_r": arm_x + 1,
            "hip_l": leg_x,
            "hip_r": leg_x + 1,
            "foot_l": leg_x,
            "foot_r": leg_x + 1,
            "tail_root": front + species.depth - 1,
        }
        near: Literal["l", "r"] | None = "l"
    else:
        # Facing down, the character's right is on screen-left; facing up, the labels swap.
        screen_left, screen_right = ("r", "l") if direction == "down" else ("l", "r")
        arm_in = (
            c - species.shoulder
        )  # inner edge column of the screen-left arm: overlaps the torso's edge
        leg_in = c - species.hip + species.leg_w - 1
        cols = {
            "head": c,
            "neck": c,
            "tail_root": c,
            f"shoulder_{screen_left}": arm_in,
            f"shoulder_{screen_right}": CELL - 1 - arm_in,
            f"hand_{screen_left}": arm_in,
            f"hand_{screen_right}": CELL - 1 - arm_in,
            f"hip_{screen_left}": leg_in,
            f"hip_{screen_right}": CELL - 1 - leg_in,
            f"foot_{screen_left}": leg_in,
            f"foot_{screen_right}": CELL - 1 - leg_in,
        }
        near = None
    return Skeleton({j: Point(cols[j], rows[j]) for j in JOINTS}, near)
