# Spike progress (Godot + Blender in cloud container)

Resume notes for a restarted run. Tools live under /opt (not in repo); if missing, re-run spike/tools/setup.sh.

- [x] 0. Install tools: `spike/tools/setup.sh` (Godot 4.7.2, Blender 4.5.14 LTS, Mesa 25.2.8) — verified idempotent rerun
- [x] 1. Blender headless character build + render + glb
  - `spike/blender/build_character.py` (~1.7 s, 32k tris, 20 bones, walk+idle, byte-identical glb across runs)
  - `spike/blender/render_preview.py` (Cycles CPU 32spp 640px ~6.5-8 s/frame; EEVEE Next works with and without xvfb, ~28 s first-frame shader compile, then ~7.5 s/frame)
  - Gotchas: primitive_uv_sphere_add polygon order is nondeterministic; subsurf on triangle poles too; ops.object.join order too; materials.clear() zeroes face material indices
- [x] 2. Godot headless import + GDScript test (`tests/test_character.gd`, exit 0 / 1 with `-- --force-fail`)
- [x] 3. Godot rendering: all three work under xvfb on llvmpipe/lavapipe. Forward+ ~250 ms/frame, Mobile ~135 ms (but renders much darker; unexplained), Compat ~160 ms. Cold first frame: F+ 17.7 s, Mobile 17.8 s, Compat 4.9 s; warm ~2.3 s / 0.5 s
- [x] 4. One-command round trip: `spike/tools/rebuild.sh` (~86 s default, all 3 renderers + Cycles preview). Proved with `--tunic 0.10,0.22,0.65` (blue) and back; glb sha256 identical on return (693eeaca...)
- [x] 5. ENet smoke test: `spike/tools/net_smoke.sh` (pass, both exit 0; no-host client exits 1)
- [x] REPORT.md (spike/REPORT.md) — spike complete
