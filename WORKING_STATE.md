# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-12

## Current phase

**M0 complete (2026-10-12).** Housekeeping OVR-006/OVR-007 in flight, then M1.

Wave plan (dependencies → waves; parallel only on disjoint files):
1. ✅ OVR-001 (+TEC-019) #1 · OVR-003 #2
2. ✅ OVR-002 #5 · TEC-001 #3 · TEC-004 #4
3. ✅ ART-001 #7 · TEC-002 #6
4. ✅ ART-002 #9 · TEC-003 #8
5. ✅ ART-003 #10 · TEC-005 #11
6. ✅ M0 E2E — all 6 checklist items PASS (docs/e2e/M0.md). Proposed tasks added: OVR-005, TEC-020, TEC-021.

Mechanics: main checkout /home/user/overgrown (claude.ai/code cloud container, ephemeral); worktrees in /home/user/wt/<id>; Python venv at repo-root `.venv/`; PR bodies in the scratchpad; PRs, comments and merges via the GitHub connector tools (`gh` has no valid token here; the git proxy refuses branch deletion).

Still open with Lucid (non-blocking): catalog review (OQ-017), OQ-002 name; enable GitHub Pages (Settings → Pages → Source: GitHub Actions); the Deploy workflow fails on every main push until then; a stray `probe-workflow` branch the proxy won't let me delete (Lucid deletes it in the GitHub UI).

## In flight

None. M0 is done: 12 tasks, PRs #1–#11, E2E green. Open follow-ups: ART-023, OVR-005, TEC-020, TEC-021 (not in any milestone yet).

## Decisions (accumulate)

- 2026-10-11 GDD v0.1 written from a long Q&A with Lucid; all answers are reflected in `docs/gdd/`.
- 2026-10-11 Lattice: the **5 generic principles** only (Modularity, Simplicity Wins, Errors Are Answers, Fix The Pattern, Secrets Stay Secret). Instantiations for overgrown are still to be written (the file still has [ADAPT] markers).
- 2026-10-11 Research subagents are allowed only as read-only digests: write findings to a file and return ≤250 words.
- 2026-10-11 Git: the worker commits on its branch; the orchestrator pushes and opens the PR.
- 2026-10-11 Two gates: a sonnet critic per task, then a context-free **fable** gate on the PR (spec + diff + lattice). Fable findings → PR review comment → same worker goes back. Fable PASS → orchestrator merges automatically and ticks the GDD box.
- 2026-10-11 Tests only where they guard something that would silently break. E2E runs **per milestone**, not per PR.
- 2026-10-11 OQ-001 to OQ-016 resolved with Lucid (see `docs/gdd/13-open-questions.md` § Resolved). The architecture-relevant ones: MIT license; a Node dedicated host is planned, so **the sim must stay browser-API-free** (TEC-019, in M0); X sign-in is optional forever; hardcore mode is solo-only; there's a downed state with a ~10 s revive; untouched chunks get dropped and regenerated from the seed.

- 2026-10-12 OVR-001 also implemented TEC-019 in one PR (#1): the guard *is* the sim tsconfig, so a separate PR would have been a no-op. Allowed exception to one-task-per-PR.
- 2026-10-12 Session moved to a claude.ai/code cloud container. Fable is available to subagents (probe → "OK"). Lucid chose to copy the claude.md-workflow skills (without its hooks) into `.claude/skills/` (OVR-007); where they differ, this repo's pipeline docs win.
- 2026-10-12 TypeScript pinned to 6.0.3 (typescript-eslint peer limit). Recorded in CLAUDE.md traps.

## Corrections (accumulate; mistakes not to repeat)

- 2026-10-11 Used a research subagent before Lucid's research rule for this project was settled. It's now allowed as read-only digests only.

## Deferred ideas

- CI check that a merged PR titled `<ID>: …` leaves that ID ticked with `— #<n>` in the GDD.
- Protect `main` with branch rules once CI exists.
