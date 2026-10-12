"""Per-generator context: seeded RNG streams namespaced by the generator's name."""

from dataclasses import dataclass

from lib.rng import Rng, derive_seed, hash_string


@dataclass(frozen=True)
class Context:
    art_seed: int
    generator_name: str

    def rng(self, *parts: int | str) -> Rng:
        """Independent stream for (art_seed, generator_name, *parts); str parts are hashed."""
        ints = [hash_string(p) if isinstance(p, str) else p for p in parts]
        return Rng(derive_seed(self.art_seed, hash_string(self.generator_name), *ints))
