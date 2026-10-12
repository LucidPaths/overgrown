"""Explicit generator registry. Each module has NAME: str, ATLAS: str, generate(ctx) -> list[Frame]."""

from gen import actor, debug

GENERATORS = [debug, actor]
