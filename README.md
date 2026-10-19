# overgrown

An open-source, desktop, real-time hack-and-slash sandbox RPG for you and a few friends (OQ-029), made in Godot 4.

A cozy, saturated, painted world where you are *just another one*: NPCs live, learn, trade, migrate and die by the same rules you do. Monsters age, breed and take over land if nobody pushes back. Wander too far, or let an area grow wild, and the lovely world turns into hell difficulty.

- **A desktop game for a few friends** (typically 2, up to ~4): no phone or public-link target, no accounts (OQ-029).
- **One-machine-hosts multiplayer**: solo is just a world nobody has joined yet. Open it to friends and they join the host over LAN or the internet.
- **Everything is ours or credited**: we make the art and audio by any method, and any third-party file has a licence we can ship and an entry in [`game/assets/third_party/CREDITS.md`](game/assets/third_party/CREDITS.md) (OQ-038).

## Play

Download `overgrown-windows.exe` from the newest build on the [Releases page](https://github.com/LucidPaths/overgrown/releases): the rolling ["latest (main)" pre-release](https://github.com/LucidPaths/overgrown/releases/tag/latest) is rebuilt on every merge to `main`, and `v*` tags are versioned releases. Then double-click it. Nothing else to install.

The exe is not signed, so the first time Windows SmartScreen says "unknown publisher". Click **More info**, then **Run anyway**.

Linux: download `overgrown-linux.x86_64`, run `chmod +x overgrown-linux.x86_64`, then `./overgrown-linux.x86_64`.

## Status

Pre-production, in the middle of the move to Godot (milestone G0, [`docs/overhaul/PLAN.md`](docs/overhaul/PLAN.md)). The design lives in [`docs/gdd/`](docs/gdd/README.md). Every task in the GDD has a stable ID; when a PR implements one, the box gets ticked and the PR gets linked next to it. See [the workflow](docs/gdd/README.md#workflow).

## Develop

Everything happens through the scripts in `tools/godot/` (Ubuntu; the cloud sessions run `setup.sh` automatically):

```
bash tools/godot/setup.sh            # installs Godot 4.7.2 and Blender
bash tools/godot/test.sh             # headless GDScript tests
bash tools/godot/export.sh           # Windows and Linux builds into game/export/
bash tools/godot/capture.sh out.png  # a screenshot of the main scene (xvfb, software rendering)
```

The old TypeScript, Pixi and Python code (`sim/`, `client/`, `tools/art/`) is reference only and is deleted by OVR-010. Agents start from [`CLAUDE.md`](CLAUDE.md).

## License

MIT, for code and authored assets alike. Third-party assets keep their own licences, listed in `game/assets/third_party/CREDITS.md`.
