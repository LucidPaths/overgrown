# Working State

The orchestrator's memory on disk. **Any new or post-compaction session reads this first**, then `docs/agents/PIPELINE.md` and `docs/agents/ORCHESTRATOR.md`.
Ephemeral sections get overwritten; Decisions and Corrections accumulate. Keep it under ~200 lines.

Last updated: 2026-10-20 (≈05:00 UTC)

## Current phase

**G0 done; G1's three pieces merged (world look #49, wanderer #51, camera #48): next the G1 E2E + Lucid playtest; G2 replanned around "the frontier".** Godot overhaul: `docs/overhaul/PLAN.md` (#35). **Durable authorization from Lucid:** "just build, merge etc": no per-PR sign-off (critic + Fable gates stay). **Art exception:** nothing art-related merges until Lucid has seen pictures (my promise, 2026-10-19). Lucid dislikes emojis in replies.

Merged so far (newest last): GOD-001 #36, GOD-002 #37, GOD-003 #38, GOD-004 #39, OVR-009 #40, GOD-005 #41, OVR-010 #42, GOD-006 #43, G0 E2E #44 (docs/e2e/G0.md), ops delete-branches workflow #45, GOD-008 #46 (+GOD-007: camera orbit, attack while moving OQ-039, dodge dash), OVR-011 #47 (frontier design OQ-040..044, G2 replanned), OVR-012 #50 (dungeon death, OQ-045), ART-028 #51 (wanderer v1), GOD-009 #48 (camera looks 45° up, smooth spring arm), ART-027 #49 (G1 world look + `docs/art/BIBLE.md`).

