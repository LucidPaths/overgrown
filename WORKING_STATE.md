# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-19

## Current phase

**G0 of the Godot overhaul** (`docs/overhaul/PLAN.md`, merged #35). Lucid (2026-10-19): a proper game in Godot 4, a standalone `overgrown.exe` from GitHub Releases, everything built in the cloud, art from their painted mood board (`docs/art/moodboard/`), the D8 asset rule. **Durable authorization:** "just build, merge etc"; no sign-off needed per PR (the critic and Fable gates stay).

G0 waves:
1. ✅ GOD-001 #36 (scaffold, setup.sh + SessionStart hook, test runner, CI) · GOD-002 #37 (release pipeline; "latest (main)" pre-release verified with both builds at 1694ea7) · GOD-003 #38 (OgRng)
2. ✅ GOD-004 #39 (worldgen port + `contracts/worldgen-vectors.json`, bit-for-bit with TS)
3. ✅ OVR-009 #40 (OQ-031..038 = D1–D8, GDD/CLAUDE.md rewrite, credits check) · ⏳ GOD-005 (streaming, 3D terrain, tilted camera; branched from GOD-004): worker running
4. GOD-006 (character rules + keyboard/mouse/gamepad, replaces GOD-005's debug focus) after GOD-005
5. OVR-010 (retire sim/, client/, tools/art/, scripts/, deploy.yml), then the G0 E2E, a release, Lucid's playtest of the exe

Pre-overhaul history: M0 and M1 complete (docs/e2e/M0.md, M1.md); the TS/Pixi game is reference only until OVR-010.

Mechanics: main checkout /home/user/overgrown (claude.ai/code cloud container, ephemeral); worktrees in /home/user/wt/<id>; Python venv at repo-root `.venv/`; Godot 4.7.2 + Blender 4.5.14 installed by the SessionStart hook (`tools/godot/setup.sh`, log /tmp/godot-setup.log); specs drafted in the scratchpad, committed as `docs/specs/<ID>.md`; PRs, comments and merges via the GitHub connector tools.

Still open with Lucid (non-blocking): stray files `/nonexistent_root_dir/x.png` and `/x` created by subagents in an old container (harmless; gone with the container); whether to commit the spike REPORT.md (branch `spike-godot`); catalog review (OQ-017), OQ-002 name; the stray `probe-workflow` branch.

## In flight

- GOD-005 worker (opus) in /home/user/wt/god-005; merge main into it before its gates.
- Parked: `art-lab` (draft PR #32, ART-025/026 labs, superseded by G1 but kept for reference); `spike-godot` branch (reference only, never merge).
- Notes for later specs: `generate_chunk` costs ~120 ms in GDScript (GOD-005 streams on WorkerThreadPool); GOD-006 rules should port movement/actions/collision semantics from `sim/src/{movement,actions}.ts` and `world/collision.ts` in metres.

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
- 2026-10-12 Lucid: ART-024 art direction pass with full creative freedom inside the frame/cell/determinism contracts; preview images go in their own PR, not the scratchpad. After 3 Fable loops on #30 Lucid chose "fix both, merge" (fixes verified locally, no 4th gate).
- 2026-10-13 Lucid: desktop game for Lucid and a few friends, same stack (OQ-029); assets "authored by us" by any method, no third-party packs (OQ-030); merged as OVR-008 #33.
- 2026-10-13 Lucid: features first, graphics later (the art labs on `art-lab` / PR #32 are parked).
- 2026-10-19 Lucid: Godot overhaul (D1–D8 in docs/overhaul/PLAN.md, #35): Godot 4 desktop, exe from Releases, cloud-only development, mood-board art, tilted ARPG camera + vistas, agent-built Blender characters, loosened asset rule D8 (open licences + CREDITS). "Just build, merge": no per-PR sign-off.
- 2026-10-19 GDScript cross-language fixtures carry floats as IEEE-754 hex bits (Godot's JSON float parsing isn't correctly rounded).
- 2026-10-19 OVR-009 #40: 3 Fable loops, each finding new small doc-accuracy items (no failed fix); the last one-clause fix (OQ-032 asset names) was verified locally and merged without a 4th gate under Lucid's standing "just build, merge" (same call as #30).
- 2026-10-19 Third-party assets live in `game/assets/third_party/` (inside the Godot project so res:// can load them), credited in its CREDITS.md (OVR-009).
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
