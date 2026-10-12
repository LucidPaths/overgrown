"""Hand-authored pixel templates for actor heads and tails (ART-024, docs/art/DIRECTION.md sections 5 and 6).

A template is a list of equal-length strings, one per row. Faces, ears, hair, beaks and tails are authored, not
computed, because at 32 px the identity of a species is a handful of deliberately placed pixels.

Legend (shade digits and letters index the actor ramps: 1 deep shadow, 2 shadow, 3 base, 4 light, 5 highlight;
index 0, the line colour, is added by the outline pass and is never written here):
  .          empty
  1 2 3 4 5  body ramp (skin, fur, feathers, scales)
  A B C D E  accent ramp (muzzle, belly, tail tip)
  a b c d e  hair ramp
  F G H I J  extra ramp (beak, inner ear)
  X          eye (dark)         W   eye shine
  T t        tusk (light, base) P   blush / inner ear pink
  k          line colour of the body ramp, drawn inside the silhouette (mouth, nostril, brow)

Head templates: even width, so front and back views are symmetric about the cell's centre line; the template's
column w // 2 is the head joint's column. The head joint's row is the chin row: the last row, unless the template
carries `chin` (hair, beards and wings may hang below the chin). Views are "front" (facing down), "side"
(facing left; the right view is the pixel mirror) and "back" (facing up).

Tail templates: the pair (rows, (col, row)) where (col, row) is the cell inside the template that sits on the
skeleton's tail_root joint.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    rows: tuple[str, ...]
    chin: int | None = None  # row index of the chin; the last row when None

    def __post_init__(self) -> None:
        width = {len(r) for r in self.rows}
        if len(width) != 1 or next(iter(width)) % 2:
            raise ValueError(f"template rows must share one even width, got {sorted(width)}")
        bad = sorted({c for r in self.rows for c in r} - set(LEGEND))
        if bad:
            raise ValueError(f"template uses unknown legend characters {bad}")

    @property
    def width(self) -> int:
        return len(self.rows[0])

    @property
    def chin_row(self) -> int:
        return len(self.rows) - 1 if self.chin is None else self.chin


def _clean(rows: list[str]) -> list[str]:
    """Rows may be written in space-separated groups of four columns, to make them countable."""
    return [r.replace(" ", "") for r in rows]


def sym(half: list[str], chin: int | None = None) -> Template:
    """A front or back template from its left half; the right half is the mirror image."""
    return Template(tuple(r + r[::-1] for r in _clean(half)), chin)


def raw(rows: list[str], chin: int | None = None) -> Template:
    return Template(tuple(_clean(rows)), chin)


def ctr(rows: list[str], chin: int | None = None, width: int = 16) -> Template:
    """A symmetric template from rows of even length, each centred in `width` columns."""
    out = []
    for r in _clean(rows):
        if (width - len(r)) % 2:
            raise ValueError(f"ctr row {r!r} cannot be centred in {width} columns")
        out.append(r.center(width, "."))
    return Template(tuple(out), chin)


LEGEND = set(". 12345ABCDEabcdeFGHIJXWTtPpk")

HEADS: dict[str, dict[str, Template]] = {
    "human": {
        "front": raw(
            [
                "...bcddcb...",
                "..bcddddcb..",
                ".bcddeeddcb.",
                "bccddddddccb",
                "bcccddddcccb",
                "bbcc3cc3ccbb",
                "b3333333333b",
                "b3WX3333WX3b",
                "3pXX3333XXp3",
                ".3333113333.",
                "..33333333..",
                "...223322...",
            ]
        ),
        "side": raw(
            [
                "...bcddcb...",
                "..bcddddcb..",
                ".bcddeeddcb.",
                "bccddddddccb",
                "bcccddddcccb",
                "b333ccccccbb",
                "3333cccccccb",
                "33WX3332cccb",
                "33XX3p332ccb",
                ".3133333cccb",
                "..3333333cb.",
                "...22333b...",
            ]
        ),
        "back": raw(
            [
                "...bcddcb...",
                "..bcddddcb..",
                ".bcddeeddcb.",
                "bccddddddccb",
                "bcccddddcccb",
                "bcccccccccab",
                "bcccccccccab",
                "bcccccccccab",
                "bbcccccccabb",
                ".bbcccccabb.",
                "..bbbbbbbb..",
                "...22bb22...",
            ]
        ),
    },
}


HEADS["elf"] = {
    "front": raw(
        [
            "....bcddddcb....",
            "...bcddddddcb...",
            "..bcddeeeeddcb..",
            "..bcccddddcccb..",
            "3.bccccddccccb.3",
            "33bbcc3cc3ccbb33",
            "3P3b33333333b3P3",
            ".3Pb3WX33WX3bP3.",
            "..3bpXX33XXpb3..",
            "...b33311333b...",
            "...bb333333bb...",
            "....b223322b....",
            "...bcb....bcb...",
            "...bcb....bcb...",
            "....bb....bb....",
        ],
        chin=11,
    ),
    "side": raw(
        [
            "......bcddddcb..",
            ".....bcddddddcb.",
            "....bcddeeddddcb",
            "....bccddddddccb",
            "...bcccddddddccb",
            "..33bccccccccccb",
            "..333bcccccccccb",
            ".3333bccccccccb.",
            "3P3WX3bcccccccb.",
            ".3PXX3p3bccccb..",
            "..3333333bcccb..",
            "...3333333bbb...",
            "...22333b..cb...",
            "........bcb.....",
        ],
        chin=11,
    ),
    "back": raw(
        [
            "....bcddddcb....",
            "...bcddddddcb...",
            "..bcddeeeeddcb..",
            "..bccddddddccb..",
            "3.bcccddddcccb.3",
            "33bccccddccccb33",
            "3P3bcccddcccb3P3",
            ".3Pbccccccccbb3.",
            "..3bcccccccccb..",
            "...bcccccccccb..",
            "...bccccccccb...",
            "...bbccccccbb...",
            "...bcccccccb....",
            "...bccccccb.....",
            "....bbbbbb......",
        ],
        chin=11,
    ),
}

HEADS["dwarf"] = {
    "front": raw(
        [
            "...b ccdd ddcc b...",
            "..bc cddd dddc cb..",
            ".bcc ddee eedd ccb.",
            ".bcc cddd dddc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc 3333 3333 ccb.",
            ".bcc 2222 2222 ccb.",
            ".bcc 3WX3 3WX3 ccb.",
            ".bcc 3XX4 4XX3 ccb.",
            ".bcc cc34 43cc ccb.",
            ".bcc ccca accc ccb.",
            ".bcc cccc cccc ccb.",
            "..bc cccc cccc cb..",
            "..bc ccbc cbcc cb..",
            "...b ccb. .bcc b...",
            "...b bb.. ..bb b...",
        ],
        chin=11,
    ),
    "side": raw(
        [
            ".... bccd dddc b...",
            "...b ccdd ddde cb..",
            "..bc cddd eedd ccb.",
            "..bc ccdd dddd ccb.",
            "..bb cccc cccc ccb.",
            ".b33 33bc cccc ccb.",
            ".b33 333b bbbb cbb.",
            ".b33 WX33 bccc cb..",
            ".bcc XX44 3ccc cb..",
            ".bcc cc43 3ccc b...",
            ".bcc acc3 cccc b...",
            ".bcc cccc cccc b...",
            "..bc cccc cccb ....",
            "..bc cccc ccb. ....",
            "...b cccc cb.. ....",
            "....  bbbb b... ....".replace("  ", " "),
        ],
        chin=11,
    ),
    "back": raw(
        [
            "...b ccdd ddcc b...",
            "..bc cddd dddc cb..",
            ".bcc ddee eedd ccb.",
            ".bcc cddd dddc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc cccc cccc ccb.",
            ".bcc cccc cccc ccb.",
            "..bc cccc cccc cb..",
            "..bb cccc cccc bb..",
            "...b bbbb bbbb b...",
        ],
        chin=11,
    ),
}

HEADS["orc"] = {
    "front": raw(
        [
            ".... ..cd dc.. ....",
            ".... .bcd ddcb ....",
            "...b ccdd ddcc b...",
            "..bc cddd dddc cb..",
            "..bc cccc cccc cb..",
            "..bb 3333 3333 bb..",
            "3.b3 3333 3333 3b.3",
            "33b3 2222 2222 3b33",
            "3P33 3WX3 3WX3 33P3",
            ".333 3XX3 3XX3 333.",
            "..33 3331 1333 33..",
            "..3T 3333 3333 T3..",
            "..3T 333k k333 T3..",
            "...2 3333 3333 2...",
        ],
        chin=13,
    ),
    "side": raw(
        [
            ".... ..cd dc.. ....",
            ".... .cdd ddcc ....",
            "...b cddd dddd cb..",
            "..bc cccc cccc ccb.",
            "..b3 3ccc cccc ccb.",
            ".b33 33cc cccc ccb.",
            ".b33 2222 cccc cc.3",
            ".b33 WX33 cccc c.33",
            ".b33 XX33 3ccc 3P3.",
            "b333 3333 3333 .3..",
            "b133 3333 3333 33..",
            "bT33 3333 3333 3b..",
            "bT33 33kk 3333 b...",
            ".b33 3333 333b ....",
            "..bb 2333 33bb ....",
        ],
        chin=13,
    ),
    "back": raw(
        [
            ".... ..cd dc.. ....",
            ".... .bcd dcb. ....".replace("dcb.", "dcb."),
            "...b ccdd ddcc b...",
            "..bc cddd dddc cb..",
            "..bc cccc cccc cb..",
            "..bc cccc cccc cb..",
            "3.bc cccc cccc cb.3",
            "33bc cccc cccc cb33",
            "3P3b cccc cccc b3P3",
            ".333 bccc cccb 333.",
            "..33 3bcc ccb3 33..",
            "..33 3333 3333 33..",
            "...2 3333 3333 2...",
            ".... 2233 3322 ....",
        ],
        chin=13,
    ),
}

HEADS["foxfolk"] = {
    "front": sym(
        [
            "..4. ....",
            "..34 ....",
            "..3H 4...",
            ".3HH 4444",
            ".333 4444",
            "..33 3444",
            "..33 3333",
            "..33 3333",
            "..33 XW33",
            "..33 XX33",
            "..3C CCC1",
            "..CC CCCC",
            "...C CCCk",
            ".... .BCC",
        ]
    ),
    "side": raw(
        [
            ".... .... .4.. ....",
            ".... .... .34. ....",
            ".... .... .3H4 ....",
            ".... ..33 H444 444.",
            ".... .433 4444 444.",
            ".... 4333 3333 333.",
            "..43 3333 3333 333.",
            ".433 33WX 3333 333.",
            "1333 33XX 3333 333.",
            "1CCC CC33 3333 3CC.",
            ".CCC CCCC 3333 CCC.",
            "...C CCCC CCCC CC..",
            ".... .BCC CCCC B...",
        ]
    ),
    "back": sym(
        [
            "..4. ....",
            "..34 ....",
            "..33 3...",
            ".333 4444",
            ".333 4444",
            "..33 3444",
            "..33 3333",
            "..33 3333",
            "..33 3333",
            "..33 3333",
            "..33 3333",
            "...3 3333",
            ".... 2222",
        ]
    ),
}

HEADS["bearfolk"] = {
    "front": sym(
        [
            "..44 ....",
            ".3HH ....",
            ".3HH ....",
            ".333 4444",
            ".344 4444",
            ".333 3444",
            ".333 3333",
            ".333 3333",
            ".33X W333",
            ".33X X333",
            ".333 3CCC",
            ".333 CCC1",
            "..33 CCCk",
            "...3 CCCC",
            ".... 2222",
        ]
    ),
    "side": raw(
        [
            ".... .... .33. ....",
            ".... .... 3HH3 ....",
            ".... .... 3HH3 ....",
            ".... .333 3444 4333",
            ".... 3344 4444 4433",
            ".... 3333 3333 3333",
            ".... 3333 3333 3333",
            ".... 3333 3333 3333",
            "...3 WX33 3333 3333",
            "...3 XX33 3333 3333",
            "CC33 3333 3333 3333",
            "C1CC CC33 3333 333.",
            "CCCC CCC3 3333 33..",
            ".CCC CCCC 3333 3...",
            ".... ..22 2222 2...",
        ]
    ),
    "back": sym(
        [
            "..44 ....",
            ".333 ....",
            ".333 ....",
            ".333 4444",
            ".344 4444",
            ".333 3444",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            "..33 3333",
            "...3 3333",
            ".... 2222",
        ]
    ),
}

HEADS["rabbitfolk"] = {
    "front": sym(
        [
            "...4 ....",
            "..44 ....",
            "..3H 4...",
            "..3H 4...",
            "..3H 4...",
            "..3H 4...",
            "..3H 4...",
            ".333 4444",
            ".334 4444",
            ".333 3444",
            ".333 3333",
            ".33X W333",
            ".33X X333",
            ".333 3CCC",
            "..33 CCCH",
            "..CC CCCk",
            ".... ..BT",
        ]
    ),
    "side": raw(
        [
            ".... .... .44. ....",
            ".... .... .3H4 ....",
            ".... .... .3H4 ....",
            ".... .... .3H4 ....",
            ".... .... .3H4 ....",
            ".... .... .3H4 ....",
            ".... .... .3H4 ....",
            ".... .333 3444 444.",
            "...3 3333 3333 333.",
            "..33 3333 3333 333.",
            "..33 3333 3333 333.",
            "..33 WX33 3333 33..",
            ".H33 XX33 3333 33..",
            ".HCC C333 3333 3...",
            "..CC CC33 3333 ....",
            "...C CCCC CC.. ....",
            ".... ..BC C... ....",
        ]
    ),
    "back": sym(
        [
            "...4 ....",
            "..44 ....",
            "..33 4...",
            "..33 4...",
            "..33 4...",
            "..33 4...",
            "..33 4...",
            ".333 4444",
            ".333 4444",
            ".333 3444",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            "..33 3333",
            "..33 3333",
            "...2 2222",
        ]
    ),
}

HEADS["birdfolk"] = {
    "front": sym(
        [
            ".... ...4",
            "...4 ..34",
            "..34 3344",
            ".334 4444",
            ".333 4444",
            ".333 3444",
            ".333 3333",
            ".33X W333",
            ".33X X333",
            ".33C CCHH",
            "..3C CCCH",
            "..CC CCCG",
            "...C CCCC",
            ".... .CCC",
        ]
    ),
    "side": raw(
        [
            ".... .... ...4 4...",
            ".... .... ..34 4...",
            ".... .... .334 44..",
            ".... .... 3344 4444",
            ".... ..33 4444 4444".replace("4444", "444."),
            ".... .333 3444 444.",
            ".... 3333 3333 33..",
            "..HH WX33 3333 33..",
            ".HHG XX33 3333 3...",
            "..GC CCC3 3333 ....",
            "...C CCCC 333. ....",
            ".... .CCC CC.. ....",
        ]
    ),
    "back": sym(
        [
            ".... ...4",
            "...4 ..34",
            "..34 3344",
            ".334 4444",
            ".333 4444",
            ".333 3444",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            "..33 3333",
            "..33 3333",
            "...2 3333",
        ]
    ),
}

HEADS["lizardfolk"] = {
    "front": sym(
        [
            ".... ...4",
            "...4 ..44",
            "..34 3344",
            ".334 4444",
            ".333 3444",
            ".3WX 3333",
            ".33X 3333",
            ".333 3333",
            ".333 4444",
            "..33 4k44",
            "..33 4444",
            "..3A kkkA",
            "...A AAAA",
            ".... .AAA",
        ]
    ),
    "side": raw(
        [
            ".... .... ..4. 4...",
            ".... .... .344 4...",
            ".... ..33 3444 44..",
            ".... .333 3333 333.",
            ".... 4333 3333 333.",
            ".... 44WX 3333 33..",
            "..44 4433 3333 3...",
            ".k44 4444 3333 ....",
            "..44 4444 3333 ....",
            "..AA kkAA 3333 ....",
            "...A AAAA AAA. ....",
        ]
    ),
    "back": sym(
        [
            "...4 ....",
            "..34 ....",
            ".334 4444",
            ".333 4444",
            ".333 3444",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            ".333 3333",
            "..33 3333",
            "..33 3333",
            "...3 3333",
            ".... 2222",
        ]
    ),
}


@dataclass(frozen=True)
class TailTemplate:
    rows: tuple[str, ...]
    anchor: tuple[int, int]  # (col, row) of the template cell that sits on the tail_root joint

    def __post_init__(self) -> None:
        if len({len(r) for r in self.rows}) != 1:
            raise ValueError("tail rows must share one width")
        bad = sorted({c for r in self.rows for c in r} - LEGEND)
        if bad:
            raise ValueError(f"tail uses unknown legend characters {bad}")


def tail_tpl(rows: list[str], anchor: tuple[int, int]) -> TailTemplate:
    return TailTemplate(tuple(_clean(rows)), anchor)


TAILS: dict[str, dict[str, TailTemplate]] = {
    "fox": {
        "side": tail_tpl(
            [
                "......BC..",
                ".....BCCC.",
                ".....3CC3.",
                "....3333..",
                "...44333..",
                "..444333..",
                ".44433....",
                "4433......",
            ],
            (0, 7),
        ),
        "front": tail_tpl(
            [
                ".......BC",
                "......BCC",
                "......3CC",
                ".....3333",
                ".....4333",
                "....44333",
                "...443333",
                "..4433333",
                "44433....",
            ],
            (0, 8),
        ),
        "back": tail_tpl(
            [
                ".4333.",
                "443333",
                "443333",
                "443333",
                ".43333",
                ".3CCC.",
                "..CCC.",
                "..BC..",
            ],
            (2, 0),
        ),
    },
    "rabbit": {
        "side": tail_tpl([".CC.", "CCCC", "CCCC", ".CC."], (0, 2)),
        "back": tail_tpl([".CC.", "CCCC", "CCCC", ".CC."], (2, 0)),
    },
    "bear": {
        "side": tail_tpl([".44.", "3333", ".33."], (0, 1)),
        "back": tail_tpl([".44.", "3333", ".33."], (2, 0)),
    },
    "lizard": {
        "side": tail_tpl(
            [
                "44444.....",
                "3333333333",
                "AAAA333333",
                "....AA3333",
                "......333.",
            ],
            (0, 1),
        ),
        "front": tail_tpl(
            [
                "444.......",
                ".3333.....",
                "..33333...",
                "....3333..",
                ".....3333.",
                "......3333",
                ".......333",
                "........33",
            ],
            (0, 0),
        ),
        "back": tail_tpl(
            [
                "4444",
                "3333",
                "3333",
                ".333",
                ".333",
                "..33",
                "..33",
                "...3",
            ],
            (1, 0),
        ),
    },
    "bird": {
        "side": tail_tpl(
            [
                "4444....",
                "33333...",
                "333333..",
                ".33333..",
                "..333...",
            ],
            (0, 1),
        ),
        "back": tail_tpl(
            [
                ".4444.",
                "433334",
                "433334",
                "43..34",
                "33..33",
                "3....3",
            ],
            (2, 0),
        ),
    },
}


def tail(tail_kind: str, view: str) -> TailTemplate | None:
    """The tail template of a species' tail kind in one view; None when that view shows no tail."""
    return TAILS.get(tail_kind, {}).get(view)


def template(species_key: str, view: str) -> Template:
    return HEADS.get(species_key, HEADS["human"])[view]
