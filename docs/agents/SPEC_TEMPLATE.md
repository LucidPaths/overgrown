# Task Spec Template

Every task gets a spec at `docs/specs/<ID>.md` **before** any worker starts. The spec is committed on the task branch so the critic and the Fable gate can read it.

**Pre-dispatch gate (orchestrator checks all of these):**
- [ ] Every dependency (`→`) is merged.
- [ ] The design is locked: no open design choice left to the worker unless it's listed under delegated micro-decisions.
- [ ] Every acceptance criterion has a "proven by".
- [ ] Out-of-scope is not empty.
- [ ] Every touched OQ is named, with the default being followed.

---

```markdown
# <ID>: <short title>

GDD: docs/gdd/<file>.md — "<exact task line>"
Milestone: <M#>   Depends on: <IDs or none>
Model: haiku | sonnet | opus — because <design risk in one line>
Branch: <id>-<slug>

## Desired result
One or two sentences describing what is observably true when this is done.

## Read these (and nothing else unless needed to make the change)
- path/to/file — why

## Locked design
Data shapes, file and module names, public API, message formats, constants
(mark starting values as "tunable").
Delegated micro-decisions: <list, or "none">

## Acceptance criteria
- AC1 <observable statement> — proven by: <command / test name / grep>
- AC2 …
- Tests and export clean — proven by: <commands> (`bash tools/godot/test.sh`; `bash tools/godot/export.sh` when the export changes)

## Tests
Which tests this task adds, and what silent breakage each one guards.
Or "none — <reason>" (e.g. pure rendering, covered by milestone E2E).

## Verification commands
Copy-paste commands. The worker, the critic and the orchestrator all run them.
Checks: `bash tools/godot/test.sh`, plus `bash tools/godot/capture.sh <out.png>` (xvfb) and looking at the PNG for visible changes.

## Files
Allowed to change: …
Must not change: …

## Out of scope
- Do NOT …
- No new dependencies without asking.

## Open questions touched
OQ-xxx — following default: …
```
