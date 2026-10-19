# Spike progress (Godot + Blender in cloud container)

Resume notes for a restarted run. Tools live under /opt (not in repo); if missing, re-run spike/tools/setup.sh.

- [x] 0. Install tools: `spike/tools/setup.sh` (Godot 4.7.2, Blender 4.5.14 LTS, Mesa 25.2.8) — verified idempotent rerun
- [x] 1. Blender headless character build + render + glb
  - `spike/blender/build_character.py` (~1.7 s, 32k tris, 20 bones, walk+idle, byte-identical glb across runs)
  - `spike/blender/render_preview.py` (Cycles CPU 32spp 640px ~6.5-8 s/frame; EEVEE Next works with and without xvfb, ~28 s first-frame shader compile, then ~7.5 s/frame)
  - Gotchas: primitive_uv_sphere_add polygon order is nondeterministic; subsurf on triangle poles too; ops.object.join order too; materials.clear() zeroes face material indices
- [ ] 2. Godot headless import + GDScript test
- [ ] 3. Godot rendering (Forward+/Mobile/Compatibility)
- [ ] 4. One-command round trip
- [ ] 5. (optional) ENet multiplayer smoke test
- [ ] REPORT.md
