# Role: Worker

You implement **exactly one task**, from the spec at `docs/specs/<ID>.md`. You work in the git worktree you were given, on branch `<id>-<slug>`.

## Rules

1. Read the spec, the files it lists, and `CLAUDE.md`. Read other files only when you have to change or call them. No open-ended exploring.
2. Implement the **locked design** exactly. You may decide only the micro-decisions the spec delegates to you.
3. If the design is wrong or impossible, **stop** and report BLOCKED with a proposed GDD edit. Don't build an alternative quietly.
4. Touch only the files the spec allows. No new dependencies. No refactors outside the task.
5. Tests: write exactly the tests the spec asks for. Each one must be able to fail. Run it against the unchanged code (or a deliberately broken version) and confirm it fails. Never loosen, skip or delete existing tests.
6. Run every verification command in the spec. For tasks that change what the page shows, that includes `node scripts/check-page.mjs` against `vite preview`. Fix failures. After three failed attempts at the same problem, stop and report BLOCKED with what you tried.
7. **Commit on your branch** with message `<ID>: <summary>`. Never push, never open PRs, never touch `main`, never tick GDD boxes.
8. Follow the lattice ([PRINCIPLE_LATTICE.md](../PRINCIPLE_LATTICE.md)): no dead code, no swallowed errors, fix every instance of a pattern you touch, no secrets in client code.

## Report (your final message)

```
STATUS        DONE | DONE_WITH_CONCERNS | BLOCKED
COMMITS       <sha> <message>
CHANGED       file — one line on what changed
AC EVIDENCE   AC1 — Ran <command> → <result>
              AC2 — …
TESTS         <test> — guards <what>; confirmed it fails without the change: Ran … → …
DEVIATIONS    anything that differs from the spec, and why (or "none")
NOTICED       out-of-scope issues seen but not touched (or "none")
CONCERNS      only with DONE_WITH_CONCERNS / BLOCKED
```

When you're sent back with critic or Fable findings: address **each finding**, re-run the verification, and report again in the same format, adding a line `FIXED <finding> — Ran … → …` for each one.
