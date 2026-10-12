"""Seeded RNG shared with the TS sim (sim/src/rng.ts).

Both files must stay bit-for-bit identical; contracts/rng-vectors.json is the shared check.
All arithmetic is unsigned 32-bit: mask with M32 after every add, multiply and shift-left.
"""

import math

M32 = 0xFFFFFFFF
MAX_SAFE = 2**53 - 1  # JS Number.MAX_SAFE_INTEGER; the TS side can't go further exactly
GOLDEN = 0x9E3779B9


def _fmix32(x: int) -> int:
    x ^= x >> 16
    x = (x * 0x85EBCA6B) & M32
    x ^= x >> 13
    x = (x * 0xC2B2AE35) & M32
    x ^= x >> 16
    return x


def _rotl32(x: int, r: int) -> int:
    return ((x << r) & M32) | (x >> (32 - r))


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _check_u32(name: str, value: object) -> int:
    if not _is_int(value):
        raise TypeError(f"{name} must be an integer in 0..4294967295, got {value!r}")
    if not 0 <= value <= M32:
        raise ValueError(f"{name} must be an integer in 0..4294967295, got {value!r}")
    return value


def _check_safe_int(name: str, value: object) -> None:
    if not _is_int(value):
        raise TypeError(f"{name} must be an integer, got {value!r}")
    if not -MAX_SAFE <= value <= MAX_SAFE:
        raise ValueError(f"{name} must be within -(2^53-1)..2^53-1, got {value!r}")


class Rng:
    """sfc32 seeded by splitmix32, with 12 discarded outputs."""

    def __init__(self, seed: int) -> None:
        s = _check_u32("seed", seed)
        out = []
        for _ in range(4):
            # splitmix32 step
            s = (s + GOLDEN) & M32
            z = s
            z = ((z ^ (z >> 16)) * 0x85EBCA6B) & M32
            z = ((z ^ (z >> 13)) * 0xC2B2AE35) & M32
            out.append(z ^ (z >> 16))
        self._a, self._b, self._c, self._d = out
        for _ in range(12):
            self.next_u32()

    def next_u32(self) -> int:
        t = (self._a + self._b + self._d) & M32
        self._d = (self._d + 1) & M32
        self._a = self._b ^ (self._b >> 9)
        self._b = (self._c + ((self._c << 3) & M32)) & M32
        self._c = _rotl32(self._c, 21)
        self._c = (self._c + t) & M32
        return t

    def next_float(self) -> float:
        """Uniform float in [0, 1); exact in float64."""
        return self.next_u32() / 4294967296

    def int(self, lo: int, hi: int) -> int:
        """Uniform integer in [lo, hi], inclusive."""
        _check_safe_int("lo", lo)
        _check_safe_int("hi", hi)
        if lo > hi:
            raise ValueError(f"lo must be <= hi, got lo={lo} hi={hi}")
        if hi - lo > M32:
            raise ValueError(f"hi - lo must be < 2^32, got lo={lo} hi={hi}")
        # float * float matches the TS double multiply exactly.
        return lo + math.floor(self.next_float() * float(hi - lo + 1))


def derive_seed(seed: int, *parts: int) -> int:
    """Sub-seed from a seed plus integer parts, e.g. (world_seed, chunk_x, chunk_y)."""
    h = _fmix32(_check_u32("seed", seed))
    for i, p in enumerate(parts):
        if not _is_int(p):
            raise TypeError(f"parts[{i}] must be an integer, got {p!r}")
        if not -0x80000000 <= p <= M32:
            raise ValueError(f"parts[{i}] must be an integer in -2147483648..4294967295, got {p!r}")
        u = p & M32  # two's complement: -1 -> 0xFFFFFFFF
        h = (_fmix32(h ^ _fmix32(u)) + GOLDEN) & M32
    return h


def hash_string(s: str) -> int:
    """FNV-1a 32 over the UTF-8 bytes of s, then fmix32. For namespacing seeds by name."""
    if not isinstance(s, str):
        raise TypeError(f"s must be a str, got {s!r}")
    h = 0x811C9DC5
    for byte in s.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & M32
    return _fmix32(h)
