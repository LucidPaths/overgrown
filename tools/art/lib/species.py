"""The 9 playable species as one data table over the shared humanoid skeleton (OQ-020).

Species differ only through these rows: body dimensions in pixels, feature choices and actor
palette ramps. Geometric fit in the 32x32 cell is checked by gen/actor.py, not here.
"""

from dataclasses import dataclass
from typing import Literal, get_args

HeadShape = Literal["round", "square"]
Ears = Literal["none", "pointed", "fox", "rabbit", "bear"]
Face = Literal["plain", "tusks", "muzzle", "snout_fox", "snout_bear", "snout_lizard", "beak"]
Tail = Literal["none", "fox", "rabbit", "bear", "lizard"]
Covering = Literal["skin", "fur", "feathers", "scales"]
Hair = Literal["none", "short", "long", "short_beard", "crest"]

_DIMENSIONS = ("leg", "torso", "arm", "head_w", "head_h", "shoulder", "hip")
_FEATURES = {
    "head_shape": HeadShape,
    "ears": Ears,
    "face": Face,
    "tail": Tail,
    "covering": Covering,
    "hair": Hair,
}


@dataclass(frozen=True)
class Species:
    key: str  # the contract's species key (frame names)
    leg: int  # rows from hip to sole
    torso: int  # rows from neck to hip
    arm: int  # rows from shoulder to hand, inclusive
    head_w: int
    head_h: int
    shoulder: int  # half-span of the shoulders from the centre line
    hip: int  # half-span of the hips
    head_shape: HeadShape
    ears: Ears
    face: Face
    tail: Tail
    covering: Covering
    hair: Hair
    body_ramp: str  # actors ramp for skin, fur, feathers or scales
    accent_ramp: str | None  # snout or muzzle, tail tip or puff, sleeve fringe; None iff skin
    hair_ramp: str | None  # None iff hair == "none"

    def __post_init__(self) -> None:
        for name in _DIMENSIONS:
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                raise ValueError(
                    f"species {self.key}: {name} must be a positive int, got {value!r}"
                )
        for name, literal in _FEATURES.items():
            allowed = get_args(literal)
            if getattr(self, name) not in allowed:
                raise ValueError(
                    f"species {self.key}: {name} {getattr(self, name)!r} is not one of {allowed}"
                )
        if (self.accent_ramp is None) != (self.covering == "skin"):
            raise ValueError(
                f"species {self.key}: accent_ramp must be None iff covering is 'skin', "
                f"got accent_ramp={self.accent_ramp!r} with covering={self.covering!r}"
            )
        if (self.hair_ramp is None) != (self.hair == "none"):
            raise ValueError(
                f"species {self.key}: hair_ramp must be None iff hair is 'none', "
                f"got hair_ramp={self.hair_ramp!r} with hair={self.hair!r}"
            )


# Tuned from the ART-005 starting values: even head widths keep the down and up views symmetric
# about the centre line, and dwarf torso 7 / rabbitfolk torso 8 keep the dwarf the shortest.
# fmt: off
SPECIES: tuple[Species, ...] = (
    #       key           leg  torso  arm  head_w  head_h  shoulder  hip  head_shape  ears       face            tail      covering    hair           body_ramp       accent_ramp  hair_ramp
    Species("human",      7,   8,     9,   10,     10,     5,        4,   "round",    "none",    "plain",        "none",   "skin",     "short",       "skin_human",   None,        "hair_brown"),
    Species("elf",        8,   9,     10,  8,      10,     4,        3,   "round",    "pointed", "plain",        "none",   "skin",     "long",        "skin_elf",     None,        "hair_blond"),
    Species("dwarf",      5,   7,     8,   10,     10,     6,        5,   "square",   "none",    "plain",        "none",   "skin",     "short_beard", "skin_dwarf",   None,        "hair_red"),
    Species("orc",        7,   9,     10,  12,     9,      6,        5,   "square",   "pointed", "tusks",        "none",   "skin",     "short",       "skin_orc",     None,        "hair_black"),
    Species("foxfolk",    6,   8,     9,   10,     9,      4,        3,   "round",    "fox",     "snout_fox",    "fox",    "fur",      "none",        "fur_fox",      "cream",     None),
    Species("bearfolk",   6,   9,     10,  12,     10,     7,        6,   "round",    "bear",    "snout_bear",   "bear",   "fur",      "none",        "fur_bear",     "cream",     None),
    Species("rabbitfolk", 6,   8,     8,   10,     9,      4,        3,   "round",    "rabbit",  "muzzle",       "rabbit", "fur",      "none",        "fur_rabbit",   "cream",     None),
    Species("birdfolk",   7,   8,     9,   10,     9,      4,        3,   "round",    "none",    "beak",         "none",   "feathers", "crest",       "feather_bird", "cream",     "feather_bird"),
    Species("lizardfolk", 7,   8,     9,   10,     9,      5,        4,   "round",    "none",    "snout_lizard", "lizard", "scales",   "none",        "scale_lizard", "cream",     None),
)
# fmt: on
