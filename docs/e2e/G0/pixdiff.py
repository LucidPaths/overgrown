import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d = np.abs(a - b).max(axis=2)
hud = np.zeros_like(d, bool); hud[0:120, 0:620] = True
for name, m in [("all", np.ones_like(hud)), ("HUD box (0..620, 0..120)", hud), ("outside HUD", ~hud)]:
    dd = d[m]
    print(f"{name}: differing px {(dd > 0).sum()} of {dd.size}, max channel diff {dd.max()}, px with diff > 8: {(dd > 8).sum()}")
ys, xs = np.nonzero(d * (~hud))
if len(ys):
    print("outside-HUD diff bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())
