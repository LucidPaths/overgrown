"""Renders preview stills of the built character (Cycles CPU by default).

Run:  blender --background spike/build/character.blend --python spike/blender/render_preview.py -- \
          --out spike/build/preview --engine CYCLES [--samples 32] [--res 640]

Writes <out>_front.png (idle, 3/4 view) and <out>_walk_<frame>.png (walk, side view).
"""

import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector


def args() -> dict[str, str]:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = {"out": "spike/build/preview", "engine": "CYCLES", "samples": "32", "res": "640"}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


def look_at(obj, target) -> None:
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def setup(a) -> None:
    sc = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    eng = a["engine"]
    if eng == "EEVEE":
        eng = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    sc.render.engine = eng
    res = int(a["res"])
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = False
    if eng == "CYCLES":
        sc.cycles.device = "CPU"
        sc.cycles.samples = int(a["samples"])
        sc.cycles.use_denoising = True
        sc.cycles.max_bounces = 4
    elif eng.startswith("BLENDER_EEVEE"):
        sc.eevee.taa_render_samples = int(a["samples"])
    sc.view_settings.view_transform = "AgX"

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.55, 0.65, 0.80, 1.0)
    bg.inputs["Strength"].default_value = 0.6
    sc.world = world

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.40, 0.22, 1)
    ground.data.materials.append(gm)

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.data.angle = math.radians(4)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
    fill.data.energy = 120
    fill.data.size = 2.0
    fill.location = (-2.5, -2.0, 2.2)
    look_at(fill, (0, 0, 1.0))
    sc.collection.objects.link(fill)

    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 60
    sc.collection.objects.link(cam)
    sc.camera = cam


def shoot(path: str, frame: int, action: str, cam_loc, target) -> float:
    sc = bpy.context.scene
    rig = bpy.data.objects["Rig"]
    rig.animation_data.action = bpy.data.actions[action]
    sc.frame_set(frame)
    cam = sc.camera
    cam.location = Vector(cam_loc)
    look_at(cam, target)
    sc.render.filepath = str(Path(path).resolve())
    t = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    dt = time.perf_counter() - t
    print(f"[render] {sc.render.engine} {path} frame={frame} {dt:.2f}s", flush=True)
    return dt


def main() -> None:
    a = args()
    setup(a)
    out = a["out"]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    total = shoot(f"{out}_front.png", 1, "idle", (2.0, -3.2, 1.9), (0, 0, 0.95))
    if a.get("walk", "1") == "1":
        for f in (1, 4, 7, 10):
            total += shoot(f"{out}_walk_{f:02d}.png", f, "walk", (3.6, -0.25, 1.15), (0, 0, 0.88))
    print(f"[render] TOTAL {total:.2f}s", flush=True)


main()
