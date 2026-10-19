# contracts

Frozen fixtures: the recorded output of the retired TypeScript and Python code, kept so the GDScript port can be checked against it.

| File | What it is | Checked by |
|---|---|---|
| `rng-vectors.json` | Seeded RNG vectors: sfc32 streams, floats, int ranges, `derive_seed` and `hash_string`. | `game/tests/test_rng.gd` |
| `worldgen-vectors.json` | Worldgen vectors: `chunks` digests, the `spawn` point, and `noise` samples as float64 hex bit patterns. | `game/tests/test_worldgen.gd` |

The TS and Python generators that produced these files are gone (retired in OVR-010). To regenerate them, check out the reference commit named in `CLAUDE.md` (`git show e6eaee3:sim/src/…`), or treat the files as frozen. Changing the expected output means re-deciding the contract, not editing a fixture.