Lucid's playtests:
- Round 1 (2026-10-19, exe at 6112b6a): wanted right-drag camera orbit, attacks that don't stop movement, a non-shrinking dodge → GOD-008 #46.
- Round 2 (2026-10-20): wants the camera to look up more → GOD-009 (#48, in review). After seeing the G1 floating island: "need to be able to look up more LOL" → extend GOD-009's look-up beyond the current 20° above the horizon (the wanderer may leave the frame at the extreme).
- Preview of the G1 world lab (draft PR #49 CI artifact, 2026-10-20): "thats so cool compared to what was there before". **180 fps** on Lucid's Strix Halo with the post stack on high.

Design decisions (Lucid, 2026-10-20; all in `docs/gdd/13-open-questions.md`):
- OQ-040..044 (merged #47): horde-slayer combat with mana-paid auto-fire toggles and OP builds with pay-offs; level-up pick-1-of-3 draft fed by books/gear/teachings + passive base power (replaces level points); overworld always permadeath (Respawn mode gone, Hardcore optional); horde density grows with distance; meta progression = the world remembers (beacons), knowledge codex, heirloom + grave; graves are civilization anchors in a tug of war against monster takeover. No account unlocks.
- OQ-045 (merged #50): dungeon death = teleport out, one ability sealed until a church/healer NPC unseals it, world difficulty rises permanently (never decreases), that dungeon's tier rises; no XP loss, no de-level, no per-character death limit.
- OQ-046 (PR for OVR-013): the dungeon break: every death in a dungeon (anyone's) feeds a break counter; at X it floods its surroundings with monsters; city guards defend it; the characters who fed it lose reputation with that settlement; a defended break resets the dungeon tier + counter (world difficulty untouched); undefended = monsters take over (tug of war). Numbers and details in DNG-016 (planned with the dungeons, after G3).

Mechanics: main checkout /home/user/overgrown; worktrees in /home/user/wt/<id>; Godot 4.7.2 + Blender 4.5.14 via the SessionStart hook; specs drafted in the scratchpad, committed as `docs/specs/<ID>.md`; PRs/comments/merges via the GitHub connector (it cannot dispatch workflows or change settings; Lucid runs Actions → Delete branches when needed). `main` is protected (PR + green `godot`). Containers restart: agents must push often; after a restart, save uncommitted lab work as a WIP commit and relaunch agents from their PROGRESS.md.

## In flight (2026-10-20)

Lucid paused the pipeline at ≈02:20 UTC to save usage and asked to resume at 5:31 German time (03:31 UTC, a one-shot scheduled self-message); resumed then. Lesson: on a pause, stop agents, commit + push every worktree's uncommitted work as a marked WIP commit, record per-PR resume points here; on resume, SendMessage the stopped agents (they keep their transcripts).

- **G1 merged** (2026-10-20): ART-027 #49 (Fable PASS; its two docs findings, the missing CLAUDE.md rows for shader globals / prop buffers / vertex colours / the post Frame UBO and BIBLE §3.1's water exception, are fixed in the follow-up docs PR on branch `g1-docs-followup`). **Next (proposed to Lucid 2026-10-20, awaiting go):** a small G1 polish task (attack-arc readability, which the G1 E2E needs; landmarks on land; the GL fallback) + G1 E2E + Lucid playtest of the `latest` exe; G2 split into playable slices (1 monsters + damage, 2 HUD, 3 XP + draft, 4 death + grave + new-character menu, 5 hordes by distance, 6 mana + auto-fire toggle, 7 equipment + sound); then fold the follow-ups below into G1 polish tasks or G2 specs.
- **G1 follow-ups found by the gates (not yet tasks):**
  - **Compatibility (OpenGL) renderer renders garbage on the art branch** (main renders fine): one of the new world shaders breaks under GL, even with `--post off`. Matters only on machines without Vulkan/D3D12 (Godot falls back to GL); Lucid's machine is fine. Bisect the shaders (terrain/foliage/sky) with `capture.sh <png> gl_compatibility`.
  - **Landmark sites ignore terrain**: ~40% of sites (seeds 1–8) land on water, cliff or stone (geoglyph under water, island over the ocean). Needs a render-side site search over loaded chunks; seed 1's is on land.
  - **Attack arc readability** with the v1 wanderer: a hairline on dark teal at 1280×720 (`--seed 1 --autopilot --capture-tick 206 --at -170.5,-2.5 --yaw -40`); the lab's `final/readability-attack.jpg` predates the wanderer merge. Needs a brighter additive arc with a dark under-stroke (wanderer_view) — a G1 E2E item.
  - From #49's Fable: if a post shader fails to load or compile, `OgPaintPost` stays off but the post-on environment remains (black sky, streaming edge): expose `ok` and fall back to the off look; `main.tscn` keeps a dead G0 ProceduralSky; `terrain_view.gd:15` mentions a rune-circle decal that no longer exists.
  - Vista could look 12–15° higher to frame the eye and pillar; broadleaf crowns low-poly up close; freeze shader time in captures; paint_post frees RIDs off the render thread (fine in the default thread model).
  - Camera (from #48's gate): when the arm collapses to the pivot against a cliff the look can turn up to 11.8° in one tick; over water the camera can sit below the water surface (clearance is against the terrain floor); `local_input.gd`'s `screen_to_world` comment still says "below the horizon"; `height_at` can build a chunk synchronously.
  - Playtest questions for Lucid: the wanderer leaves the frame below orbit −10 (last ~30° of drag all sky) — maybe a −30 minimum; mouse aim near the horizon is compressed.
- **Wanderer v1 follow-ups** (from #51's gates): albedo import has mipmaps off while the shader samples mipmaps (possible shimmer); glb import animation fps 30 vs 60 fps keys; rig ≈1.3 ms/frame/character in a debug build (distance LOD before crowds).
- Next after these: G1 E2E (MILESTONES § G1) + Lucid playtest; then G2 specs (frontier: WLD-007/WLD-023 hordes, CHR-020/021 draft, CMB-019/020 permadeath + grave, CHR-023 new character, CMB-006/027 mana + toggles).
- Repo housekeeping done: `main` protected, auto-delete head branches on, 3 branches left besides PR branches (main, art-lab, spike-godot).
- Follow-ups noted (not yet tasks): `main.gd`'s `--at` check re-derives the foot-box span instead of calling `OgCollision`; the device path in `local_input.gd` has no automated test; `find_spawn` keeps its own chunk cache (1.8–7.1 s blocking spawn search, window shows nothing); river-bank sawtooth; mesa walls follow the tile staircase; seed 1's straight N–S forest border (value-noise lattice); sky/fog horizon band at low pitch (ART-027's post fog should fix); `01-tech.md:63` says "Corpses" (= graves).
- Parked: `art-lab` (draft PR #32); `spike-godot` (reference only).

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
- 2026-10-20 OVR-011 #47: 3 Fable loops, each finding new small bookkeeping items (no failed fix); the last one-clause fix (OQ-040 trade-off deferral wording) was verified locally and merged without a 4th gate under Lucid's standing "just build, merge" (as #40, #30).
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
