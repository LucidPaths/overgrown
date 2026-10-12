# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-11

## Current phase

**M0 dispatch** (approved by Lucid 2026-10-12: "just get me the results", so specs aren't shown to him first).

Wave plan (dependencies → waves; parallel only on disjoint files):
1. ✅ OVR-001 (+TEC-019) #1 · OVR-003 #2
2. ✅ OVR-002 #5 · TEC-001 #3 · TEC-004 #4
3. ART-001 pipeline + atlas schema (opus, needs OVR-002) · TEC-002 sim worker + snapshot (opus, needs TEC-001, TEC-004)
4. ART-002 palettes (sonnet) · TEC-003 fixed timestep + interpolation (sonnet, needs TEC-002)
5. ART-003 primitives (sonnet, needs ART-002) · TEC-005 asset loader (sonnet, needs ART-001, TEC-003)
6. M0 E2E

Mechanics: worktrees in /home/claude/wt/<id>; shared Python venv /home/claude/.venv-og; PR bodies in the scratchpad; PRs, comments and merges via `gh api` REST (squash merge works).

Still open with Lucid (non-blocking): catalog review (OQ-017), OQ-002 name; enable GitHub Pages (Settings → Pages → Source: GitHub Actions) for TEC-001's deploy; a stray `probe-workflow` branch the proxy wouldn't let me delete.

## In flight

Wave 3.

## Decisions (accumulate)

- 2026-10-11 GDD v0.1 written from a long Q&A with Lucid; all answers are reflected in `docs/gdd/`.
- 2026-10-11 Lattice: the **5 generic principles** only (Modularity, Simplicity Wins, Errors Are Answers, Fix The Pattern, Secrets Stay Secret). Instantiations for overgrown are still to be written (the file still has [ADAPT] markers).
- 2026-10-11 Research subagents are allowed only as read-only digests: write findings to a file and return ≤250 words.
- 2026-10-11 Git: the worker commits on its branch; the orchestrator pushes and opens the PR.
- 2026-10-11 Two gates: a sonnet critic per task, then a context-free **fable** gate on the PR (spec + diff + lattice). Fable findings → PR review comment → same worker goes back. Fable PASS → orchestrator merges automatically and ticks the GDD box.
- 2026-10-11 Tests only where they guard something that would silently break. E2E runs **per milestone**, not per PR.
- 2026-10-11 OQ-001 to OQ-016 resolved with Lucid (see `docs/gdd/13-open-questions.md` § Resolved). The architecture-relevant ones: MIT license; a Node dedicated host is planned, so **the sim must stay browser-API-free** (TEC-019, in M0); X sign-in is optional forever; hardcore mode is solo-only; there's a downed state with a ~10 s revive; untouched chunks get dropped and regenerated from the seed.

- 2026-10-12 OVR-001 also implemented TEC-019 in one PR (#1): the guard *is* the sim tsconfig, so a separate PR would have been a no-op. Allowed exception to one-task-per-PR.
- 2026-10-12 TypeScript pinned to 6.0.3 (typescript-eslint peer limit). Recorded in CLAUDE.md traps.

## Corrections (accumulate; mistakes not to repeat)

- 2026-10-11 Used a research subagent before Lucid's research rule for this project was settled. It's now allowed as read-only digests only.

## Deferred ideas

- CI check that a merged PR titled `<ID>: …` leaves that ID ticked with `— #<n>` in the GDD.
- Protect `main` with branch rules once CI exists.
