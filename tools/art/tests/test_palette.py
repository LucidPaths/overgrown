"""Palette loading, validation and generator use."""

import json
import re
from pathlib import Path

import numpy as np
import pytest

from gen import debug
from lib.context import Context
from lib.palette import load_all, load_file


def _good() -> dict:
    return {"name": "t", "ramps": {"grass": ["#102010", "#40a040", "#c0f0c0"]}, "colors": {}}


def _bad_hex(d: dict) -> None:
    d["ramps"]["grass"][1] = "#40A040"  # uppercase


def _unsorted(d: dict) -> None:
    d["ramps"]["grass"] = ["#c0f0c0", "#40a040", "#102010"]


def _unknown_key(d: dict) -> None:
    d["extra"] = 1


def _name_mismatch(d: dict) -> None:
    d["name"] = "other"


def _too_short(d: dict) -> None:
    d["ramps"]["grass"] = ["#102010"]


@pytest.mark.parametrize(
    ("mutate", "key"),
    [
        (_bad_hex, "ramps.grass[1]"),
        (_unsorted, "ramps.grass[1]"),
        (_unknown_key, "extra"),
        (_name_mismatch, "name"),
        (_too_short, "ramps.grass"),
    ],
)
def test_bad_palette_names_file_and_key(tmp_path, mutate, key):
    data = _good()
    mutate(data)
    path = tmp_path / "t.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError) as err:
        load_file(path)
    assert "t.json" in str(err.value)
    assert key in str(err.value)


def test_all_shipped_palettes_load():
    palettes = load_all()
    assert {"pop", "meadow"} <= set(palettes)
    pop, meadow = palettes["pop"], palettes["meadow"]
    assert pop.color("crit")[3] == 255
    assert len(meadow.ramp("grass")) >= 3
    with pytest.raises(KeyError, match="meadow.*nope"):
        meadow.ramp("nope")
    with pytest.raises(KeyError, match="pop.*nope"):
        pop.color("nope")


def test_checker16_uses_meadow_grass_and_debug_has_no_hex_literals():
    grass = {tuple(c) for c in Context(1, "debug").palette("meadow").ramp("grass")}
    checker = next(f for f in debug.generate(Context(1, "debug")) if f.name == "debug/checker16")
    pixels = {tuple(int(v) for v in px) for px in np.asarray(checker.image).reshape(-1, 4)}
    assert len(pixels) == 2 and pixels <= grass
    source = (Path(debug.__file__)).read_text()
    assert not re.search(r"#[0-9a-fA-F]{6}\b", source)
