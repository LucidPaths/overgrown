"""overgrown art pipeline: runs every registered generator and writes one atlas per ATLAS name."""

import argparse
import logging
import re
from pathlib import Path
from types import ModuleType

from gen import GENERATORS
from lib.atlas import Frame, write_atlas
from lib.context import Context

log = logging.getLogger("overgrown.art")

ART_SEED = 1  # art is the same for every world
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "client" / "public" / "generated"
IDENT = re.compile(r"[a-z0-9_]+")  # generator NAME and ATLAS; matched with fullmatch


def collect(generators: list[ModuleType], art_seed: int) -> dict[str, list[Frame]]:
    """Run generators in order and group their frames by atlas, enforcing the naming rules."""
    owner: dict[str, str] = {}
    name_owner: dict[str, str] = {}
    atlases: dict[str, list[Frame]] = {}
    for gen in generators:
        if not IDENT.fullmatch(gen.NAME):
            raise ValueError(
                f"generator {gen.__name__}: NAME {gen.NAME!r} must match {IDENT.pattern}"
            )
        # NAME namespaces the RNG streams too, so a shared NAME would silently share randomness.
        if gen.NAME in name_owner:
            raise ValueError(
                f"duplicate generator NAME {gen.NAME!r} in {name_owner[gen.NAME]} and {gen.__name__}"
            )
        name_owner[gen.NAME] = gen.__name__
        if not IDENT.fullmatch(gen.ATLAS):
            raise ValueError(
                f"generator {gen.__name__}: ATLAS {gen.ATLAS!r} must match {IDENT.pattern}"
            )
        for frame in gen.generate(Context(art_seed, gen.NAME)):
            if not frame.name.startswith(f"{gen.NAME}/"):
                raise ValueError(
                    f"generator {gen.__name__}: frame {frame.name!r} must start with {gen.NAME + '/'!r}"
                )
            if frame.name in owner:
                raise ValueError(
                    f"duplicate frame {frame.name!r} from generators {owner[frame.name]} and {gen.__name__}"
                )
            owner[frame.name] = gen.__name__
            atlases.setdefault(gen.ATLAS, []).append(frame)
    return atlases


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    atlases = collect(GENERATORS, ART_SEED)
    args.out.mkdir(parents=True, exist_ok=True)
    for atlas in sorted(atlases):
        frames = atlases[atlas]
        size = write_atlas(args.out, atlas, frames)
        log.info(
            "%s: %d frames -> %dx%d %s", atlas, len(frames), size, size, args.out / f"{atlas}.png"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
