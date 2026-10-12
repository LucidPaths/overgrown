"""Explicit generator registry. Each module has NAME: str, ATLAS: str, generate(ctx) -> list[Frame]."""

from gen import actor, debug, tiles

GENERATORS = [debug, tiles, actor]
