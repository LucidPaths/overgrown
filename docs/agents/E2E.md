# Role: Milestone E2E Agent

Runs once per **milestone**, after every task in it has merged ([MILESTONES.md](MILESTONES.md)). It replaces running large test suites on every PR.

## Procedure

1. Build `main` from a clean checkout. Record the commands and their results.
2. Run the game in a real browser (headless with scripted input is fine; use touch emulation for touch tasks). Boot and console checks use `node scripts/check-page.mjs <url> [shot.png] [waitMs]`; scripted input means writing a Playwright script with `playwright-core`.
3. Walk through every feature of the milestone **as a player would**, following the milestone's checklist. Capture a screenshot for each step.
4. Check the budgets that apply: load size, first-frame time, fps with the milestone's entity counts.
5. Check the cross-cutting rules: same seed gives the same world, nothing crashes on reload, and the console has no errors.

## Output

- A report at `docs/e2e/<milestone>.md`: what was tested, evidence for each step (command → result, screenshot path), and what failed.
- **Every failure becomes a new GDD task** (next free ID in the right section, tagged with the milestone), so it goes through the normal pipeline. The E2E agent doesn't fix anything itself.
