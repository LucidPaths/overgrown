"""Shared RNG vectors; the same file is asserted by sim/src/rng.test.ts."""

import json
from pathlib import Path

import pytest

from lib.rng import Rng, derive_seed, hash_string

VECTORS = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts" / "rng-vectors.json").read_text("utf-8")
)


@pytest.mark.parametrize("case", VECTORS["rng"], ids=lambda c: f"seed={c['seed']}")
def test_next_u32(case):
    r = Rng(case["seed"])
    assert [r.next_u32() for _ in case["u32"]] == case["u32"]


def test_next_float():
    case = VECTORS["float"]
    r = Rng(case["seed"])
    assert [r.next_float() for _ in case["values"]] == case["values"]


def test_int():
    case = VECTORS["int"]
    r = Rng(case["seed"])
    assert [r.int(case["lo"], case["hi"]) for _ in case["values"]] == case["values"]


@pytest.mark.parametrize("case", VECTORS["derive"], ids=lambda c: f"{c['seed']}-{c['parts']}")
def test_derive_seed(case):
    assert derive_seed(case["seed"], *case["parts"]) == case["out"]


@pytest.mark.parametrize("case", VECTORS["hashString"], ids=lambda c: repr(c["s"]))
def test_hash_string(case):
    assert hash_string(case["s"]) == case["out"]


def test_int_rejects_lo_greater_than_hi():
    with pytest.raises(ValueError, match="lo must be <= hi"):
        Rng(1).int(6, 1)


def test_int_rejects_non_integers():
    with pytest.raises(TypeError, match="lo must be an integer"):
        Rng(1).int(1.5, 6)
    with pytest.raises(TypeError, match="hi must be an integer"):
        Rng(1).int(1, 6.5)
