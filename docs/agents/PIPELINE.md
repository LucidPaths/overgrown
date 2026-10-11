# Agent Pipeline

How work flows from a GDD task to `main`. Role files in this folder define each agent's rules. Each agent reads **only its own role file** plus what its inputs list.

```
GDD task ID
   │
   ▼
ORCHESTRATOR writes spec ──▶ docs/specs/<ID>.md  (design locked, ACs, verification)
   │
   ▼
WORKER (haiku/sonnet/opus) implements in its own worktree, commits on branch <id>-<slug>
   │  report: DONE / DONE_WITH_CONCERNS / BLOCKED
   ▼
CRITIC (sonnet) checks diff against the spec's desired result + ACs
   │  FAIL ─▶ back to the SAME worker (max 3 loops, then orchestrator re-specs or escalates to Lucid)
   ▼ PASS
ORCHESTRATOR re-runs verification itself, pushes branch, opens PR
   │
   ▼
FABLE GATE (model: fable, context-free): spec + diff vs main + lattice only
   │  FINDINGS ─▶ posted as PR review comment ─▶ orchestrator sends the SAME worker back ─▶ critic ─▶ Fable again
   ▼ PASS (last gate)
ORCHESTRATOR merges, ticks the GDD box with the PR number, updates WORKING_STATE.md
   │
   ▼
MILESTONE complete? ─▶ E2E agent runs a full end-to-end pass ─▶ findings become new GDD tasks
```

## Rules that apply to everyone

- **The GDD is the source of truth.** Specs implement GDD lines; they don't invent design. Undecided means an OQ entry and its default, never a guess.
- **The lattice** ([PRINCIPLE_LATTICE.md](../PRINCIPLE_LATTICE.md)) is the review standard. The question is always "does this violate the lattice", not "is it clean".
- **No claims without evidence.** Every status claim is written as "Ran X → Y" from that same response. "Should work", "looks right" and "done!" before verification are forbidden.
- **Mention it, don't do it.** Out-of-scope observations go in the report, never into the diff.
- **Three-strike circuit breaker.** Three failed fix attempts on the same thing means the spec or the architecture is wrong. Stop and escalate instead of trying a fourth.

## Testing policy (Lucid's rule)

- **No ceremonial tests.** A test must guard something that would silently break: determinism (same seed → same output), formulas (damage skew), data contracts (save format, atlas JSON, sim↔renderer snapshot, net messages), and bugs we already hit once.
- UI, rendering and feel are **not** unit-tested. They get checked by build + typecheck + the milestone E2E pass.
- **Milestone E2E:** when all tasks of a milestone are merged, one E2E agent plays through the milestone's features in a real browser run and files findings as new GDD tasks. Milestones are defined in [MILESTONES.md](MILESTONES.md).
- Per-task verification is the cheapest command that proves the ACs: typecheck, lint, build, the specific test(s) for that task. Never the "run everything" suite on every PR.

## Model selection

| Model | Use for |
|---|---|
| **haiku** | Mechanical work with a tight spec: data files, meta tags, docs, GDD ticks |
| **sonnet** | Well-specified features (most gameplay tasks); the per-task **critic** |
| **opus** | Architecture and contracts: sim worker protocol, ECS layout, netcode, zone ownership, save formats, pipeline core |
| **fable** | The final PR gate only |

## Parallelism

- Workers run in parallel only on **disjoint file sets**, each in its own git worktree. Max 3 at once by default.
- Tasks with `→` dependencies wait until those dependencies are merged.

## Files

| File | Who reads it |
|---|---|
| [ORCHESTRATOR.md](ORCHESTRATOR.md) | Orchestrator (main session) |
| [WORKER.md](WORKER.md) | Workers |
| [CRITIC.md](CRITIC.md) | Per-task critic |
| [FABLE_GATE.md](FABLE_GATE.md) | Fable gate |
| [E2E.md](E2E.md) | Milestone E2E agent |
| [SPEC_TEMPLATE.md](SPEC_TEMPLATE.md) | Orchestrator (writes), everyone (reads specs) |
| [MILESTONES.md](MILESTONES.md) | Orchestrator, E2E agent |
| [`/WORKING_STATE.md`](../../WORKING_STATE.md) | Orchestrator; any new or post-compaction session reads it first |
