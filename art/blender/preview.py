"""Quick look renders of a saved wanderer .blend (Workbench, textured): a row of views for one action frame.

    blender --background <wanderer.blend> --python art/blender/preview.py -- --out sheet.png \
        [--action idle] [--frame 0] [--views front,q34,side,back] [--size 480] [--engine WORKBENCH|EEVEE]

Writes one PNG per view next to --out and a combined strip at --out. Only for iteration and docs; the game
look comes from Godot.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = {"out": "preview.png", "action": "idle", "frame": "0", "views": "front,q34,side,back", "size": "480",
           "engine": "WORKBENCH", "dist": "6.2", "target": "0.95"}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


VIEWS = {"front": 0.0, "q34": 35.0, "side": 90.0, "back": 180.0, "q34b": 145.0, "rside": -90.0}


def main():
    a = args()
    sc = bpy.context.scene
    rig = bpy.data.objects["Rig"]
    act = bpy.data.actions[a["action"]]
    rig.animation_data.action = act
    sc.frame_set(int(a["frame"]))
    size = int(a["size"])
    sc.render.resolution_x = size
    sc.render.resolution_y = int(size * 1.25)
    sc.render.film_transparent = False
    if a["engine"] == "WORKBENCH":
        sc.render.engine = "BLENDER_WORKBENCH"
        sh = sc.display.shading
        sh.light = "STUDIO"
        sh.color_type = "TEXTURE"
        sh.show_cavity = True
        sh.show_object_outline = False
        sh.background_type = "VIEWPORT"
        sh.background_color = (0.62, 0.55, 0.42)
    else:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
        w = bpy.data.worlds.new("W")
        sc.world = w
        w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.42, 0.3, 1)
        sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
        sun.data.energy = 3.0
        sun.rotation_euler = (math.radians(50), 0, math.radians(30))
        sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = 85
    target = Vector((0, 0, float(a["target"])))
    dist = float(a["dist"])
    out = Path(a["out"])
    paths = []
    for name in a["views"].split(","):
        az = math.radians(VIEWS[name])
        # the character faces -Y; az 0 looks at the front
        pos = target + Vector((math.sin(az) * dist, -math.cos(az) * dist, 0.25 * dist * 0.3))
        cam.location = pos
        d = target - pos
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        p = out.with_name(f"{out.stem}_{name}.png")
        sc.render.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        paths.append(p)
    # combine into a strip
    imgs = [bpy.data.images.load(str(p)) for p in paths]
    w, h = imgs[0].size
    strip = bpy.data.images.new("strip", w * len(imgs), h)
    import numpy as np

    buf = np.zeros((h, w * len(imgs), 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
        buf[:, k * w : (k + 1) * w] = px
    strip.pixels = buf.ravel()
    strip.filepath_raw = str(out)
    strip.file_format = "PNG"
    strip.save()
    print("PREVIEW", out)


main()
