# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-12

## Current phase

**M1 in progress (2026-10-12).** Housekeeping done: OVR-006 #12, OVR-007 #13. M1 design locked (OQ-018..027, this PR). M1 waves:
1. ✅ WLD-001 #15 · CHR-001 #16 · ART-005 #17
2. ✅ WLD-002 #18 · ART-004 #19 · CMB-001 #20
3. ✅ WLD-003 #22 · ART-006 #21
4. ✅ WLD-004 #23 · TEC-022 #24
5. ✅ CMB-002 #25 → ✅ UIX-002 #26 → TEC-020 (#27, Fable fix pending re-gate) → TEC-021 (spec on branch)
6. M1 E2E
Shared M1 contracts (coords, Tile enum, snapshot fields, frame names, input/chunk messages) were locked in the orchestrator's scratchpad and are copied into each spec.

Wave plan (dependencies → waves; parallel only on disjoint files):
1. ✅ OVR-001 (+TEC-019) #1 · OVR-003 #2
2. ✅ OVR-002 #5 · TEC-001 #3 · TEC-004 #4
3. ✅ ART-001 #7 · TEC-002 #6
4. ✅ ART-002 #9 · TEC-003 #8
5. ✅ ART-003 #10 · TEC-005 #11
6. ✅ M0 E2E — all 6 checklist items PASS (docs/e2e/M0.md). Proposed tasks added: OVR-005, TEC-020, TEC-021.

Mechanics: main checkout /home/user/overgrown (claude.ai/code cloud container, ephemeral); worktrees in /home/user/wt/<id>; Python venv at repo-root `.venv/`; PR bodies in the scratchpad; PRs, comments and merges via the GitHub connector tools (`gh` has no valid token here; the git proxy refuses branch deletion).

Still open with Lucid (non-blocking): catalog review (OQ-017), OQ-002 name; enable GitHub Pages (Settings → Pages → Source: GitHub Actions); the Deploy workflow fails on every main push until then; Birdfolk *Glide* vs "no height-level system" (OQ-018) to raise when Glide is built; a stray `probe-workflow` branch the proxy won't let me delete (Lucid deletes it in the GitHub UI).

## In flight

**PAUSED 2026-10-12 ~12:45 UTC at Lucid's request. Resume exactly here:**
1. PR #27 (TEC-020, branch tec-020-dpr-cap): Fable round 1 found `measure-startup.mjs` turning missing measurements into 0. The worker fixed it in f381a54 (verified: normal run exit 0, median 4630 ms; broken instrumentation → exit 1 naming the keys). Still to do: critic re-check of f381a54 → re-run verification → Fable round 2 on the new head → merge if PASS and CI green.
2. TEC-021 (branch tec-021-startup, spec committed, NOT dispatched): dispatch a sonnet worker after #27 merges. Before opening its PR, drop `docs/orchestration/m1-contracts.md` from that branch (only parked there so the sheet survives a container reset). Pass along: fix the main.ts TDZ pattern (a constructor failure after `app.ticker.add` gets overwritten by a ReferenceError on the next tick); first-frame baseline 4.63 s, bar ≤ 3 s (OQ-028); spawn search costs ≤ ~236 ms; the CMB-001 AC12 `phoneCanvas` constant is now 541×1201 after TEC-020.
3. Then the M1 E2E (docs/agents/E2E.md + MILESTONES M1 checklist). Extra items: a chunk border where terrain changes (WLD-003 re-bake rule has no automated guard); stall numbers vs a no-ground baseline (SwiftShader halves fps here); characters animate in-game (TEC-022 wiring only smoke-tested); the ≤ 3 s first frame; touch emulation walk.
Merged so far: #12–#26 (OVR-006/007, M1 design lock, and 12 of 14 M1 tasks). Remaining M1: TEC-020 (#27), TEC-021.

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
- 2026-10-12 Direct commits to `main` are refused by this session's permission classifier, so GDD ticks and WORKING_STATE updates ride in the next task PR; a PR merges only on the exact head Fable passed, so its own tick lands in the following PR.
- 2026-10-12 Lucid: atlas → lossless WebP and M1 first-frame bar ≤ 3 s; the 2 s target moves to TEC-012 (OQ-028, lands with TEC-021).
- 2026-10-12 WLD-003 AC8: in headless SwiftShader, displaying baked ground alone halves fps; stall numbers are recorded vs a no-ground baseline, and the hard stall bar moves to TEC-020's real-GPU step and the M1 E2E (orchestrator spec amendment).
- 2026-10-12 TypeScript pinned to 6.0.3 (typescript-eslint peer limit). Recorded in CLAUDE.md traps.

## Corrections (accumulate; mistakes not to repeat)

- 2026-10-12 PR #14 (docs-only design lock) took 4 Fable rounds on cross-reference bookkeeping. Before gating a GDD edit, run a scripted sweep: every OQ "Applied in" cell ↔ task-line pointers ↔ prose mentions, and re-read surrounding prose and MILESTONES checklists.
- 2026-10-12 Never chain verification after `git commit` with `&&`: an empty commit exits 1 and silently skips venv activation, so ruff/pytest 'fail'. Activate the venv first, on its own.
- 2026-10-12 Never chain `git add -A && git commit` after a `git merge` without checking `git diff --name-only --diff-filter=U` first: a conflicted CLAUDE.md got committed with markers on the ART-005 branch (caught before push, amended).
- 2026-10-12 Parallel tasks that each add CLAUDE.md contract rows: merge `main` into the later branch before its Fable gate, so the gate sees the real head.

- 2026-10-11 Used a research subagent before Lucid's research rule for this project was settled. It's now allowed as read-only digests only.

## Deferred ideas

- CI check that a merged PR titled `<ID>: …` leaves that ID ticked with `— #<n>` in the GDD.
- Protect `main` with branch rules once CI exists.
