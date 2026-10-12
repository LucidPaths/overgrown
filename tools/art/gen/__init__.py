"""Explicit generator registry. Each module has NAME: str, ATLAS: str, generate(ctx) -> list[Frame]."""

from gen import actor, tiles

GENERATORS = [tiles, actor]
