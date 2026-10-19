# Role: Milestone E2E Agent

Runs once per **milestone**, after every task in it has merged ([MILESTONES.md](MILESTONES.md)). It replaces running large test suites on every PR.

The game is a Godot 4 project in `game/`, built into an exe (OQ-031, OQ-032). The cloud renders in software (about 4 fps), so this agent judges **correctness and how things look**. Feel and real fps are judged by **Lucid's playtest of the exe**, which is a line on every milestone's checklist. The agent doesn't replace it and doesn't claim it.

## Procedure

1. Check out `main` clean and build it. Record the commands and their results:
   - `bash tools/godot/setup.sh --no-blender --templates` if `godot` is missing (cloud sessions install it through the SessionStart hook; if `godot` is still missing, read `/tmp/godot-setup.log`);
   - `bash tools/godot/test.sh` runs the headless GDScript tests;
   - `bash tools/godot/export.sh` builds the Windows and Linux exes into `game/export/`.
2. Check that the release has both builds: the rolling `latest` pre-release (or the `v*` release) lists `overgrown-windows.exe` and `overgrown-linux.x86_64`. The proxy blocks the GitHub API, so use the GitHub connector tools or direct release-asset URLs.
3. Run the game and look at it:
   - `bash tools/godot/capture.sh <out.png>` renders the main scene under xvfb and saves a PNG. `godot --headless` can't render, so captures always go through this script;
   - the Linux build also takes `-- --capture <out.png>` for a smoke test of the exported exe;
   - scripted input (keyboard, mouse and gamepad events) goes in a GDScript driver run through the same xvfb setup. Touch is not a target (OQ-029).
4. Walk through every feature of the milestone **as a player would**, following the milestone's checklist. Capture an image for each step.
5. Check the cross-cutting rules: the same seed gives the same world (the shared fixtures in `contracts/` pass), nothing crashes on restart, and the Godot output has no `SCRIPT ERROR` or `ERROR:` lines.
6. Tell the orchestrator what Lucid has to test in the exe, with the download link and the SmartScreen note ("More info", then "Run anyway").

`scripts/check-page.mjs` (the headless page check for the old web client) stays only until OVR-010 deletes it. Don't use it for G0 or later milestones.

## Output

- A report at `docs/e2e/<milestone>.md`: what was tested, evidence for each step (command → result, image path), what failed, and what is left for Lucid's playtest.
- **Every failure becomes a new GDD task** (next free ID in the right section, tagged with the milestone), so it goes through the normal pipeline. The E2E agent doesn't fix anything itself.
