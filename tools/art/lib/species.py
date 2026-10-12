"""The 9 playable species as one data table over the shared humanoid skeleton (OQ-020).

Species differ only through these rows: body dimensions in pixels, the covering, the tail kind and the actor
palette ramps. Their heads and tails are hand-authored pixel templates in gen/heads.py, keyed by `key`.
Geometric fit in the 32x32 cell is checked by gen/actor.py, not here.

Dimensions follow docs/art/DIRECTION.md section 5 (chibi, about 2 to 2.8 heads tall on the skull).
"""

from dataclasses import dataclass
from typing import Literal, get_args

Tail = Literal["none", "fox", "rabbit", "bear", "lizard", "bird"]
Covering = Literal["skin", "fur", "feathers", "scales"]

_DIMENSIONS = ("leg", "torso", "arm", "shoulder", "hip", "leg_w", "arm_w", "depth")
_FEATURES = {"tail": Tail, "covering": Covering}


@dataclass(frozen=True)
class Species:
    key: str  # the contract's species key (frame names)
    leg: int  # rows from hip to sole
    torso: int  # rows from neck to hip
    arm: int  # rows from shoulder to hand, inclusive
    shoulder: int  # torso half-width at the shoulders, columns on each side of the centre line
    hip: int  # distance from the centre line to the outer edge of a leg
    leg_w: int  # leg width in columns
    arm_w: int  # arm width in columns
    depth: int  # torso depth in profile, columns
    tail: Tail
    covering: Covering
    body_ramp: str  # actors ramp for skin, fur, feathers or scales
    accent_ramp: str | None  # muzzle, belly, tail tip; None iff skin
    hair_ramp: str | None  # None iff the species has no hair
    extra_ramp: (
        str | None
    )  # beak, inner ear...: a second accent; a template may use F-J only if this is set
    cloth_ramp: str  # the base tunic
    legwear_ramp: str  # the base shorts

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
        if self.covering == "feathers" and self.extra_ramp is None:
            raise ValueError(
                f"species {self.key}: extra_ramp (the talons) is required when covering is 'feathers', "
                f"got extra_ramp={self.extra_ramp!r}"
            )


# fmt: off
SPECIES: tuple[Species, ...] = (
    #       key           leg torso arm shoulder hip leg_w arm_w depth tail      covering    body_ramp       accent_ramp     hair_ramp     extra_ramp  cloth_ramp       legwear_ramp
    Species("human",      7,  7,    7,  4,       4,  3,    3,    7,    "none",   "skin",     "skin_human",   None,           "hair_brown", None,       "cloth_crimson", "cloth_ochre"),
    Species("elf",        8,  8,    8,  3,       3,  3,    2,    6,    "none",   "skin",     "skin_elf",     None,           "hair_blond", None,       "cloth_violet",  "cloth_moss"),
    Species("dwarf",      5,  7,    6,  6,       5,  4,    4,    8,    "none",   "skin",     "skin_dwarf",   None,           "hair_red",   None,       "cloth_sky",     "cloth_leather"),
    Species("orc",        6,  8,    8,  6,       5,  4,    4,    8,    "none",   "skin",     "skin_orc",     None,           "hair_black", None,       "cloth_leather", "cloth_ochre"),
    Species("foxfolk",    7,  7,    7,  4,       4,  3,    3,    7,    "fox",    "fur",      "fur_fox",      "cream",        None,         "cream",    "cloth_teal",    "cloth_leather"),
    Species("bearfolk",   5,  8,    7,  7,       6,  4,    5,    9,    "bear",   "fur",      "fur_bear",     "cream",        None,         "pink",     "cloth_moss",    "cloth_leather"),
    Species("rabbitfolk", 6,  7,    6,  3,       3,  3,    2,    6,    "rabbit", "fur",      "fur_rabbit",   "cream",        None,         "pink",     "cloth_rose",    "cloth_leather"),
    Species("birdfolk",   8,  6,    7,  4,       3,  2,    3,    6,    "bird",   "feathers", "feather_bird", "cream",        None,         "beak",     "cloth_ochre",   "cloth_leather"),
    Species("lizardfolk", 7,  7,    7,  4,       4,  3,    3,    7,    "lizard", "scales",   "scale_lizard", "belly_lizard", None,         None,       "cloth_linen",   "cloth_leather"),
)
# fmt: on
