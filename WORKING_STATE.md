# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-11

## Current phase

**Definition, not dispatch.** Lucid wants things defined properly before any worker runs. No code exists yet.

Waiting on Lucid:
- Review `docs/gdd/12-catalogs.md` (draft content, including the new mage section, OQ-017). A copy is in the claude.ai Project under `review/`.
- Sign off `docs/agents/MILESTONES.md` (draft).
- OQ-002 (final name) is the only original open question left; it doesn't block anything.

Next once cleared: write specs for M0 and dispatch.

## In flight

None.

## Decisions (accumulate)

- 2026-10-11 GDD v0.1 written from a long Q&A with Lucid; all answers are reflected in `docs/gdd/`.
- 2026-10-11 Lattice: the **5 generic principles** only (Modularity, Simplicity Wins, Errors Are Answers, Fix The Pattern, Secrets Stay Secret). Instantiations for overgrown are still to be written (the file still has [ADAPT] markers).
- 2026-10-11 Research subagents are allowed only as read-only digests: write findings to a file and return ≤250 words.
- 2026-10-11 Git: the worker commits on its branch; the orchestrator pushes and opens the PR.
- 2026-10-11 Two gates: a sonnet critic per task, then a context-free **fable** gate on the PR (spec + diff + lattice). Fable findings → PR review comment → same worker goes back. Fable PASS → orchestrator merges automatically and ticks the GDD box.
- 2026-10-11 Tests only where they guard something that would silently break. E2E runs **per milestone**, not per PR.
- 2026-10-11 OQ-001 to OQ-016 resolved with Lucid (see `docs/gdd/13-open-questions.md` § Resolved). The architecture-relevant ones: MIT license; a Node dedicated host is planned, so **the sim must stay browser-API-free** (TEC-019, in M0); X sign-in is optional forever; hardcore mode is solo-only; there's a downed state with a ~10 s revive; untouched chunks get dropped and regenerated from the seed.

## Corrections (accumulate; mistakes not to repeat)

- 2026-10-11 Used a research subagent before Lucid's research rule for this project was settled. It's now allowed as read-only digests only.

## Deferred ideas

- CI check that a merged PR titled `<ID>: …` leaves that ID ticked with `— #<n>` in the GDD.
- Protect `main` with branch rules once CI exists.
